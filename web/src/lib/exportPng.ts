import type { Rect } from '@xyflow/react';
import { toCanvas } from 'html-to-image';

/** Margen alrededor del grafo y lado máximo del PNG (en píxeles físicos). */
const PAD = 64;
const MAX_SIDE_PX = 12000;
const MAX_PIXEL_RATIO = 3;
const BACKGROUND = '#f8fafc';

export interface ExportOptions {
  /** Rectángulo de los nodos visibles (`useReactFlow().getNodesBounds`). */
  bounds: Rect;
  title: string;
  subtitle: string;
  fileName: string;
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Exporta los nodos visibles (con su atenuación por filtros o ruta seleccionada) a un PNG de alta
 * resolución con encabezado. Renderiza el viewport de React Flow a escala 1 sobre el rectángulo
 * de los nodos, de modo que el resultado no depende del zoom ni del paneo de pantalla.
 */
export async function exportViewToPng({ bounds, title, subtitle, fileName }: ExportOptions): Promise<void> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || bounds.width === 0) throw new Error('No hay un grafo visible para exportar');

  const width = Math.ceil(bounds.width + PAD * 2);
  const height = Math.ceil(bounds.height + PAD * 2);
  const pixelRatio = Math.max(1, Math.min(MAX_PIXEL_RATIO, MAX_SIDE_PX / Math.max(width, height)));

  const graph = await toCanvas(viewport, {
    backgroundColor: BACKGROUND,
    width,
    height,
    pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PAD - bounds.x}px, ${PAD - bounds.y}px) scale(1)`,
    },
    filter: (el) => !(el instanceof HTMLElement && el.classList.contains('react-flow__handle')),
  });

  // Encabezado institucional sobre el grafo.
  const headerH = Math.round(104 * pixelRatio);
  const out = document.createElement('canvas');
  out.width = graph.width;
  out.height = graph.height + headerH;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, out.width, Math.round(6 * pixelRatio));
  const x = PAD * pixelRatio;
  const font = getComputedStyle(document.body).fontFamily;
  ctx.fillStyle = '#0f172a';
  ctx.font = `600 ${Math.round(28 * pixelRatio)}px ${font}`;
  ctx.fillText(title, x, Math.round(54 * pixelRatio));
  ctx.fillStyle = '#475569';
  ctx.font = `${Math.round(15 * pixelRatio)}px ${font}`;
  ctx.fillText(subtitle, x, Math.round(84 * pixelRatio));
  ctx.drawImage(graph, 0, headerH);

  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar el PNG');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(fileName)}.png`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
