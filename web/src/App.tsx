import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '@/components/Canvas';
import { NodeDrawer } from '@/components/NodeDrawer';
import { OverviewGrid, type OverviewFilters } from '@/components/OverviewGrid';
import { RoadmapView } from '@/components/RoadmapView';
import { Toolbar } from '@/components/Toolbar';
import { TREE_BY_ID } from '@/data/trees';
import { navigate, parseHash, useHashRoute, type Route } from '@/hooks/useHashRoute';
import { TreeStoreProvider, useTreeActions, useTreeView } from '@/state/TreeStore';

const BASE_TITLE = 'Árboles de Problemas · Reorganización MINAM';

function Workspace({ route }: { route: Route }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedId, treeId } = useTreeView();

  // El árbol también cambia desde el selector y el buscador global: la URL sigue al estado. Solo
  // ante cambios de `treeId` (no al montar): el sentido URL → estado lo resuelve <Shell>.
  const lastTreeId = useRef(treeId);
  useEffect(() => {
    if (lastTreeId.current === treeId) return;
    lastTreeId.current = treeId;
    if (route.view !== 'tree' || route.treeId !== treeId) navigate({ view: 'tree', treeId });
  }, [treeId, route]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* El lienzo se reduce al abrir el Drawer: el panel nunca ocluye el centro del grafo. */}
      <main className="relative min-w-0 flex-1">
        <Toolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} onBack={() => navigate({ view: 'overview' })} />
        <Canvas searchQuery={searchQuery} drawerOpen={selectedId !== null} />
      </main>
      <NodeDrawer />
    </div>
  );
}

function Shell() {
  const route = useHashRoute();
  const { treeId } = useTreeView();
  const actions = useTreeActions();
  const [filters, setFilters] = useState<OverviewFilters>({ query: '', organo: null });
  const routeTreeId = route.view === 'tree' ? route.treeId : null;

  // URL → estado (Atrás/Adelante del navegador o enlace directo). Depende solo de la URL.
  useEffect(() => {
    if (routeTreeId !== null && routeTreeId !== treeId) actions.selectTree(routeTreeId);
  }, [routeTreeId]); // eslint-disable-line react-hooks/exhaustive-deps -- `treeId` no debe disparar la sincronización

  useEffect(() => {
    const tree = routeTreeId ? TREE_BY_ID.get(routeTreeId) : undefined;
    const view = route.view === 'roadmap' ? 'Hoja de Ruta' : 'Vista Panorámica';
    document.title = tree ? `${tree.titulo} · ${BASE_TITLE}` : `${view} · ${BASE_TITLE}`;
  }, [routeTreeId, route.view]);

  if (route.view === 'roadmap') return <RoadmapView />;

  if (route.view === 'overview') {
    return (
      <OverviewGrid
        filters={filters}
        onFiltersChange={setFilters}
        onOpenTree={(id) => {
          // Se selecciona antes del cambio de hash: el lienzo se monta ya con el árbol destino.
          actions.selectTree(id);
          navigate({ view: 'tree', treeId: id });
        }}
      />
    );
  }
  return (
    <ReactFlowProvider>
      <Workspace route={route} />
    </ReactFlowProvider>
  );
}

export default function App() {
  const initial = parseHash(window.location.hash);
  return (
    <TreeStoreProvider initialTreeId={initial.view === 'tree' ? initial.treeId : undefined}>
      <Shell />
    </TreeStoreProvider>
  );
}
