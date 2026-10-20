import { useEffect, useState } from 'react';
import type { TreeIndex } from '@/lib/graph';
import { layoutTree, type Positions } from '@/lib/layout';

interface LayoutState {
  key: string;
  positions: Positions;
}

export interface TreeLayout {
  positions: Positions;
  /** `false` mientras se muestra el layout previo y se calcula el del conjunto visible actual. */
  isCurrent: boolean;
}

const cache = new Map<string, Positions>();

function layoutKey(index: TreeIndex, visible: Set<string>): string {
  return `${index.tree.id}|${[...visible].sort().join(',')}`;
}

/**
 * Calcula (o recupera de caché) el layout ELK del conjunto visible. Mientras se calcula un
 * nuevo layout se conserva el anterior del mismo árbol para evitar parpadeos.
 */
export function useTreeLayout(index: TreeIndex, visible: Set<string>): TreeLayout | null {
  const key = layoutKey(index, visible);
  const [state, setState] = useState<LayoutState | null>(() => {
    const cached = cache.get(key);
    return cached ? { key, positions: cached } : null;
  });

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setState({ key, positions: cached });
      return;
    }
    let cancelled = false;
    layoutTree(index, visible)
      .then((positions) => {
        cache.set(key, positions);
        if (!cancelled) setState({ key, positions });
      })
      .catch((err: unknown) => {
        console.error('Error de layout ELK', err);
      });
    return () => {
      cancelled = true;
    };
    // `key` resume `index` y `visible`.
  }, [key]);

  if (!state || !state.key.startsWith(`${index.tree.id}|`)) return null;
  return { positions: state.positions, isCurrent: state.key === key };
}
