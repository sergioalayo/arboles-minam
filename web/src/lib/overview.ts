import { TREES } from '@/data/trees';
import type { ProblemTree } from '@/types/tree';

/** Métricas de un árbol (problema central de una mesa o sub-eje). */
export interface TreeSummary {
  tree: ProblemTree;
  /** «Mesa 01», «Mesa 11.1». */
  mesaLabel: string;
  causas: number;
  causasDirectas: number;
  efectos: number;
  efectosDirectos: number;
}

function mesaLabel(mesa: string): string {
  const [entero = mesa, ...resto] = mesa.split('.');
  return `Mesa ${[entero.padStart(2, '0'), ...resto].join('.')}`;
}

function summarize(tree: ProblemTree): TreeSummary {
  const causas = tree.nodes.filter((n) => n.level > 0);
  const efectos = tree.nodes.filter((n) => n.level < 0);
  return {
    tree,
    mesaLabel: mesaLabel(tree.mesa),
    causas: causas.length,
    causasDirectas: causas.filter((n) => n.level === 1).length,
    efectos: efectos.length,
    efectosDirectos: efectos.filter((n) => n.level === -1).length,
  };
}

export const SUMMARIES: readonly TreeSummary[] = TREES.map(summarize);

/** Sub-eje de una mesa con varios árboles (p. ej. 11.1 Integridad, 11.2 Talento Humano). */
export interface SubEje {
  summary: TreeSummary;
  /** «A», «B», … según el orden de la mesa. */
  letra: string;
  /** Nombre corto del sub-eje, tomado del paréntesis final del eje («Integridad»). */
  nombre: string;
}

/**
 * Una mesa oficial. Las mesas con varios árboles («11.1», «11.2») se consolidan en una sola;
 * los árboles siguen siendo independientes.
 */
export interface MesaGroup {
  /** Número entero de la mesa («11»). */
  mesa: string;
  mesaLabel: string;
  eje: string;
  /** Vacío si la mesa tiene un único árbol. */
  subEjes: SubEje[];
  summaries: TreeSummary[];
  causas: number;
  causasDirectas: number;
  efectos: number;
  efectosDirectos: number;
}

const SUB_EJE = /^(.*?)\s*\(([^)]+)\)\s*$/;

function group(mesa: string, summaries: TreeSummary[]): MesaGroup {
  const sum = (k: 'causas' | 'causasDirectas' | 'efectos' | 'efectosDirectos') => summaries.reduce((a, s) => a + s[k], 0);
  const [first] = summaries as [TreeSummary, ...TreeSummary[]];
  const multi = summaries.length > 1;
  return {
    mesa,
    mesaLabel: multi ? mesaLabel(mesa) : first.mesaLabel,
    eje: multi ? (SUB_EJE.exec(first.tree.eje)?.[1] ?? first.tree.eje) : first.tree.eje,
    subEjes: multi
      ? summaries.map((summary, i) => ({
          summary,
          letra: String.fromCharCode(65 + i),
          nombre: SUB_EJE.exec(summary.tree.eje)?.[2] ?? summary.tree.titulo,
        }))
      : [],
    summaries,
    causas: sum('causas'),
    causasDirectas: sum('causasDirectas'),
    efectos: sum('efectos'),
    efectosDirectos: sum('efectosDirectos'),
  };
}

export const MESAS: readonly MesaGroup[] = (() => {
  const byMesa = new Map<string, TreeSummary[]>();
  for (const s of SUMMARIES) {
    const mesa = mesaOfTree(s.tree);
    byMesa.set(mesa, [...(byMesa.get(mesa) ?? []), s]);
  }
  return [...byMesa].map(([mesa, list]) => group(mesa, list));
})();

export const MESA_BY_ID: ReadonlyMap<string, MesaGroup> = new Map(MESAS.map((g) => [g.mesa, g]));

/** Número entero de la mesa a la que pertenece un árbol («11.2» → «11»). */
export function mesaOfTree(tree: ProblemTree): string {
  return tree.mesa.split('.')[0] ?? tree.mesa;
}

/** Sub-eje de un árbol dentro de su mesa (solo en mesas con varios árboles). */
export function subEjeOf(group: MesaGroup, treeId: string): SubEje | undefined {
  return group.subEjes.find((s) => s.summary.tree.id === treeId);
}
