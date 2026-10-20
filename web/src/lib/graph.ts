import type { Branch, NodeMetadata, ProblemTree } from '@/types/tree';

/**
 * Índice navegable de un árbol. Las "ramas dependientes" (`children`) de un nodo son, para una
 * causa, las causas más profundas que la explican; para un efecto, los efectos que genera; para
 * el problema central, sus causas y efectos directos. Es un DAG: un nodo puede tener varios padres.
 */
export interface TreeIndex {
  tree: ProblemTree;
  centralId: string;
  byId: Map<string, NodeMetadata>;
  children: Map<string, string[]>;
  parents: Map<string, string[]>;
  descendants: Map<string, Set<string>>;
  /** Nodos con ramas dependientes (candidatos a colapsar), excluido el problema central. */
  collapsible: string[];
}

export function branchOf(level: number): Branch {
  if (level < 0) return 'efecto';
  if (level > 0) return 'causa';
  return 'central';
}

export function buildIndex(tree: ProblemTree): TreeIndex {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>(tree.nodes.map((n) => [n.id, []]));
  const parents = new Map<string, string[]>(tree.nodes.map((n) => [n.id, []]));

  for (const e of tree.edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (!source || !target) continue;
    // Contrato: causas hijo→padre (source = causa hija); efectos padre→hijo (source = efecto padre).
    const [parent, child] = source.level > 0 ? [target.id, source.id] : [source.id, target.id];
    children.get(parent)?.push(child);
    parents.get(child)?.push(parent);
  }

  const descendants = new Map<string, Set<string>>();
  const collect = (id: string): Set<string> => {
    const cached = descendants.get(id);
    if (cached) return cached;
    const acc = new Set<string>();
    descendants.set(id, acc);
    for (const c of children.get(id) ?? []) {
      acc.add(c);
      for (const d of collect(c)) acc.add(d);
    }
    return acc;
  };
  for (const n of tree.nodes) collect(n.id);

  const collapsible = tree.nodes
    .filter((n) => n.id !== tree.problemaCentralId && (children.get(n.id)?.length ?? 0) > 0)
    .map((n) => n.id);

  return { tree, centralId: tree.problemaCentralId, byId, children, parents, descendants, collapsible };
}

/** Estado inicial ejecutivo: solo el problema central con sus causas y efectos directos. */
export function initialCollapsed(index: TreeIndex): Set<string> {
  return new Set(index.collapsible);
}

/** Colapso recursivo: el nodo y toda su descendencia quedan colapsados. */
export function collapseRecursive(index: TreeIndex, collapsed: Set<string>, id: string): Set<string> {
  const next = new Set(collapsed);
  for (const d of [id, ...(index.descendants.get(id) ?? [])]) {
    if ((index.children.get(d)?.length ?? 0) > 0 && d !== index.centralId) next.add(d);
  }
  return next;
}

/** Nodos visibles: alcanzables desde el problema central a través de padres visibles y expandidos. */
export function visibleIds(index: TreeIndex, collapsed: Set<string>): Set<string> {
  const visible = new Set<string>([index.centralId]);
  const queue = [index.centralId];
  while (queue.length) {
    const id = queue.shift() as string;
    if (collapsed.has(id) && id !== index.centralId) continue;
    for (const c of index.children.get(id) ?? []) {
      if (!visible.has(c)) {
        visible.add(c);
        queue.push(c);
      }
    }
  }
  return visible;
}

/** Ascendencia hasta el problema central (todas las rutas, por tratarse de un DAG). */
export function ancestorsOf(index: TreeIndex, id: string): Set<string> {
  const acc = new Set<string>();
  const stack = [...(index.parents.get(id) ?? [])];
  while (stack.length) {
    const p = stack.pop() as string;
    if (acc.has(p)) continue;
    acc.add(p);
    stack.push(...(index.parents.get(p) ?? []));
  }
  return acc;
}

/** Expande la ascendencia de los nodos dados para hacerlos visibles. */
export function reveal(index: TreeIndex, collapsed: Set<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(collapsed);
  for (const id of ids) for (const a of ancestorsOf(index, id)) next.delete(a);
  return next;
}

/** Ruta causal de un nodo: su ascendencia hasta el problema central y toda su descendencia. */
export function causalPath(index: TreeIndex, id: string): Set<string> {
  return new Set([id, ...ancestorsOf(index, id), ...(index.descendants.get(id) ?? [])]);
}

/** Normaliza texto para búsqueda insensible a mayúsculas y tildes. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
