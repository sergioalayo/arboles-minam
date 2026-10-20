import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import type { TreeIndex } from '@/lib/graph';

/** Dimensiones fijas de las tarjetas (ver CustomNode): `w-72` y `w-80` para el problema central. */
export const NODE_SIZE = { width: 288, height: 168 } as const;
export const CENTRAL_SIZE = { width: 320, height: 176 } as const;

export interface XY {
  x: number;
  y: number;
}

export type Positions = Map<string, XY>;

const elk = new ELK();

const BASE_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '84',
  'elk.spacing.nodeNode': '28',
  'elk.layered.spacing.edgeNodeBetweenLayers': '24',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  // Respeta el orden documental (IDs jerárquicos) para que la lectura coincida con el insumo.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  // Cada nivel del marco lógico ocupa su propia capa.
  'elk.partitioning.activate': 'true',
  'elk.edgeRouting': 'ORTHOGONAL',
};

const naturalCompare = new Intl.Collator('es', { numeric: true }).compare;

function sizeOf(index: TreeIndex, id: string) {
  return id === index.centralId ? CENTRAL_SIZE : NODE_SIZE;
}

/**
 * Sub-árbol dirigido desde el problema central hacia una de sus ramas.
 * Las aristas se expresan siempre padre → hijo (más cercano → más lejano al centro).
 */
function subgraph(index: TreeIndex, visible: Set<string>, side: 'efecto' | 'causa'): ElkNode {
  const ids = [...visible]
    .filter((id) => {
      const lv = index.byId.get(id)?.level ?? 0;
      return id === index.centralId || (side === 'causa' ? lv > 0 : lv < 0);
    })
    .sort(naturalCompare);
  const idSet = new Set(ids);
  const edges = ids.flatMap((parent) =>
    (index.children.get(parent) ?? [])
      .filter((child) => idSet.has(child))
      .map((child) => ({ id: `${parent}>${child}`, sources: [parent], targets: [child] })),
  );
  return {
    id: `root-${side}`,
    layoutOptions: { ...BASE_OPTIONS, 'elk.direction': side === 'causa' ? 'DOWN' : 'UP' },
    children: ids.map((id) => ({
      id,
      ...sizeOf(index, id),
      layoutOptions: { 'elk.partitioning.partition': String(Math.abs(index.byId.get(id)?.level ?? 0)) },
    })),
    edges,
  };
}

/** Traslada un sub-layout para que el problema central quede centrado en el origen. */
function anchorAtOrigin(index: TreeIndex, result: ElkNode, out: Positions): void {
  const central = result.children?.find((c) => c.id === index.centralId);
  const dx = -(central?.x ?? 0) - CENTRAL_SIZE.width / 2;
  const dy = -(central?.y ?? 0) - CENTRAL_SIZE.height / 2;
  for (const c of result.children ?? []) {
    out.set(c.id, { x: (c.x ?? 0) + dx, y: (c.y ?? 0) + dy });
  }
}

/**
 * Layout bi-direccional: efectos con `elk.direction: UP` (semiplano y < 0) y causas con
 * `elk.direction: DOWN` (semiplano y > 0), ambos anclados en el problema central (x = 0, y = 0).
 * Devuelve la esquina superior izquierda de cada nodo (convención de React Flow).
 */
export async function layoutTree(index: TreeIndex, visible: Set<string>): Promise<Positions> {
  const [effects, causes] = await Promise.all([
    elk.layout(subgraph(index, visible, 'efecto')),
    elk.layout(subgraph(index, visible, 'causa')),
  ]);
  const positions: Positions = new Map();
  anchorAtOrigin(index, effects, positions);
  anchorAtOrigin(index, causes, positions);
  positions.set(index.centralId, { x: -CENTRAL_SIZE.width / 2, y: -CENTRAL_SIZE.height / 2 });
  return positions;
}
