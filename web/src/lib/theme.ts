/**
 * Nomenclatura por nivel del marco lógico: hasta tres niveles de causas (directas, indirectas y
 * raíz) y de efectos (directos, indirectos y finales). Si una rama tiene dos niveles, solo hay
 * directos e indirectos. El nivel determina la denominación (el `type` del JSON agrupa los
 * niveles ≥ 2 como «indirectos»).
 */
export type NodeKind =
  | 'efecto_final'
  | 'efecto_indirecto'
  | 'efecto_directo'
  | 'problema_central'
  | 'causa_directa'
  | 'causa_indirecta'
  | 'causa_raiz';

export function kindOf(level: number): NodeKind {
  if (level === 0) return 'problema_central';
  if (level > 0) return level === 1 ? 'causa_directa' : level === 2 ? 'causa_indirecta' : 'causa_raiz';
  return level === -1 ? 'efecto_directo' : level === -2 ? 'efecto_indirecto' : 'efecto_final';
}

/** Orden de lectura del árbol, de arriba (efectos finales) a abajo (causas raíz). */
export const KINDS: readonly NodeKind[] = [
  'efecto_final',
  'efecto_indirecto',
  'efecto_directo',
  'problema_central',
  'causa_directa',
  'causa_indirecta',
  'causa_raiz',
];

export const KIND_LABEL: Record<NodeKind, string> = {
  efecto_final: 'Efecto final',
  efecto_indirecto: 'Efecto indirecto',
  efecto_directo: 'Efecto directo',
  problema_central: 'Problema central',
  causa_directa: 'Causa directa',
  causa_indirecta: 'Causa indirecta',
  causa_raiz: 'Causa raíz',
};

const KIND_NOUN: Record<NodeKind, [string, string]> = {
  efecto_final: ['efecto final', 'efectos finales'],
  efecto_indirecto: ['efecto indirecto', 'efectos indirectos'],
  efecto_directo: ['efecto directo', 'efectos directos'],
  problema_central: ['problema central', 'problemas centrales'],
  causa_directa: ['causa directa', 'causas directas'],
  causa_indirecta: ['causa indirecta', 'causas indirectas'],
  causa_raiz: ['causa raíz', 'causas raíz'],
};

/** «1 causa raíz», «3 efectos indirectos». */
export function kindCount(kind: NodeKind, n: number): string {
  const [one, many] = KIND_NOUN[kind];
  return `${n} ${n === 1 ? one : many}`;
}

/** Sustantivo en minúsculas («causas indirectas»), según la cantidad. */
export function kindNoun(kind: NodeKind, n: number): string {
  const [one, many] = KIND_NOUN[kind];
  return n === 1 ? one : many;
}

/** Colores de identidad por nivel (docs/data-schema.md; raíz y final, un tono más profundo). */
export const KIND_COLOR: Record<NodeKind, string> = {
  efecto_final: '#312e81',
  efecto_indirecto: '#4338ca',
  efecto_directo: '#0369a1',
  problema_central: '#0f172a',
  causa_directa: '#c2410c',
  causa_indirecta: '#b91c1c',
  causa_raiz: '#7f1d1d',
};

/**
 * Clases estáticas (Tailwind requiere nombres completos en el código fuente). En la Vista general
 * cada nivel se distingue por tres señales a la vez: el tono, la etiqueta (`badge`: sólida en
 * directos y en raíz / finales, suave en indirectos) y la superficie de la tarjeta (`card`: blanca
 * en directos e indirectos, teñida en raíz / finales).
 */
export const KIND_CLASSES: Record<NodeKind, { accent: string; eyebrow: string; soft: string; badge: string; card: string }> = {
  efecto_final: {
    accent: 'border-l-[#312e81]',
    eyebrow: 'text-[#312e81]',
    soft: 'bg-indigo-100 text-[#312e81]',
    badge: 'bg-[#312e81] text-white',
    card: 'border-indigo-300 bg-indigo-100',
  },
  efecto_indirecto: {
    accent: 'border-l-[#4338ca]',
    eyebrow: 'text-[#4338ca]',
    soft: 'bg-indigo-50 text-[#4338ca]',
    badge: 'bg-indigo-50 text-[#4338ca] ring-1 ring-inset ring-indigo-300',
    card: 'border-slate-200 bg-white',
  },
  efecto_directo: {
    accent: 'border-l-[#0369a1]',
    eyebrow: 'text-[#0369a1]',
    soft: 'bg-sky-50 text-[#0369a1]',
    badge: 'bg-[#0369a1] text-white',
    card: 'border-sky-300 bg-white',
  },
  problema_central: {
    accent: 'border-l-amber-400',
    eyebrow: 'text-amber-300',
    soft: 'bg-slate-100 text-slate-900',
    badge: 'bg-amber-400 text-slate-900',
    card: 'border-slate-700 bg-slate-900',
  },
  causa_directa: {
    accent: 'border-l-[#c2410c]',
    eyebrow: 'text-[#c2410c]',
    soft: 'bg-orange-50 text-[#c2410c]',
    badge: 'bg-[#c2410c] text-white',
    card: 'border-orange-300 bg-white',
  },
  causa_indirecta: {
    accent: 'border-l-[#b91c1c]',
    eyebrow: 'text-[#b91c1c]',
    soft: 'bg-red-50 text-[#b91c1c]',
    badge: 'bg-red-50 text-[#b91c1c] ring-1 ring-inset ring-red-300',
    card: 'border-slate-200 bg-white',
  },
  causa_raiz: {
    accent: 'border-l-[#7f1d1d]',
    eyebrow: 'text-[#7f1d1d]',
    soft: 'bg-red-100 text-[#7f1d1d]',
    badge: 'bg-[#7f1d1d] text-white',
    card: 'border-red-300 bg-red-100',
  },
};

/** Denominación corta, en línea al inicio del texto de las tarjetas compactas. */
export const KIND_SHORT: Record<NodeKind, string> = {
  efecto_final: 'Final',
  efecto_indirecto: 'Indirecto',
  efecto_directo: 'Directo',
  problema_central: 'Problema',
  causa_directa: 'Directa',
  causa_indirecta: 'Indirecta',
  causa_raiz: 'Raíz',
};
