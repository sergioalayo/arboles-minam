/**
 * Transición de zoom entre escenas de la exploración guiada. Cada elemento que abre una escena
 * más profunda lleva `data-zoom="<clave de la escena>"`: al acercar, la escena actual se amplía
 * hasta que ese elemento cubre la pantalla mientras la nueva crece desde él; al alejar, a la inversa.
 * Entre causas (o efectos) hermanas, la escena se desliza lateralmente.
 * Solo se animan `transform` y `opacity` (composición en GPU).
 */

const DURATION = 620;
const EASING = 'cubic-bezier(0.5, 0, 0.15, 1)';

/** `a` es una escena ancestro de `b` (la clave vacía es la raíz: la vista de mesas). */
export function isAncestorKey(a: string, b: string): boolean {
  return a === '' ? b !== '' : b.startsWith(`${a}/`);
}

/** Elemento de `layer` que conduce hacia `deepKey`: el de clave más larga que la contiene. */
function findTarget(layer: HTMLElement, deepKey: string): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestLength = -1;
  for (const el of layer.querySelectorAll<HTMLElement>('[data-zoom]')) {
    const key = el.dataset.zoom ?? '';
    if ((key === deepKey || isAncestorKey(key, deepKey)) && key.length > bestLength) {
      best = el;
      bestLength = key.length;
    }
  }
  return best;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function run(el: HTMLElement, transform: [string, string], opacity: [number, number], fill: FillMode): Animation[] {
  el.style.willChange = 'transform, opacity';
  const opts: KeyframeAnimationOptions = { duration: DURATION, easing: EASING, fill };
  const fading = opacity[0] > opacity[1];
  const anims = [
    el.animate({ transform }, opts),
    // La escena saliente se desvanece al inicio; la entrante aparece mientras se acerca.
    el.animate(
      fading
        ? [{ opacity: opacity[0] }, { opacity: opacity[0], offset: 0.1 }, { opacity: opacity[1], offset: 0.5 }, { opacity: opacity[1] }]
        : [{ opacity: opacity[0] }, { opacity: opacity[0], offset: 0.2 }, { opacity: opacity[1], offset: 0.65 }, { opacity: opacity[1] }],
      { ...opts, easing: 'linear' },
    ),
  ];
  void Promise.allSettled(anims.map((a) => a.finished)).then(() => {
    el.style.willChange = '';
  });
  return anims;
}

/**
 * Anima el paso de la escena `from` (clave `fromKey`) a `to` (clave `toKey`) dentro de `stage`.
 * Devuelve las animaciones en curso (vacío si no hay movimiento).
 */
export function zoomTransition(
  stage: HTMLElement,
  from: HTMLElement,
  to: HTMLElement,
  fromKey: string,
  toKey: string,
  /** Entre escenas hermanas: 1 = la siguiente entra por la derecha; -1 = la anterior, por la izquierda. */
  slide?: 1 | -1,
): Animation[] {
  if (prefersReducedMotion()) return [];
  const zoomIn = isAncestorKey(fromKey, toKey);
  const zoomOut = isAncestorKey(toKey, fromKey);
  const shallow = zoomIn ? from : to;
  const deep = zoomIn ? to : from;
  const target = zoomIn || zoomOut ? findTarget(shallow, zoomIn ? toKey : fromKey) : null;

  if (!target && slide) {
    // Causa/efecto hermano: desplazamiento lateral, como pasar de diapositiva.
    const d = slide * 12;
    return [
      ...run(from, ['translateX(0%)', `translateX(${-d}%)`], [1, 0], 'forwards'),
      ...run(to, [`translateX(${d}%)`, 'translateX(0%)'], [0, 1], 'backwards'),
    ];
  }
  if (!target) {
    // Escenas hermanas (p. ej. otro sub-eje): fundido con un leve acercamiento.
    return [
      ...run(from, ['scale(1)', 'scale(1.04)'], [1, 0], 'forwards'),
      ...run(to, ['scale(0.96)', 'scale(1)'], [0, 1], 'backwards'),
    ];
  }

  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const s = stage.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const cx = r.left - s.left + r.width / 2;
  const cy = r.top - s.top + r.height / 2;
  // La escena profunda, reducida por `k`, cabe exactamente dentro del elemento de origen.
  const k = Math.max(Math.min(r.width / W, r.height / H), 0.02);
  const small = `translate(${cx - (k * W) / 2}px, ${cy - (k * H) / 2}px) scale(${k})`;
  const big = `translate(${W / 2 - cx / k}px, ${H / 2 - cy / k}px) scale(${1 / k})`;
  const rest = 'translate(0px, 0px) scale(1)';

  // La escena profunda siempre queda por encima: crece desde (o se contrae hacia) su tarjeta.
  shallow.style.zIndex = '1';
  deep.style.zIndex = '2';
  return zoomIn
    ? [...run(from, [rest, big], [1, 0], 'forwards'), ...run(to, [small, rest], [0, 1], 'backwards')]
    : [...run(from, [rest, small], [1, 0], 'forwards'), ...run(to, [big, rest], [0, 1], 'backwards')];
}
