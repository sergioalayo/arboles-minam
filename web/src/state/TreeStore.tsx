import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { TREE_BY_ID, TREES } from '@/data/trees';
import {
  buildIndex,
  causalPath,
  collapseRecursive,
  initialCollapsed,
  reveal,
  visibleIds,
  type TreeIndex,
} from '@/lib/graph';

/** Solicitud de encuadre de cámara; `seq` cambia en cada petición. */
export interface FocusRequest {
  seq: number;
  /** IDs a encuadrar; `null` = todo el grafo visible. */
  ids: string[] | null;
}

/** Estado de exploración de un árbol; se conserva en memoria al cambiar de árbol. */
interface TreeSnapshot {
  collapsed: Set<string>;
  selectedId: string | null;
  organoFilter: string | null;
  ejeFilter: string | null;
}

interface State extends TreeSnapshot {
  treeId: string;
  focus: FocusRequest;
  /** Instantáneas de los árboles visitados (excepto el actual). */
  saved: ReadonlyMap<string, TreeSnapshot>;
}

type Action =
  | { type: 'selectTree'; treeId: string }
  | { type: 'toggleCollapse'; id: string }
  | { type: 'expandAll' }
  | { type: 'collapseAll' }
  | { type: 'selectNode'; id: string | null }
  | { type: 'focusNode'; treeId: string; id: string }
  | { type: 'setOrganoFilter'; organo: string | null }
  | { type: 'setEjeFilter'; eje: string | null }
  | { type: 'fitView' }
  | { type: 'reset' };

const indexCache = new Map<string, TreeIndex>();

export function getIndex(treeId: string): TreeIndex {
  let index = indexCache.get(treeId);
  if (!index) {
    const tree = TREE_BY_ID.get(treeId);
    if (!tree) throw new Error(`Árbol desconocido: ${treeId}`);
    index = buildIndex(tree);
    indexCache.set(treeId, index);
  }
  return index;
}

function initialSnapshot(treeId: string): TreeSnapshot {
  return { collapsed: initialCollapsed(getIndex(treeId)), selectedId: null, organoFilter: null, ejeFilter: null };
}

function freshState(treeId: string, seq: number, saved: ReadonlyMap<string, TreeSnapshot> = new Map()): State {
  return { treeId, ...initialSnapshot(treeId), focus: { seq: seq + 1, ids: null }, saved };
}

/** Cambia de árbol guardando la exploración actual y restaurando la del destino, si existe. */
function switchTree(state: State, treeId: string): State {
  if (treeId === state.treeId) return state;
  const saved = new Map(state.saved);
  const { collapsed, selectedId, organoFilter, ejeFilter } = state;
  saved.set(state.treeId, { collapsed, selectedId, organoFilter, ejeFilter });
  const restored = saved.get(treeId) ?? initialSnapshot(treeId);
  saved.delete(treeId);
  const ids = restored.selectedId ? [...causalPath(getIndex(treeId), restored.selectedId)] : null;
  return { treeId, ...restored, saved, focus: { seq: state.focus.seq + 1, ids } };
}

function matchingIds(index: TreeIndex, organo: string | null, eje: string | null): string[] {
  return index.tree.nodes
    .filter((n) => (organo === null || n.organo === organo) && (eje === null || n.ejeTematico === eje))
    .map((n) => n.id);
}

/** Aplica filtros: revela los nodos coincidentes y encuadra la cámara sobre ellos. */
function withFilters(state: State, organo: string | null, eje: string | null): State {
  const index = getIndex(state.treeId);
  const base = { ...state, organoFilter: organo, ejeFilter: eje, selectedId: null };
  if (organo === null && eje === null) return { ...base, focus: { seq: state.focus.seq + 1, ids: null } };
  const ids = matchingIds(index, organo, eje);
  return { ...base, collapsed: reveal(index, state.collapsed, ids), focus: { seq: state.focus.seq + 1, ids } };
}

function reducer(state: State, action: Action): State {
  const index = getIndex(state.treeId);
  const nextFocus = (ids: string[] | null): FocusRequest => ({ seq: state.focus.seq + 1, ids });
  switch (action.type) {
    case 'selectTree':
      return switchTree(state, action.treeId);
    case 'toggleCollapse': {
      if (state.collapsed.has(action.id)) {
        // Expandir: un nivel, encuadrando el nodo junto con las ramas que aparecen.
        const collapsed = new Set([...state.collapsed].filter((id) => id !== action.id));
        return { ...state, collapsed, focus: nextFocus([action.id, ...(index.children.get(action.id) ?? [])]) };
      }
      return { ...state, collapsed: collapseRecursive(index, state.collapsed, action.id) };
    }
    case 'expandAll':
      return { ...state, collapsed: new Set(), focus: nextFocus(null) };
    case 'collapseAll':
      return { ...state, collapsed: initialCollapsed(index), selectedId: null, focus: nextFocus(null) };
    case 'selectNode': {
      if (action.id === null || action.id === index.centralId) {
        return { ...state, selectedId: action.id, focus: action.id ? nextFocus(null) : state.focus };
      }
      // DAG: se expande toda la ascendencia para que sean visibles *todas* las rutas hacia el centro.
      return {
        ...state,
        selectedId: action.id,
        collapsed: reveal(index, state.collapsed, [action.id]),
        focus: nextFocus([...causalPath(index, action.id)]),
      };
    }
    case 'focusNode': {
      const base = switchTree(state, action.treeId);
      const idx = getIndex(action.treeId);
      return {
        ...base,
        organoFilter: null,
        ejeFilter: null,
        collapsed: reveal(idx, base.collapsed, [action.id]),
        selectedId: action.id,
        focus: { seq: base.focus.seq + 1, ids: [...causalPath(idx, action.id)] },
      };
    }
    case 'setOrganoFilter':
      return withFilters(state, action.organo, state.ejeFilter);
    case 'setEjeFilter':
      return withFilters(state, state.organoFilter, action.eje);
    case 'fitView':
      return { ...state, focus: nextFocus(null) };
    case 'reset':
      return freshState(state.treeId, state.focus.seq, state.saved);
  }
}

export interface TreeActions {
  selectTree: (treeId: string) => void;
  toggleCollapse: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  /** `onNodeSelect`: abre el Drawer y aísla la ruta causal del nodo. */
  selectNode: (id: string | null) => void;
  focusNode: (treeId: string, id: string) => void;
  setOrganoFilter: (organo: string | null) => void;
  setEjeFilter: (eje: string | null) => void;
  fitView: () => void;
  reset: () => void;
}

export interface TreeView extends State {
  index: TreeIndex;
  visible: Set<string>;
  /** Nodos fuera de la ruta seleccionada o de los filtros activos. */
  dimmed: Set<string>;
}

const ViewContext = createContext<TreeView | null>(null);
const ActionsContext = createContext<TreeActions | null>(null);

export function TreeStoreProvider({ children }: { children: ReactNode }) {
  const firstTree = TREES[0]?.id ?? '';
  const [state, dispatch] = useReducer(reducer, firstTree, (id) => freshState(id, 0));

  const actions = useMemo<TreeActions>(
    () => ({
      selectTree: (treeId) => dispatch({ type: 'selectTree', treeId }),
      toggleCollapse: (id) => dispatch({ type: 'toggleCollapse', id }),
      expandAll: () => dispatch({ type: 'expandAll' }),
      collapseAll: () => dispatch({ type: 'collapseAll' }),
      selectNode: (id) => dispatch({ type: 'selectNode', id }),
      focusNode: (treeId, id) => dispatch({ type: 'focusNode', treeId, id }),
      setOrganoFilter: (organo) => dispatch({ type: 'setOrganoFilter', organo }),
      setEjeFilter: (eje) => dispatch({ type: 'setEjeFilter', eje }),
      fitView: () => dispatch({ type: 'fitView' }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [],
  );

  const view = useMemo<TreeView>(() => {
    const index = getIndex(state.treeId);
    const visible = visibleIds(index, state.collapsed);
    const dimmed = new Set<string>();
    if (state.selectedId && state.selectedId !== index.centralId) {
      const path = causalPath(index, state.selectedId);
      for (const id of visible) if (!path.has(id)) dimmed.add(id);
    } else if (state.organoFilter !== null || state.ejeFilter !== null) {
      const match = new Set(matchingIds(index, state.organoFilter, state.ejeFilter));
      for (const id of visible) if (!match.has(id) && id !== index.centralId) dimmed.add(id);
    }
    return { ...state, index, visible, dimmed };
  }, [state]);

  return (
    <ActionsContext.Provider value={actions}>
      <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useTreeView(): TreeView {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error('useTreeView debe usarse dentro de <TreeStoreProvider>');
  return ctx;
}

export function useTreeActions(): TreeActions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useTreeActions debe usarse dentro de <TreeStoreProvider>');
  return ctx;
}
