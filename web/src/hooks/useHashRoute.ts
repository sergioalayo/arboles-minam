import { useSyncExternalStore } from 'react';
import { TREE_BY_ID } from '@/data/trees';

/** Vista activa: `#/` (Vista Panorámica) o `#/mesa/<treeId>` (árbol interactivo). */
export type Route = { view: 'overview' } | { view: 'tree'; treeId: string };

const TREE_HASH = /^#\/mesa\/([\w-]+)$/;

export function parseHash(hash: string): Route {
  const id = TREE_HASH.exec(hash)?.[1];
  return id && TREE_BY_ID.has(id) ? { view: 'tree', treeId: id } : { view: 'overview' };
}

export function routeHref(route: Route): string {
  return route.view === 'tree' ? `#/mesa/${route.treeId}` : '#/';
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
