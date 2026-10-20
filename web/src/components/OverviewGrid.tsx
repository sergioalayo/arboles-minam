import { useLayoutEffect, useMemo, useRef } from 'react';
import { ArrowRight, Filter, Network, Search, SearchX, X } from 'lucide-react';
import { routeHref } from '@/hooks/useHashRoute';
import { normalize } from '@/lib/graph';
import { ORGANOS_CAUSALES, splitMatches, SUMMARIES, type TreeSummary } from '@/lib/overview';
import { organoBadge, organoTooltip } from '@/lib/theme';
import { cn, plural } from '@/lib/utils';

export interface OverviewFilters {
  query: string;
  organo: string | null;
}

interface OverviewGridProps {
  filters: OverviewFilters;
  onFiltersChange: (filters: OverviewFilters) => void;
  onOpenTree: (treeId: string) => void;
}

const MAX_ORGANO_BADGES = 3;

/** Posición de desplazamiento conservada entre visitas (al volver desde un árbol). */
let savedScrollTop = 0;

function Highlighted({ text, query }: { text: string; query: string }) {
  const parts = splitMatches(text, query);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-amber-200/80 px-0.5 text-slate-900">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Metric({ value, label, detail }: { value: number; label: string; detail: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xl font-semibold tabular-nums leading-none text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-[11px] text-slate-400">{detail}</div>
    </div>
  );
}

interface MesaCardProps {
  summary: TreeSummary;
  query: string;
  organo: string | null;
  onOpen: () => void;
}

function MesaCard({ summary, query, organo, onOpen }: MesaCardProps) {
  const { tree, mesaLabel, causas, causasDirectas, efectos, efectosDirectos, organos, causasTransversales } = summary;
  // Con filtro de órgano activo, ese órgano encabeza los badges aunque no esté entre los principales.
  const ordered = organo ? [...organos.filter(([o]) => o === organo), ...organos.filter(([o]) => o !== organo)] : organos;
  const shown = ordered.slice(0, MAX_ORGANO_BADGES);
  const hidden = ordered.slice(MAX_ORGANO_BADGES);

  return (
    <a
      href={routeHref({ view: 'tree', treeId: tree.id })}
      onClick={(e) => {
        // Clic normal: se prepara el árbol antes de cambiar de vista. Ctrl/Cmd/clic medio: pestaña nueva.
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onOpen();
      }}
      title={tree.descripcionGeneral}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-1 text-xs font-bold tracking-wide text-amber-300 tabular-nums">
            {mesaLabel}
          </span>
          <span className="text-[11px] text-slate-400">{plural(tree.nodes.length, 'nodo')}</span>
        </div>
        <h2 className="text-base font-semibold leading-snug text-slate-900">
          <Highlighted text={tree.eje} query={query} />
        </h2>
        <div className="flex-1 border-l-2 border-amber-400 pl-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Problema central</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            <Highlighted text={tree.problemaCentral} query={query} />
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric value={causas} label="Causas" detail={`${causasDirectas} directas · ${causas - causasDirectas} indirectas`} />
          <Metric value={efectos} label="Efectos" detail={`${efectosDirectos} directos · ${efectos - efectosDirectos} indirectos`} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Órganos con participación causal">
          {shown.map(([o, n]) => (
            <span
              key={o}
              title={`${organoTooltip(o)} · ${plural(n, 'causa')}`}
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                organoBadge(o),
                organo === o && 'ring-2 ring-slate-900 ring-offset-1',
              )}
            >
              {o} <span className="font-normal opacity-70">{n}</span>
            </span>
          ))}
          {hidden.length > 0 && (
            <span
              title={hidden.map(([o, n]) => `${o} (${n})`).join(', ')}
              className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200"
            >
              +{hidden.length}
            </span>
          )}
          {causasTransversales > 0 && (
            <span
              title={`${plural(causasTransversales, 'causa')} de diseño sectorial general o multi-entidad`}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
            >
              Transversal <span className="opacity-70">{causasTransversales}</span>
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
          Explorar Árbol Causal
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}

const TOTALS = {
  causas: SUMMARIES.reduce((a, s) => a + s.causas, 0),
  efectos: SUMMARIES.reduce((a, s) => a + s.efectos, 0),
};

/** Vista Panorámica Ejecutiva: punto de entrada con las mesas temáticas y sus problemas centrales. */
export function OverviewGrid({ filters, onFiltersChange, onOpenTree }: OverviewGridProps) {
  const { query, organo } = filters;
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = savedScrollTop;
    return () => {
      savedScrollTop = el.scrollTop;
    };
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return SUMMARIES.filter(
      (s) => (q.length < 2 || s.searchText.includes(q)) && (organo === null || s.organos.some(([o]) => o === organo)),
    );
  }, [query, organo]);

  const hasFilters = query.trim() !== '' || organo !== null;
  const clear = () => onFiltersChange({ query: '', organo: null });

  return (
    <div ref={scrollRef} className="h-dvh overflow-y-auto bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-8">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300" aria-hidden>
              <Network className="size-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Reorganización MINAM</p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">Vista Panorámica Ejecutiva</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                Árboles de problemas de las mesas temáticas, bajo la metodología de marco lógico. Seleccione una mesa
                para explorar su cadena de causas y efectos.
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-6 lg:gap-10">
            {[
              [SUMMARIES.length, 'Mesas'],
              [TOTALS.causas, 'Causas'],
              [TOTALS.efectos, 'Efectos'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2.5 px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
          <label className="relative w-full lg:max-w-sm">
            <span className="sr-only">Buscar por palabra clave en el problema central</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => onFiltersChange({ query: e.target.value, organo })}
              placeholder="Buscar en ejes y problemas centrales…"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => onFiltersChange({ query: '', organo })}
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar por órgano con participación causal">
            <Filter className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            <button
              type="button"
              onClick={() => onFiltersChange({ query, organo: null })}
              aria-pressed={organo === null}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                organo === null ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              Todos los órganos
            </button>
            {ORGANOS_CAUSALES.map(([o, n]) => (
              <button
                key={o}
                type="button"
                onClick={() => onFiltersChange({ query, organo: organo === o ? null : o })}
                aria-pressed={organo === o}
                title={`${organoTooltip(o)} · participación causal en ${plural(n, 'mesa')}`}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  organo === o ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {o} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
          <p className="shrink-0 text-xs text-slate-500" aria-live="polite">
            {visible.length === SUMMARIES.length ? `${SUMMARIES.length} mesas` : `${visible.length} de ${SUMMARIES.length} mesas`}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((s) => (
              <MesaCard key={s.tree.id} summary={s} query={query} organo={organo} onOpen={() => onOpenTree(s.tree.id)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <SearchX className="size-8 text-slate-400" aria-hidden />
            <p className="text-sm text-slate-600">Ninguna mesa coincide con los filtros aplicados.</p>
            {hasFilters && (
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
