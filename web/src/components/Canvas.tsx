import { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import { CustomNode } from '@/components/CustomNode';
import { Legend } from '@/components/Legend';
import { useTreeLayout } from '@/hooks/useTreeLayout';
import { branchOf, normalize } from '@/lib/graph';
import { CENTRAL_SIZE, NODE_SIZE } from '@/lib/layout';
import { TYPE_COLOR } from '@/lib/theme';
import { useTreeActions, useTreeView } from '@/state/TreeStore';
import type { ProblemFlowEdge, ProblemFlowNode } from '@/types/tree';

const nodeTypes: NodeTypes = { problem: CustomNode };

const EDGE_IDLE = '#94a3b8';
/** Márgenes de encuadre que reservan la barra superior flotante y la leyenda inferior. */
const FIT_PADDING = { top: '136px', bottom: '64px', x: '48px' } as const;
const FOCUS_PADDING = { top: '150px', bottom: '80px', x: '72px' } as const;
/** Tiempo de la transición de ancho del Drawer antes de reencuadrar. */
const DRAWER_TRANSITION_MS = 320;

interface CanvasProps {
  searchQuery: string;
  drawerOpen: boolean;
}

export function Canvas({ searchQuery, drawerOpen }: CanvasProps) {
  const view = useTreeView();
  const { selectNode } = useTreeActions();
  const { fitView } = useReactFlow();
  const { index, visible, collapsed, dimmed, selectedId, focus } = view;
  const layout = useTreeLayout(index, visible);
  const positions = layout?.positions;
  const layoutIsCurrent = layout?.isCurrent ?? false;

  const searchHits = useMemo(() => {
    const q = normalize(searchQuery.trim());
    if (q.length < 3) return new Set<string>();
    return new Set(
      index.tree.nodes
        .filter((n) => normalize(`${n.label} ${n.description} ${n.organo}`).includes(q))
        .map((n) => n.id),
    );
  }, [index, searchQuery]);

  const nodes = useMemo<ProblemFlowNode[]>(() => {
    if (!positions) return [];
    const out: ProblemFlowNode[] = [];
    for (const id of visible) {
      const meta = index.byId.get(id);
      const position = positions.get(id);
      if (!meta || !position) continue;
      out.push({
        id,
        type: 'problem',
        position,
        // Tamaño fijo conocido: permite al MiniMap y a fitView operar sin esperar la medición del DOM.
        ...(id === index.centralId ? CENTRAL_SIZE : NODE_SIZE),
        draggable: false,
        connectable: false,
        selectable: false,
        data: {
          id,
          type: meta.type,
          level: meta.level,
          label: meta.label,
          description: meta.description,
          organo: meta.organo,
          ejeTematico: meta.ejeTematico,
          severidad: meta.severidad,
          ...(meta.evidencia !== undefined ? { evidencia: meta.evidencia } : {}),
          fuente: meta.fuente,
          isCollapsed: collapsed.has(id),
          isDimmed: dimmed.has(id),
          childCount: index.children.get(id)?.length ?? 0,
          descendantCount: index.descendants.get(id)?.size ?? 0,
          branch: branchOf(meta.level),
          isSelected: selectedId === id,
          isSearchHit: searchHits.has(id),
        },
      });
    }
    return out;
  }, [positions, visible, index, collapsed, dimmed, selectedId, searchHits]);

  const edges = useMemo<ProblemFlowEdge[]>(() => {
    if (!positions) return [];
    const highlight = selectedId !== null && dimmed.size > 0;
    const out: ProblemFlowEdge[] = [];
    for (const e of index.tree.edges) {
      if (!visible.has(e.source) || !visible.has(e.target)) continue;
      const source = index.byId.get(e.source);
      const target = index.byId.get(e.target);
      if (!source || !target) continue;
      const isCause = source.level > 0;
      // Causas: se dibuja padre (handle inferior) → hijo (handle superior) con la flecha hacia el
      // padre; efectos: padre (handle superior) → hijo (handle inferior) con la flecha hacia el hijo.
      // Así todas las flechas apuntan hacia arriba, en el sentido causa → problema → efecto.
      const parent = isCause ? target : source;
      const child = isCause ? source : target;
      const onPath = !dimmed.has(parent.id) && !dimmed.has(child.id);
      const color = highlight && onPath ? TYPE_COLOR[child.type] : EDGE_IDLE;
      const marker = { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
      out.push({
        id: e.id,
        source: parent.id,
        target: child.id,
        sourceHandle: parent.level === 0 ? (isCause ? 'causas' : 'efectos') : 'out',
        targetHandle: 'in',
        type: 'smoothstep',
        focusable: false,
        selectable: false,
        ...(isCause ? { markerStart: marker } : { markerEnd: marker }),
        style: {
          stroke: color,
          strokeWidth: highlight && onPath ? 2.25 : 1.5,
          opacity: dimmed.size > 0 && !onPath ? 0.15 : 1,
          transition: 'opacity 300ms ease, stroke 300ms ease',
        },
      });
    }
    return out;
  }, [positions, visible, index, dimmed, selectedId]);

  // Encuadre de cámara ante solicitudes del estado global (selección, filtros, cambio de árbol…).
  const handledSeq = useRef(-1);
  const drawerWasOpen = useRef(drawerOpen);
  useEffect(() => {
    // Se espera al layout del conjunto visible vigente (el cálculo ELK es asíncrono).
    if (!positions || !layoutIsCurrent || focus.seq === handledSeq.current) return;
    const ids = focus.ids?.filter((id) => visible.has(id) && positions.has(id)) ?? null;
    if (ids && ids.length === 0) return;
    handledSeq.current = focus.seq;
    // Si el Drawer cambia de estado, se espera a que el lienzo termine de redimensionarse.
    const delay = drawerWasOpen.current !== drawerOpen ? DRAWER_TRANSITION_MS : 40;
    drawerWasOpen.current = drawerOpen;
    const t = window.setTimeout(() => {
      void fitView({
        ...(ids ? { nodes: ids.map((id) => ({ id })) } : {}),
        padding: ids ? FOCUS_PADDING : FIT_PADDING,
        duration: 650,
        maxZoom: ids ? 1.05 : 1,
      });
    }, delay);
    return () => window.clearTimeout(t);
  }, [focus, positions, layoutIsCurrent, visible, fitView, drawerOpen]);

  return (
    <ReactFlow<ProblemFlowNode, ProblemFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      // `onNodeClick` = onNodeSelect. Además, React Flow solo habilita eventos de puntero en nodos
      // no seleccionables/arrastrables cuando existe este manejador.
      onNodeClick={(_, node) => selectNode(node.id)}
      onPaneClick={() => selectNode(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnDoubleClick={false}
      minZoom={0.08}
      maxZoom={1.75}
      fitView
      fitViewOptions={{ padding: FIT_PADDING, maxZoom: 1 }}
      proOptions={{ hideAttribution: false }}
      className="bg-slate-50"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#cbd5e1" />
      <Controls position="bottom-left" showInteractive={false} className="!shadow-md" />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeStrokeWidth={0}
        nodeBorderRadius={8}
        nodeColor={(n) => {
          const t = (n.data as ProblemFlowNode['data'] | undefined)?.type;
          return t ? TYPE_COLOR[t] : EDGE_IDLE;
        }}
        maskColor="rgba(241, 245, 249, 0.7)"
        className="!rounded-lg !border !border-slate-200 !shadow-md"
      />
      <Legend />
    </ReactFlow>
  );
}
