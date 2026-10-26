import { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useStore,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { CustomNode, PanelNode } from '@/components/CustomNode';
import { RoutedEdge } from '@/components/RoutedEdge';
import { Legend } from '@/components/Legend';
import { useTreeLayout } from '@/hooks/useTreeLayout';
import { LEGIBLE_ZOOM } from '@/lib/layout';
import { branchOf, normalize } from '@/lib/graph';
import { KIND_COLOR, kindOf } from '@/lib/theme';
import { useTreeActions, useTreeView } from '@/state/TreeStore';
import type { FlowNode, ProblemFlowEdge } from '@/types/tree';

const nodeTypes: NodeTypes = { problem: CustomNode, panel: PanelNode };
const edgeTypes: EdgeTypes = { routed: RoutedEdge };

const EDGE_IDLE = '#94a3b8';
/** Alto que ocupa la barra flotante sobre el lienzo (el centro visual queda por debajo). */
const TOOLBAR_OFFSET = 68;
/** Escalas de la Vista general: se encuadra el árbol completo sin bajar del mínimo legible. */
const READING_ZOOM = { max: 1.1, min: LEGIBLE_ZOOM } as const;
const SIDE_MARGIN = 24;
/** Reserva inferior para la leyenda. */
const BOTTOM_MARGIN = 44;
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
  const { fitView, setCenter } = useReactFlow();
  const paneWidth = useStore((st) => st.width);
  const paneHeight = useStore((st) => st.height);
  const { index, visible, collapsed, dimmed, selectedId, focus } = view;
  const { boxes, panels, placedUnder, shared, routes, bounds } = useTreeLayout(index, visible);

  const searchHits = useMemo(() => {
    const q = normalize(searchQuery.trim());
    if (q.length < 3) return new Set<string>();
    return new Set(
      index.tree.nodes
        .filter((n) => normalize(`${n.label} ${n.description}`).includes(q))
        .map((n) => n.id),
    );
  }, [index, searchQuery]);

  const nodes = useMemo<FlowNode[]>(() => {
    // Paneles de fondo: cada causa (o efecto) directa agrupa toda su descendencia.
    const out: FlowNode[] = panels.map((p) => ({
      id: `panel:${p.id}`,
      type: 'panel',
      position: { x: p.x, y: p.y },
      width: p.width,
      height: p.height,
      zIndex: -1,
      // El fondo no captura el puntero: la rueda y el arrastre llegan al lienzo.
      style: { pointerEvents: 'none' },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
      data: { side: p.side, isDimmed: dimmed.has(p.id) },
    }));
    for (const id of visible) {
      const meta = index.byId.get(id);
      const box = boxes.get(id);
      if (!meta || !box) continue;
      out.push({
        id,
        type: 'problem',
        position: { x: box.x, y: box.y },
        // Tamaño conocido: permite al MiniMap y a fitView operar sin esperar la medición del DOM.
        width: box.width,
        height: box.height,
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
  }, [boxes, panels, visible, index, collapsed, dimmed, selectedId, searchHits]);

  const edges = useMemo<ProblemFlowEdge[]>(() => {
    const highlight = selectedId !== null && dimmed.size > 0;
    const out: ProblemFlowEdge[] = [];
    for (const e of index.tree.edges) {
      if (!visible.has(e.source) || !visible.has(e.target)) continue;
      const source = index.byId.get(e.source);
      const target = index.byId.get(e.target);
      if (!source || !target) continue;
      const isCause = source.level > 0;
      const parent = isCause ? target : source;
      const child = isCause ? source : target;
      // Dentro de un panel la jerarquía se lee por agrupación y sangría: solo se dibujan las
      // aristas del problema central y las del DAG que enlazan con un nodo ubicado en otro panel.
      const fromCentral = parent.level === 0;
      // Fila de causas raíz / efectos finales compartidos: enlace continuo con cada padre.
      const toShared = shared.has(child.id);
      if (!fromCentral && !toShared && placedUnder.get(child.id) === parent.id) continue;
      // Trazo precalculado que no atraviesa tarjetas (sale por el borde o por los canales).
      const points = fromCentral ? undefined : routes.get(`${parent.id}>${child.id}`);
      if (!fromCentral && !points) continue;
      const onPath = !dimmed.has(parent.id) && !dimmed.has(child.id);
      const color = highlight && onPath ? KIND_COLOR[kindOf(child.level)] : EDGE_IDLE;
      const marker = { type: MarkerType.ArrowClosed, color, width: 16, height: 16 };
      // Las flechas siguen el sentido causa → problema → efecto.
      out.push({
        id: e.id,
        source: parent.id,
        target: child.id,
        sourceHandle: fromCentral ? (isCause ? 'causas' : 'efectos') : 'side-out',
        targetHandle: fromCentral || toShared ? 'in' : 'side-in',
        ...(points ? { type: 'routed', data: { points } } : { type: 'smoothstep' }),
        focusable: false,
        selectable: false,
        ...(isCause ? { markerStart: marker } : { markerEnd: marker }),
        style: {
          stroke: color,
          strokeWidth: highlight && onPath ? 2.25 : 1.5,
          ...(fromCentral || toShared ? {} : { strokeDasharray: '5 4' }),
          opacity: dimmed.size > 0 && !onPath ? 0.15 : 1,
          transition: 'opacity 300ms ease, stroke 300ms ease',
        },
      });
    }
    return out;
  }, [placedUnder, shared, routes, visible, index, dimmed, selectedId]);

  // Encuadre de cámara ante solicitudes del estado global (selección, filtros, cambio de árbol…).
  const handledSeq = useRef(-1);
  const drawerWasOpen = useRef(drawerOpen);
  useEffect(() => {
    if (paneWidth === 0 || focus.seq === handledSeq.current) return;
    const ids = focus.ids?.filter((id) => visible.has(id) && boxes.has(id)) ?? null;
    if (ids && ids.length === 0) return;
    // Si el Drawer cambia de estado, se espera a que el lienzo termine de redimensionarse.
    const delay = drawerWasOpen.current !== drawerOpen ? DRAWER_TRANSITION_MS : 40;
    drawerWasOpen.current = drawerOpen;
    const first = handledSeq.current === -1;
    handledSeq.current = focus.seq;
    const duration = first ? 0 : 650;
    const t = window.setTimeout(() => {
      if (ids) {
        // Ruta o filtro: se encuadra sin bajar de una escala aún legible.
        void fitView({ nodes: ids.map((id) => ({ id })), padding: FOCUS_PADDING, duration, maxZoom: 1.05, minZoom: READING_ZOOM.min });
        return;
      }
      // Árbol completo: de un vistazo si cabe a escala legible; si no, a lo ancho y centrado en
      // el problema, con desplazamiento vertical hacia causas y efectos.
      const usableW = paneWidth - 2 * SIDE_MARGIN;
      const usableH = paneHeight - TOOLBAR_OFFSET - BOTTOM_MARGIN;
      const fitAll = Math.min(usableW / bounds.width, usableH / bounds.height, READING_ZOOM.max);
      const zoom = fitAll >= READING_ZOOM.min ? fitAll : Math.min(READING_ZOOM.max, Math.max(READING_ZOOM.min, usableW / bounds.width));
      const cy = fitAll >= READING_ZOOM.min ? bounds.y + bounds.height / 2 : 0;
      // El centro visual queda entre la barra flotante y la leyenda.
      void setCenter(bounds.x + bounds.width / 2, cy - (TOOLBAR_OFFSET - BOTTOM_MARGIN) / 2 / zoom, { zoom, duration });
    }, first ? 0 : delay);
    return () => window.clearTimeout(t);
  }, [focus, boxes, bounds, visible, fitView, setCenter, drawerOpen, paneWidth, paneHeight]);

  return (
    <ReactFlow<FlowNode, ProblemFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      // `onNodeClick` = onNodeSelect. Además, React Flow solo habilita eventos de puntero en nodos
      // no seleccionables/arrastrables cuando existe este manejador.
      onNodeClick={(_, node) => {
        if (node.type === 'problem') selectNode(node.id);
      }}
      onPaneClick={() => selectNode(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      zoomOnDoubleClick={false}
      // La rueda desplaza (vertical; Mayús = horizontal); Ctrl + rueda o el gesto de pinza acercan.
      panOnScroll
      zoomOnScroll={false}
      zoomOnPinch
      onlyRenderVisibleElements
      minZoom={0.08}
      maxZoom={1.75}
      proOptions={{ hideAttribution: false }}
      className="bg-slate-50"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#cbd5e1" />
      <Controls position="bottom-left" showInteractive={false} className="!shadow-md" />
      <MiniMap<FlowNode>
        position="bottom-right"
        pannable
        zoomable
        nodeStrokeWidth={0}
        nodeBorderRadius={8}
        nodeColor={(n) => {
          if (n.type === 'panel') return n.data.side === 'causa' ? '#ffedd5' : '#e0f2fe';
          return KIND_COLOR[kindOf(n.data.level)];
        }}
        maskColor="rgba(241, 245, 249, 0.7)"
        className="!rounded-lg !border !border-slate-200 !shadow-md"
      />
      <Legend />
    </ReactFlow>
  );
}
