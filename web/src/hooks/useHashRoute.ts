import { useSyncExternalStore } from 'react';
import { TREE_BY_ID } from '@/data/trees';

/** Vista activa: `#/` o `#/mesas` (Vista Panorámica), `#/roadmap` (Hoja de Ruta) o `#/mesa/<treeId>` (árbol). */
export type Route = { view: 'overview' } | { view: 'roadmap' } | { view: 'tree'; treeId: string };

const TREE_HASH = /^#\/mesa\/([\w-]+)$/;

export function parseHash(hash: string): Route {
  if (hash === '#/roadmap') return { view: 'roadmap' };
  const id = TREE_HASH.exec(hash)?.[1];
  return id && TREE_BY_ID.has(id) ? { view: 'tree', treeId: id } : { view: 'overview' };
}

export function routeHref(route: Route): string {
  if (route.view === 'tree') return `#/mesa/${route.treeId}`;
  return route.view === 'roadmap' ? '#/roadmap' : '#/';
}

/** Navega añadiendo una entrada al historial (los botones Atrás/Adelante del navegador funcionan). */
export function navigate(route: Route): void {
  const href = routeHref(route);
  if (window.location.hash !== href) window.location.hash = href;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;

/** Enrutado por hash: no requiere reescrituras en el hosting estático (Vercel). */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return parseHash(hash);
}
