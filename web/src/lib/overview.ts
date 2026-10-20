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
    organos: [...byOrgano.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    causasTransversales: causas.length - [...byOrgano.values()].reduce((a, b) => a + b, 0),
    searchText: normalize(`${tree.mesa} ${tree.eje} ${tree.problemaCentral}`),
  };
}

export const SUMMARIES: readonly TreeSummary[] = TREES.map(summarize);

/** Órganos con participación causal en alguna mesa: [sigla, nº de mesas], por cobertura. */
export const ORGANOS_CAUSALES: readonly [string, number][] = (() => {
  const m = new Map<string, number>();
  for (const s of SUMMARIES) for (const [o] of s.organos) m.set(o, (m.get(o) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
})();

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
