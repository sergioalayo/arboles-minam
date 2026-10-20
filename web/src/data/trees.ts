import raw from '@data/arboles.json';
import rawOrganos from '@data/organos.json';
import type { NodeType, OrganoCatalog, ProblemTree, RootData, Severidad } from '@/types/tree';

const NODE_TYPES: ReadonlySet<string> = new Set<NodeType>([
  'efecto_indirecto',
  'efecto_directo',
  'problema_central',
  'causa_directa',
  'causa_indirecta',
]);
const SEVERIDADES: ReadonlySet<string> = new Set<Severidad>(['critica', 'moderada', 'baja']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Verificación en tiempo de ejecución del contrato `RootData` (la validación completa está en scripts/). */
function parseRootData(value: unknown): RootData {
  if (!isObject(value) || !Array.isArray(value.arboles)) {
    throw new Error('arboles.json: se esperaba { arboles: ProblemTree[] }');
  }
  for (const tree of value.arboles as unknown[]) {
    if (!isObject(tree) || !Array.isArray(tree.nodes) || !Array.isArray(tree.edges)) {
      throw new Error('arboles.json: árbol con estructura inválida');
    }
    for (const n of tree.nodes as unknown[]) {
      if (
        !isObject(n) ||
        !NODE_TYPES.has(String(n.type)) ||
        !SEVERIDADES.has(String(n.severidad)) ||
        typeof n.severidad_manual !== 'boolean'
      ) {
        throw new Error(`arboles.json: nodo inválido en el árbol ${String(tree.id)}`);
      }
    }
  }
  return value as unknown as RootData;
}

export const ROOT: RootData = parseRootData(raw);
export const TREES: readonly ProblemTree[] = ROOT.arboles;
export const TREE_BY_ID: ReadonlyMap<string, ProblemTree> = new Map(TREES.map((t) => [t.id, t]));

export const ORGANOS: OrganoCatalog = rawOrganos satisfies OrganoCatalog;
