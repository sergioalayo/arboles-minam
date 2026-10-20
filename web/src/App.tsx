import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '@/components/Canvas';
import { NodeDrawer } from '@/components/NodeDrawer';
import { Toolbar } from '@/components/Toolbar';
import { TreeStoreProvider, useTreeView } from '@/state/TreeStore';

function Workspace() {
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedId } = useTreeView();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* El lienzo se reduce al abrir el Drawer: el panel nunca ocluye el centro del grafo. */}
      <main className="relative min-w-0 flex-1">
        <Toolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <Canvas searchQuery={searchQuery} drawerOpen={selectedId !== null} />
      </main>
      <NodeDrawer />
    </div>
  );
}

export default function App() {
  return (
    <TreeStoreProvider>
      <ReactFlowProvider>
        <Workspace />
      </ReactFlowProvider>
    </TreeStoreProvider>
  );
}
