import { ORGANOS } from '@/data/trees';
import type { NodeType, Severidad } from '@/types/tree';

/** Colores de identidad por tipo (docs/data-schema.md). */
export const TYPE_COLOR: Record<NodeType, string> = {
  efecto_indirecto: '#4338ca',
  efecto_directo: '#0369a1',
  problema_central: '#0f172a',
  causa_directa: '#c2410c',
  causa_indirecta: '#b91c1c',
};

/** Clases estáticas (Tailwind requiere nombres completos en el código fuente). */
export const TYPE_CLASSES: Record<NodeType, { accent: string; eyebrow: string; soft: string }> = {
  efecto_indirecto: { accent: 'border-l-[#4338ca]', eyebrow: 'text-[#4338ca]', soft: 'bg-indigo-50 text-[#4338ca]' },
  efecto_directo: { accent: 'border-l-[#0369a1]', eyebrow: 'text-[#0369a1]', soft: 'bg-sky-50 text-[#0369a1]' },
  problema_central: { accent: 'border-l-amber-400', eyebrow: 'text-amber-300', soft: 'bg-slate-100 text-slate-900' },
  causa_directa: { accent: 'border-l-[#c2410c]', eyebrow: 'text-[#c2410c]', soft: 'bg-orange-50 text-[#c2410c]' },
  causa_indirecta: { accent: 'border-l-[#b91c1c]', eyebrow: 'text-[#b91c1c]', soft: 'bg-red-50 text-[#b91c1c]' },
};

export const SEVERIDAD_CLASSES: Record<Severidad, { dot: string; text: string; ring: string }> = {
  critica: { dot: 'bg-red-600', text: 'text-red-700', ring: 'ring-red-200' },
  moderada: { dot: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200' },
  baja: { dot: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200' },
};

/** Paleta de badges por unidad orgánica / organismo adscrito. */
const ORGANO_BADGE: Record<string, string> = {
  DM: 'bg-slate-800 text-white',
  SG: 'bg-slate-200 text-slate-800',
  VMGA: 'bg-teal-100 text-teal-800',
  VMDERN: 'bg-lime-100 text-lime-800',
  OGPP: 'bg-violet-100 text-violet-800',
  DGRS: 'bg-teal-100 text-teal-800',
  DGCCA: 'bg-cyan-100 text-cyan-800',
  DGCA: 'bg-cyan-100 text-cyan-800',
  DGB: 'bg-green-100 text-green-800',
  DGOTA: 'bg-lime-100 text-lime-800',
  DGCF: 'bg-lime-100 text-lime-800',
  OEFA: 'bg-blue-100 text-blue-800',
  SERNANP: 'bg-emerald-100 text-emerald-800',
  SENAMHI: 'bg-sky-100 text-sky-800',
  IIAP: 'bg-green-100 text-green-800',
  INAIGEM: 'bg-indigo-100 text-indigo-800',
  SENACE: 'bg-amber-100 text-amber-900',
};

export function organoBadge(organo: string): string {
  return ORGANO_BADGE[organo] ?? 'bg-stone-100 text-stone-700';
}

export function organoShort(organo: string): string {
  return organo === 'Transversal / Sectorial' ? 'Transversal' : organo;
}

/** Nombre completo para tooltips: «DGCCA — Dirección General de … (VMDERN)». */
export function organoTooltip(organo: string): string {
  const info = ORGANOS[organo];
  if (!info) return organo;
  const dep = info.dependencia ? ` · ${info.dependencia}` : '';
  return organo === 'Transversal / Sectorial' ? `${organo}: ${info.nombre}` : `${organo} — ${info.nombre}${dep}`;
}
