/**
 * Métricas de las tarjetas de la Vista general. CustomNode las aplica como estilos en línea y el
 * layout las usa para medir el alto exacto de cada tarjeta según su texto (las tarjetas se ajustan
 * al contenido en lugar de reservar un alto fijo).
 */

export type CardKind = 'central' | 'direct' | 'deep';

interface Metrics {
  weight: number;
  fontSize: number;
  lineHeight: number;
  padX: number;
  padY: number;
  /** Fila superior (denominación, colapso); 0 = esos elementos van en la primera línea. */
  header: number;
  gap: number;
}

export const CARD_METRICS: Record<CardKind, Metrics> = {
  central: { weight: 600, fontSize: 16, lineHeight: 22, padX: 14, padY: 12, header: 20, gap: 6 },
  direct: { weight: 600, fontSize: 13, lineHeight: 17, padX: 10, padY: 7, header: 18, gap: 4 },
  deep: { weight: 500, fontSize: 12.5, lineHeight: 16, padX: 8, padY: 5, header: 0, gap: 0 },
};

/** Elementos en línea de las tarjetas `deep` (ver CustomNode): denominación al inicio, colapso a la derecha. */
export const INLINE_BADGE = { fontSize: 9.5, weight: 700, letterSpacing: 0.5, marginRight: 5 } as const;
export const INLINE_CONTROLS = { toggle: 30, marginLeft: 4 } as const;

/** Bordes: 1 px en general y 4 px en el acento izquierdo. */
const BORDER_X = 5;
const BORDER_Y = 2;

const FALLBACK_FONT = "'Segoe UI Variable Text', 'Segoe UI', Inter, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

let ctx: CanvasRenderingContext2D | null | undefined;
let family: string | undefined;
const lineCache = new Map<string, number>();

function context(): CanvasRenderingContext2D | null {
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
  family ??= getComputedStyle(document.body).fontFamily || FALLBACK_FONT;
  return ctx;
}

function textWidth(c: CanvasRenderingContext2D, text: string, weight: number, size: number): number {
  c.font = `${weight} ${size}px ${family ?? FALLBACK_FONT}`;
  return c.measureText(text).width;
}

/** Líneas que ocupa `text` con ajuste por palabras; la primera línea pierde `firstReserve` px. */
function countLines(text: string, kind: CardKind, width: number, firstReserve: number): number {
  const key = `${kind}|${width}|${firstReserve}|${text}`;
  const cached = lineCache.get(key);
  if (cached !== undefined) return cached;
  const m = CARD_METRICS[kind];
  const c = context();
  let lines = 1;
  if (c) {
    c.font = `${m.weight} ${m.fontSize}px ${family ?? FALLBACK_FONT}`;
    // Pequeño margen: el redondeo del navegador puede partir una línea antes que el canvas.
    const max = width * 0.96;
    let limit = max - firstReserve;
    let current = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (c.measureText(candidate).width <= limit || (!current && limit === max)) current = candidate;
      else {
        lines++;
        current = word;
        limit = max;
      }
    }
  } else {
    lines = Math.ceil((text.length * m.fontSize * 0.55 + firstReserve) / width);
  }
  lineCache.set(key, lines);
  return lines;
}

export interface InlineParts {
  /** Denominación al inicio de la primera línea (se muestra en mayúsculas). */
  badge: string;
  /** Muestra el botón de colapso a la derecha de la primera línea. */
  toggle: boolean;
}

/** Alto exacto de una tarjeta de ancho `width` con el texto dado. */
export function cardHeight(text: string, kind: CardKind, width: number, inline?: InlineParts): number {
  const m = CARD_METRICS[kind];
  let reserve = 0;
  if (inline) {
    const c = context();
    const label = inline.badge.toUpperCase();
    const badge = (c ? textWidth(c, label, INLINE_BADGE.weight, INLINE_BADGE.fontSize) : label.length * 7) + label.length * INLINE_BADGE.letterSpacing;
    reserve = Math.ceil(badge) + INLINE_BADGE.marginRight + (inline.toggle ? INLINE_CONTROLS.toggle + INLINE_CONTROLS.marginLeft : 0);
  }
  const inner = width - BORDER_X - 2 * m.padX;
  return Math.ceil(BORDER_Y + 2 * m.padY + m.header + m.gap + countLines(text, kind, inner, reserve) * m.lineHeight);
}
