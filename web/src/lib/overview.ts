import { TREES } from '@/data/trees';
import { normalize } from '@/lib/graph';
import { TRANSVERSAL } from '@/lib/theme';
import type { ProblemTree } from '@/types/tree';

/** Métricas de una mesa para su tarjeta en la Vista Panorámica. */
export interface TreeSummary {
  tree: ProblemTree;
  /** «Mesa 01», «Mesa 11.1». */
  mesaLabel: string;
  causas: number;
  causasDirectas: number;
  efectos: number;
  efectosDirectos: number;
  /** Órganos con participación causal (nodos de causa), por número de causas; sin «Transversal». */
  organos: [string, number][];
  /** Causas asignadas al diseño sectorial general. */
  causasTransversales: number;
  /** Texto normalizado para la búsqueda rápida. */
  searchText: string;
}

function mesaLabel(mesa: string): string {
  const [entero = mesa, ...resto] = mesa.split('.');
  return `Mesa ${[entero.padStart(2, '0'), ...resto].join('.')}`;
}

function summarize(tree: ProblemTree): TreeSummary {
  const causas = tree.nodes.filter((n) => n.level > 0);
  const efectos = tree.nodes.filter((n) => n.level < 0);
  const byOrgano = new Map<string, number>();
  for (const n of causas) if (n.organo !== TRANSVERSAL) byOrgano.set(n.organo, (byOrgano.get(n.organo) ?? 0) + 1);
  return {
    tree,
    mesaLabel: mesaLabel(tree.mesa),
    causas: causas.length,
    causasDirectas: causas.filter((n) => n.type === 'causa_directa').length,
    efectos: efectos.length,
    efectosDirectos: efectos.filter((n) => n.type === 'efecto_directo').length,
    organos: sortOrganos(byOrgano),
    causasTransversales: causas.length - [...byOrgano.values()].reduce((a, b) => a + b, 0),
    searchText: normalize(`${tree.mesa} ${tree.eje} ${tree.problemaCentral}`),
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
 * Tarjeta de la Vista Panorámica: una mesa oficial. Las mesas con varios árboles («11.1», «11.2»)
 * se consolidan en una sola tarjeta; los árboles siguen siendo independientes en el lienzo.
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
  organos: [string, number][];
  causasTransversales: number;
}

const SUB_EJE = /^(.*?)\s*\(([^)]+)\)\s*$/;

function sortOrganos(m: Map<string, number>): [string, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function group(mesa: string, summaries: TreeSummary[]): MesaGroup {
  const sum = (k: 'causas' | 'causasDirectas' | 'efectos' | 'efectosDirectos' | 'causasTransversales') =>
    summaries.reduce((a, s) => a + s[k], 0);
  const organos = new Map<string, number>();
  for (const s of summaries) for (const [o, n] of s.organos) organos.set(o, (organos.get(o) ?? 0) + n);
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
    organos: sortOrganos(organos),
    causasTransversales: sum('causasTransversales'),
  };
}

export const MESAS: readonly MesaGroup[] = (() => {
  const byMesa = new Map<string, TreeSummary[]>();
  for (const s of SUMMARIES) {
    const mesa = s.tree.mesa.split('.')[0] ?? s.tree.mesa;
    byMesa.set(mesa, [...(byMesa.get(mesa) ?? []), s]);
  }
  return [...byMesa].map(([mesa, list]) => group(mesa, list));
})();

/** Órganos con participación causal en alguna mesa: [sigla, nº de mesas], por cobertura. */
export const ORGANOS_CAUSALES: readonly [string, number][] = (() => {
  const m = new Map<string, number>();
  for (const g of MESAS) for (const [o] of g.organos) m.set(o, (m.get(o) ?? 0) + 1);
  return sortOrganos(m);
})();

/** Un árbol coincide con la búsqueda (normalizada, ≥ 2 caracteres) y el filtro de órgano. */
export function summaryMatches(s: TreeSummary, q: string, organo: string | null): boolean {
  return (q.length < 2 || s.searchText.includes(q)) && (organo === null || s.organos.some(([o]) => o === organo));
}

/**
 * Divide `text` en tramos alternos [normal, coincidencia, normal, …] según `query`, sin distinguir
 * mayúsculas ni tildes. Se normaliza carácter a carácter para conservar los índices del original.
 */
export function splitMatches(text: string, query: string): string[] {
  const q = normalize(query.trim());
  if (q.length < 2) return [text];
  const map: number[] = [];
  let norm = '';
  for (let i = 0; i < text.length; i++) {
    const c = normalize(text[i] ?? '');
    norm += c;
    for (let k = 0; k < c.length; k++) map.push(i);
  }
  const parts: string[] = [];
  let last = 0;
  for (let at = norm.indexOf(q); at !== -1; at = norm.indexOf(q, at + q.length)) {
    const start = map[at] ?? 0;
    const end = (map[at + q.length - 1] ?? start) + 1;
    parts.push(text.slice(last, start), text.slice(start, end));
    last = end;
  }
  parts.push(text.slice(last));
  return parts;
}
