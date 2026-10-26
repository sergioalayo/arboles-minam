import type { TreeIndex } from '@/lib/graph';
import { kindOf, type NodeKind } from '@/lib/theme';
import type { NodeMetadata } from '@/types/tree';

const naturalCompare = new Intl.Collator('es', { numeric: true }).compare;

/** Ramas dependientes de un nodo, en orden documental. */
export function childrenOf(index: TreeIndex, id: string, side?: 'causa' | 'efecto'): NodeMetadata[] {
  return (index.children.get(id) ?? [])
    .map((c) => index.byId.get(c))
    .filter((n): n is NodeMetadata => n !== undefined && (side === undefined || (side === 'causa' ? n.level > 0 : n.level < 0)))
    .sort((a, b) => naturalCompare(a.id, b.id));
}

export interface BranchSummary {
  /** Causas / efectos directos del problema central. */
  direct: NodeMetadata[];
  /** Causas raíz / efectos indirectos (todo nivel más profundo que el directo). */
  deeper: number;
}

export function branchSummary(index: TreeIndex, side: 'causa' | 'efecto'): BranchSummary {
  const direct = childrenOf(index, index.centralId, side);
  const total = index.tree.nodes.filter((n) => (side === 'causa' ? n.level > 0 : n.level < 0)).length;
  return { direct, deeper: total - direct.length };
}

/** Número de nodos más profundos que dependen de `id` (causas raíz o efectos indirectos). */
export function deeperCount(index: TreeIndex, id: string): number {
  return index.descendants.get(id)?.size ?? 0;
}

/** «Mesa 01» → «01»; «11.2» → «11». */
export function mesaNumber(mesa: string): string {
  return (mesa.split('.')[0] ?? mesa).padStart(2, '0');
}

/**
 * Hermanos navegables del nodo enfocado (último de `path`): las ramas del mismo padre y del mismo
 * sentido que tienen a su vez ramas que abrir, en orden documental.
 */
export function zoomableSiblings(index: TreeIndex, path: readonly string[]): NodeMetadata[] {
  const id = path[path.length - 1];
  const node = id ? index.byId.get(id) : undefined;
  if (!node) return [];
  const parent = path.length > 1 ? (path[path.length - 2] ?? index.centralId) : index.centralId;
  return childrenOf(index, parent, node.level > 0 ? 'causa' : 'efecto').filter((n) => (index.children.get(n.id)?.length ?? 0) > 0);
}

/** Denominaciones de la más cercana a la más lejana del problema central. */
const BY_DISTANCE: readonly NodeKind[] = ['causa_directa', 'efecto_directo', 'causa_indirecta', 'efecto_indirecto', 'causa_raiz', 'efecto_final'];

/**
 * Descendencia de `id` agrupada por denominación, del nivel más cercano al más lejano
 * (p. ej. [3 causas indirectas, 1 causa raíz]).
 */
export function deeperByKind(index: TreeIndex, id: string): { kind: NodeKind; count: number }[] {
  const counts = new Map<NodeKind, number>();
  for (const d of index.descendants.get(id) ?? []) {
    const node = index.byId.get(d);
    if (node) counts.set(kindOf(node.level), (counts.get(kindOf(node.level)) ?? 0) + 1);
  }
  return BY_DISTANCE.filter((k) => counts.has(k)).map((kind) => ({ kind, count: counts.get(kind) ?? 0 }));
}

/** Nodos de un lado del árbol agrupados por denominación (para la vista de mesa). */
export function sideByKind(index: TreeIndex, side: 'causa' | 'efecto'): { kind: NodeKind; count: number }[] {
  return deeperByKind(index, index.centralId).filter(({ kind }) => kind.startsWith(side));
}
