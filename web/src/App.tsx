import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ListTree } from 'lucide-react';
import { Canvas } from '@/components/Canvas';
import { Explorer } from '@/components/explore/Explorer';
import { HEADER_BUTTON, MesaHeader } from '@/components/MesaHeader';
import { NodeDrawer } from '@/components/NodeDrawer';
import { RoadmapView } from '@/components/RoadmapView';
import { Toolbar } from '@/components/Toolbar';
import { TREE_BY_ID } from '@/data/trees';
import { navigate, parseHash, useHashRoute, type Route } from '@/hooks/useHashRoute';
import { mesaNumber } from '@/lib/explore';
import { MESA_BY_ID, mesaOfTree } from '@/lib/overview';
import { TreeStoreProvider, useTreeActions, useTreeView } from '@/state/TreeStore';

const BASE_TITLE = 'Árboles de Problemas · Reorganización MINAM';

/** Vista general: el árbol completo expandido, legible a escala real; se recorre con scroll. */
function Workspace({ route }: { route: Extract<Route, { view: 'general' }> }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedId, treeId, index } = useTreeView();
  const mesa = mesaOfTree(index.tree);
  const group = MESA_BY_ID.get(mesa) ?? null;

  // El árbol también cambia desde el selector y el buscador global: la URL sigue al estado. Solo
  // ante cambios de `treeId` (no al montar): el sentido URL → estado lo resuelve <Shell>.
  const lastTreeId = useRef(treeId);
  useEffect(() => {
    if (lastTreeId.current === treeId) return;
    lastTreeId.current = treeId;
    if (route.treeId !== treeId) navigate({ view: 'general', treeId });
  }, [treeId, route]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <MesaHeader
        group={group}
        treeId={treeId}
        actions={
          <button
            type="button"
            onClick={() => navigate({ view: 'explore', mesa, treeId, path: [] })}
            title="Volver a la exploración guiada por zoom"
            className={`${HEADER_BUTTON} bg-amber-400 text-slate-900 hover:bg-amber-300`}
          >
            <ListTree className="size-4" aria-hidden />
            Vista guiada
          </button>
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* El lienzo se reduce al abrir el Drawer: el panel nunca ocluye el centro del grafo. */}
        <main className="relative min-w-0 flex-1">
          <Toolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          <Canvas searchQuery={searchQuery} drawerOpen={selectedId !== null} />
        </main>
        <NodeDrawer />
      </div>
    </div>
  );
}

function Shell() {
  const route = useHashRoute();
  const { treeId } = useTreeView();
  const actions = useTreeActions();
  const routeTreeId = route.view === 'general' ? route.treeId : null;

  // URL → estado (Atrás/Adelante del navegador o enlace directo). Depende solo de la URL.
  useEffect(() => {
    if (routeTreeId !== null && routeTreeId !== treeId) actions.selectTree(routeTreeId);
  }, [routeTreeId]); // eslint-disable-line react-hooks/exhaustive-deps -- `treeId` no debe disparar la sincronización

  const mesa = route.view === 'explore' ? route.mesa : null;
  useEffect(() => {
    const tree = routeTreeId ? TREE_BY_ID.get(routeTreeId) : undefined;
    const group = mesa ? MESA_BY_ID.get(mesa) : undefined;
    const view =
      route.view === 'roadmap'
        ? 'Hoja de Ruta'
        : tree
          ? `Vista general · ${tree.titulo}`
          : group
            ? `Mesa ${mesaNumber(group.mesa)} · ${group.eje}`
            : 'Diagnóstico por Mesas';
    document.title = `${view} · ${BASE_TITLE}`;
  }, [routeTreeId, mesa, route.view]);

  if (route.view === 'roadmap') return <RoadmapView />;
  if (route.view === 'explore') return <Explorer route={route} />;
  return (
    <ReactFlowProvider>
      <Workspace route={route} />
    </ReactFlowProvider>
  );
}

export default function App() {
  const initial = parseHash(window.location.hash);
  return (
    <TreeStoreProvider initialTreeId={initial.view === 'general' ? initial.treeId : undefined}>
      <Shell />
    </TreeStoreProvider>
  );
}
