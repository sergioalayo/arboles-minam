import { useSyncExternalStore } from 'react';
import { TREE_BY_ID } from '@/data/trees';
import { MESA_BY_ID, mesaOfTree } from '@/lib/overview';
import { getIndex } from '@/state/TreeStore';

/**
 * Exploración guiada por zoom: mesas → mesa → problema central → causa/efecto (→ …).
 * `path` es la cadena de nodos enfocados desde el problema central (cada uno hijo del anterior).
 */
export interface ExploreRoute {
  view: 'explore';
  mesa: string | null;
  treeId: string | null;
  path: string[];
}

/**
 * Vistas: `#/` (mesas), `#/mesa/<mesa>[/<treeId>[/<nodo>…]]` (exploración guiada),
 * `#/general/<treeId>` (Vista general expandida) y `#/roadmap` (Hoja de Ruta).
 */
export type Route = ExploreRoute | { view: 'roadmap' } | { view: 'general'; treeId: string };

export const HOME: ExploreRoute = { view: 'explore', mesa: null, treeId: null, path: [] };

/** Valida la cadena de nodos: cada uno debe ser hijo del anterior y tener ramas que abrir. */
function validPath(treeId: string, ids: string[]): string[] {
  const index = getIndex(treeId);
  const out: string[] = [];
  let parent = index.centralId;
  for (const id of ids) {
    if (!(index.children.get(parent) ?? []).includes(id) || (index.children.get(id)?.length ?? 0) === 0) break;
    out.push(id);
    parent = id;
  }
  return out;
}

function parseExplore(segments: string[]): ExploreRoute {
  const [first, ...rest] = segments;
  if (!first) return HOME;
  // Compatibilidad con enlaces previos `#/mesa/<treeId>`.
  const legacy = TREE_BY_ID.get(first);
  if (legacy) return { view: 'explore', mesa: mesaOfTree(legacy), treeId: legacy.id, path: validPath(legacy.id, rest) };
  const group = MESA_BY_ID.get(first);
  if (!group) return HOME;
  const [treeId, ...path] = rest;
  if (!treeId || !group.summaries.some((s) => s.tree.id === treeId)) return { ...HOME, mesa: group.mesa };
  return { view: 'explore', mesa: group.mesa, treeId, path: validPath(treeId, path) };
}

export function parseHash(hash: string): Route {
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, ...rest] = segments;
  if (head === 'roadmap') return { view: 'roadmap' };
  if (head === 'general' && rest[0] && TREE_BY_ID.has(rest[0])) return { view: 'general', treeId: rest[0] };
  if (head === 'mesa') return parseExplore(rest);
  return HOME;
}

/** Clave jerárquica de una escena de exploración («», «1», «1/m1», «1/m1/m1-c2»…). */
export function sceneKey(route: ExploreRoute): string {
  return [route.mesa, route.treeId, ...route.path].filter((s): s is string => s !== null).join('/');
}

/** Escena inmediatamente superior (un nivel de zoom menos). */
export function parentRoute(route: ExploreRoute): ExploreRoute | null {
  if (route.path.length > 0) return { ...route, path: route.path.slice(0, -1) };
  if (route.treeId !== null) return { ...route, treeId: null };
  if (route.mesa !== null) return HOME;
  return null;
}

export function routeHref(route: Route): string {
  if (route.view === 'roadmap') return '#/roadmap';
  if (route.view === 'general') return `#/general/${route.treeId}`;
  const key = sceneKey(route);
  return key ? `#/mesa/${key}` : '#/';
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
