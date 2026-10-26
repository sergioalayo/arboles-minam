import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Network, ZoomOut } from 'lucide-react';
import { BranchScene, MesaScene, MesasScene, ProblemScene } from '@/components/explore/Scenes';
import { HEADER_BUTTON, MesaHeader, type Crumb } from '@/components/MesaHeader';
import { HOME, navigate, parentRoute, sceneKey, type ExploreRoute } from '@/hooks/useHashRoute';
import { mesaNumber, zoomableSiblings } from '@/lib/explore';
import { MESA_BY_ID } from '@/lib/overview';
import { KIND_LABEL, kindOf } from '@/lib/theme';
import { zoomTransition } from '@/lib/zoom';
import { getIndex, useTreeActions } from '@/state/TreeStore';

function Scene({ route }: { route: ExploreRoute }) {
  const group = route.mesa ? MESA_BY_ID.get(route.mesa) : undefined;
  if (!group) return <MesasScene />;
  const { treeId } = route;
  if (treeId === null) return <MesaScene group={group} />;
  return route.path.length === 0 ? <ProblemScene route={{ ...route, treeId }} /> : <BranchScene route={{ ...route, treeId }} />;
}

function crumbsOf(route: ExploreRoute): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Todas las mesas', route: HOME }];
  if (!route.mesa) return crumbs;
  crumbs.push({ label: `Mesa ${mesaNumber(route.mesa)}`, route: { ...HOME, mesa: route.mesa } });
  if (!route.treeId) return crumbs;
  const index = getIndex(route.treeId);
  crumbs.push({ label: 'Problema central', route: { ...route, path: [] } });
  route.path.forEach((id, i) => {
    const node = index.byId.get(id);
    if (node) crumbs.push({ label: `${KIND_LABEL[kindOf(node.level)]}: ${node.label}`, route: { ...route, path: route.path.slice(0, i + 1) } });
  });
  return crumbs;
}

/** Paso entre hermanas: posición relativa de `b` respecto de `a`, o `undefined` si no lo son. */
function slideBetween(a: ExploreRoute, b: ExploreRoute): 1 | -1 | undefined {
  if (!a.treeId || a.treeId !== b.treeId || a.path.length === 0 || a.path.length !== b.path.length) return undefined;
  if (a.path.slice(0, -1).join('/') !== b.path.slice(0, -1).join('/')) return undefined;
  const ids = zoomableSiblings(getIndex(a.treeId), a.path).map((n) => n.id);
  const from = ids.indexOf(a.path[a.path.length - 1] ?? '');
  const to = ids.indexOf(b.path[b.path.length - 1] ?? '');
  if (from < 0 || to < 0 || from === to) return undefined;
  return to > from ? 1 : -1;
}

/** Ruta de la causa (o efecto) hermana anterior (`-1`) o siguiente (`1`), si existe. */
function siblingRoute(route: ExploreRoute, step: 1 | -1): ExploreRoute | null {
  if (!route.treeId || route.path.length === 0) return null;
  const ids = zoomableSiblings(getIndex(route.treeId), route.path).map((n) => n.id);
  const next = ids[ids.indexOf(route.path[route.path.length - 1] ?? '') + step];
  return next ? { ...route, path: [...route.path.slice(0, -1), next] } : null;
}

interface Layers {
  current: ExploreRoute;
  /** Escena saliente mientras dura la transición de zoom. */
  leaving: ExploreRoute | null;
  seq: number;
}

/**
 * Exploración guiada por zoom semántico: mesas → mesa (eje | problema) → problema central con
 * causas y efectos → causa/efecto con sus causas raíz/efectos indirectos.
 */
export function Explorer({ route }: { route: ExploreRoute }) {
  const actions = useTreeActions();
  const key = sceneKey(route);
  const [layers, setLayers] = useState<Layers>({ current: route, leaving: null, seq: 0 });
  // Estado derivado de la URL: al cambiar de escena, la anterior se conserva para animar la salida.
  if (sceneKey(layers.current) !== key) {
    setLayers({ current: route, leaving: layers.current, seq: layers.seq + 1 });
  }

  const stageRef = useRef<HTMLDivElement>(null);
  const layerEls = useRef(new Map<string, HTMLDivElement>());

  useLayoutEffect(() => {
    const { leaving, current, seq } = layers;
    if (!leaving) return;
    const stage = stageRef.current;
    const from = layerEls.current.get(sceneKey(leaving));
    const to = layerEls.current.get(sceneKey(current));
    const finish = () => setLayers((l) => (l.seq === seq ? { ...l, leaving: null } : l));
    const anims =
      stage && from && to ? zoomTransition(stage, from, to, sceneKey(leaving), sceneKey(current), slideBetween(leaving, current)) : [];
    if (anims.length === 0) {
      finish();
      return;
    }
    let cancelled = false;
    void Promise.all(anims.map((a) => a.finished))
      .then(() => {
        if (!cancelled) finish();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      for (const a of anims) a.cancel();
    };
  }, [layers]);

  const up = parentRoute(route);
  const prev = siblingRoute(route, -1);
  const next = siblingRoute(route, 1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      // Esc aleja un nivel; ← / → pasan a la causa (o efecto) anterior / siguiente.
      const target = e.key === 'Escape' ? up : e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : null;
      if (!target) return;
      e.preventDefault();
      navigate(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [up, prev, next]);

  const group = route.mesa ? (MESA_BY_ID.get(route.mesa) ?? null) : null;
  // La Vista general abre el árbol en foco (o el primero de la mesa).
  const generalTreeId = route.treeId ?? group?.summaries[0]?.tree.id ?? null;

  const shown = layers.leaving ? [layers.leaving, layers.current] : [layers.current];
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-900">
      <MesaHeader
        group={group}
        treeId={route.treeId}
        crumbs={crumbsOf(route)}
        actions={
          <>
            <button
              type="button"
              onClick={() => up && navigate(up)}
              disabled={!up}
              title="Alejar un nivel (Esc)"
              className={`${HEADER_BUTTON} bg-white/10 text-white hover:bg-white/20`}
            >
              <ZoomOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Alejar</span>
            </button>
            {generalTreeId && (
              <button
                type="button"
                onClick={() => {
                  // Se selecciona antes del cambio de hash: el lienzo se monta ya con el árbol destino.
                  actions.selectTree(generalTreeId);
                  navigate({ view: 'general', treeId: generalTreeId });
                }}
                title="Ver el árbol completo expandido, con todos los cuadros legibles"
                className={`${HEADER_BUTTON} bg-amber-400 text-slate-900 hover:bg-amber-300`}
              >
                <Network className="size-4" aria-hidden />
                Vista general
              </button>
            )}
          </>
        }
      />
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        {shown.map((r) => {
          const k = sceneKey(r);
          const leaving = r === layers.leaving;
          return (
            <div
              key={k}
              ref={(el) => {
                if (el) layerEls.current.set(k, el);
                else layerEls.current.delete(k);
              }}
              aria-hidden={leaving || undefined}
              inert={leaving}
              className="absolute inset-0 origin-top-left overflow-y-auto overflow-x-hidden"
            >
              <Scene route={r} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
