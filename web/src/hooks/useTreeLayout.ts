import { useMemo } from 'react';
import type { TreeIndex } from '@/lib/graph';
import { LEGIBLE_ZOOM, layoutTree, type TreeLayout, type Viewport } from '@/lib/layout';

const cache = new Map<string, TreeLayout>();

/** Área útil de referencia: la ventana sin cabecera ni barra flotante (no cambia al abrir el Drawer). */
const CHROME_HEIGHT = 200;
const CHROME_WIDTH = 64;
/** Redondeo del área para reutilizar layouts ante pequeños cambios de tamaño. */
const BUCKET = 80;

function referenceViewport(): Viewport {
  const round = (v: number) => Math.max(BUCKET, Math.round(v / BUCKET) * BUCKET);
  return { width: round(window.innerWidth - CHROME_WIDTH), height: round(window.innerHeight - CHROME_HEIGHT), minZoom: LEGIBLE_ZOOM };
}

/** Calcula (o recupera de caché) el layout compacto del conjunto visible. */
export function useTreeLayout(index: TreeIndex, visible: Set<string>): TreeLayout {
  const viewport = referenceViewport();
  const key = `${index.tree.id}|${viewport.width}x${viewport.height}|${[...visible].sort().join(',')}`;
  return useMemo(() => {
    let layout = cache.get(key);
    if (!layout) {
      layout = layoutTree(index, visible, viewport);
      cache.set(key, layout);
    }
    return layout;
    // `key` resume `index`, `visible` y el área de referencia.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
