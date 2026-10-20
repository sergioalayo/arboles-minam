import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Filter,
  ImageDown,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Network,
  RotateCcw,
  Scan,
} from 'lucide-react';
import { SearchBox } from '@/components/SearchBox';
import { TREES } from '@/data/trees';
import { useFullscreen } from '@/hooks/useFullscreen';
import { exportViewToPng } from '@/lib/exportPng';
import { organoShort, organoTooltip } from '@/lib/theme';
import { cn, plural } from '@/lib/utils';
import { useTreeActions, useTreeView } from '@/state/TreeStore';

interface ActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  title: string;
  disabled?: boolean;
  pressed?: boolean;
}

function ActionButton({ onClick, icon, children, title, disabled = false, pressed }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium disabled:cursor-wait disabled:opacity-60',
        pressed
          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100',
      )}
    >
      {icon}
      {/* Etiquetas según el ancho real de la barra (se reduce al abrir el Drawer). */}
      <span className="hidden @[1440px]:inline">{children}</span>
    </button>
  );
}

function countBy<T>(items: readonly T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

/** Barra superior flotante: selector de árbol, buscador, filtros rápidos y acciones de vista. */
export function Toolbar({ searchQuery, onSearchChange }: ToolbarProps) {
  const { index, treeId, organoFilter, ejeFilter, visible, selectedId } = useTreeView();
  const actions = useTreeActions();
  const { getNodes, getNodesBounds } = useReactFlow();
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen();
  const [exporting, setExporting] = useState(false);
  const tree = index.tree;

  // Al entrar/salir de pantalla completa cambia el área útil: se reencuadra el grafo.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    actions.fitView();
  }, [isFullscreen, actions]);

  const onExport = async () => {
    const context = [
      selectedId ? `Ruta causal: ${index.byId.get(selectedId)?.label ?? ''}` : null,
      organoFilter ? `Órgano: ${organoFilter}` : null,
      ejeFilter ? `Eje: ${ejeFilter}` : null,
    ].filter(Boolean);
    const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    setExporting(true);
    try {
      await exportViewToPng({
        bounds: getNodesBounds(getNodes()),
        title: tree.titulo,
        subtitle: [`${visible.size} de ${tree.nodes.length} nodos visibles`, ...context, `MINAM · ${fecha}`].join('   ·   '),
        fileName: `${tree.titulo}${organoFilter ? `-${organoFilter}` : ''}`,
      });
    } catch (err) {
      console.error('Error al exportar PNG', err);
      window.alert('No se pudo exportar la imagen. Intente nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  const organos = useMemo(() => countBy(tree.nodes, (n) => n.organo), [tree]);
  const ejes = useMemo(() => countBy(tree.nodes.filter((n) => n.level !== 0), (n) => n.ejeTematico), [tree]);

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col gap-2">
      <div className="@container pointer-events-auto rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-amber-300 sm:flex" aria-hidden>
            <Network className="size-5" />
          </span>
          <label className="relative min-w-0 flex-1 sm:max-w-md">
            <span className="sr-only">Seleccionar árbol de problemas</span>
            <select
              value={treeId}
              onChange={(e) => {
                onSearchChange('');
                actions.selectTree(e.target.value);
              }}
              title={tree.descripcionGeneral}
              className="h-9 w-full appearance-none truncate rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              {TREES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.titulo}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          </label>
          <span className="hidden whitespace-nowrap text-xs text-slate-500 lg:inline">
            {visible.size} de {plural(tree.nodes.length, 'nodo')}
          </span>
        </div>
        <SearchBox query={searchQuery} onQueryChange={onSearchChange} />
        <div className="flex items-center gap-1.5">
          <ActionButton onClick={actions.reset} icon={<RotateCcw className="size-4" />} title="Restablecer vista inicial y filtros">
            Restablecer Vista
          </ActionButton>
          <ActionButton onClick={actions.expandAll} icon={<ChevronsUpDown className="size-4" />} title="Expandir todas las ramas">
            Expandir Todo
          </ActionButton>
          <ActionButton onClick={actions.collapseAll} icon={<ChevronsDownUp className="size-4" />} title="Colapsar a causas y efectos directos">
            Colapsar Todo
          </ActionButton>
          <ActionButton onClick={actions.fitView} icon={<Scan className="size-4" />} title="Ajustar el grafo a la pantalla">
            Ajustar
          </ActionButton>
          <ActionButton
            onClick={() => void onExport()}
            disabled={exporting}
            icon={exporting ? <LoaderCircle className="size-4 animate-spin" /> : <ImageDown className="size-4" />}
            title="Exportar la vista actual a PNG de alta resolución"
          >
            Exportar PNG
          </ActionButton>
          {fullscreenSupported && (
            <ActionButton
              onClick={toggleFullscreen}
              pressed={isFullscreen}
              icon={isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Modo proyección (pantalla completa)'}
            >
              {isFullscreen ? 'Salir' : 'Pantalla completa'}
            </ActionButton>
          )}
        </div>
      </div>
      </div>

      <div className="pointer-events-auto flex max-w-full items-center gap-1.5 self-start overflow-x-auto rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 shadow-md backdrop-blur">
        <Filter className="size-3.5 shrink-0 text-slate-400" aria-hidden />
        <button
          type="button"
          onClick={() => actions.setOrganoFilter(null)}
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
            organoFilter === null ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          Todos
        </button>
        {organos.map(([organo, n]) => (
          <button
            key={organo}
            type="button"
            onClick={() => actions.setOrganoFilter(organoFilter === organo ? null : organo)}
            aria-pressed={organoFilter === organo}
            title={`${organoTooltip(organo)} (${plural(n, 'nodo')})`}
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
              organoFilter === organo ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            Solo {organoShort(organo)} <span className="opacity-60">{n}</span>
          </button>
        ))}
        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" aria-hidden />
        <label className="relative shrink-0">
          <span className="sr-only">Filtrar por eje temático</span>
          <select
            value={ejeFilter ?? ''}
            onChange={(e) => actions.setEjeFilter(e.target.value || null)}
            className={cn(
              'h-7 appearance-none rounded-full border pl-2.5 pr-7 text-xs font-medium focus:outline-none',
              ejeFilter ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            <option value="">Todos los ejes temáticos</option>
            {ejes.map(([eje, n]) => (
              <option key={eje} value={eje}>
                {eje} ({n})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 opacity-60" aria-hidden />
        </label>
      </div>
    </div>
  );
}
