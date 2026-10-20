import { useLayoutEffect, useMemo, useRef, type MouseEvent } from 'react';
import { ArrowRight, Filter, Network, Search, SearchX, X } from 'lucide-react';
import { routeHref } from '@/hooks/useHashRoute';
import { normalize } from '@/lib/graph';
import { MESAS, ORGANOS_CAUSALES, splitMatches, summaryMatches, type MesaGroup, type SubEje } from '@/lib/overview';
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

function MetricChip({ value, label, detail }: { value: number; label: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold tabular-nums leading-none text-slate-900">{value}</span>
        <span className="text-xs font-semibold text-slate-600">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-slate-400">{detail}</div>
    </div>
  );
}

const openOnPlainClick = (onOpen: () => void) => (e: MouseEvent<HTMLAnchorElement>) => {
  // Clic normal: se prepara el árbol antes de cambiar de vista. Ctrl/Cmd/clic medio: pestaña nueva.
  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onOpen();
};

const CARD =
  'flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2';
const BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors';
const MICRO_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-slate-500';

function ProblemText({ text, query }: { text: string; query: string }) {
  return (
    <>
      <div className={MICRO_LABEL}>Problema público central</div>
      <p className="mt-1.5 text-sm font-normal leading-relaxed text-slate-700">
        <Highlighted text={text} query={query} />
      </p>
    </>
  );
}

/** Eje problemático de una mesa consolidada; se atenúa si no coincide con los filtros activos. */
function SubEjeBlock({ sub, query, dimmed }: { sub: SubEje; query: string; dimmed: boolean }) {
  const { summary, letra, nombre } = sub;
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200/80 bg-slate-50 p-3.5 transition-opacity',
        dimmed && 'opacity-45',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-emerald-900 text-[10px] font-bold text-white">
            {letra}
          </span>
          <span className="truncate text-xs font-bold uppercase tracking-wider text-slate-800">
            Sub-eje {letra} · <Highlighted text={nombre} query={query} />
          </span>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
          {plural(summary.causas, 'causa')} · {plural(summary.efectos, 'efecto')}
        </span>
      </div>
      <ProblemText text={summary.tree.problemaCentral} query={query} />
    </div>
  );
}

interface MesaCardProps {
  group: MesaGroup;
  query: string;
  organo: string | null;
  onOpenTree: (treeId: string) => void;
}

function MesaCard({ group, query, organo, onOpenTree }: MesaCardProps) {
  const { mesaLabel, eje, subEjes, summaries, causas, causasDirectas, efectos, efectosDirectos, organos, causasTransversales } =
    group;
  const single = subEjes.length === 0 ? summaries[0] : undefined;
  const q = normalize(query.trim());
  const filtering = q.length >= 2 || organo !== null;
  // Con filtro de órgano activo, ese órgano encabeza los badges aunque no esté entre los principales.
  const ordered = organo ? [...organos.filter(([o]) => o === organo), ...organos.filter(([o]) => o !== organo)] : organos;
  const shown = ordered.slice(0, MAX_ORGANO_BADGES);
  const hidden = ordered.slice(MAX_ORGANO_BADGES);
  const nodos = summaries.reduce((a, s) => a + s.tree.nodes.length, 0);

  const body = (
    <>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-white tabular-nums shadow-sm">
            {mesaLabel}
          </span>
          <span className="text-[11px] text-slate-400">
            {subEjes.length > 0 && `${subEjes.length} ejes problemáticos · `}
            {plural(nodos, 'nodo')}
          </span>
        </div>
        <h2 className="flex min-h-[2lh] items-center border-l-4 border-emerald-700 pl-3 text-lg font-bold leading-snug tracking-tight text-slate-900">
          <span>
            <Highlighted text={eje} query={query} />
          </span>
        </h2>
        <div className="flex flex-1 flex-col gap-2.5">
          {single ? (
            <div className="flex-1 rounded-lg border border-slate-200/80 bg-slate-50 p-3.5">
              <ProblemText text={single.tree.problemaCentral} query={query} />
            </div>
          ) : (
            subEjes.map((sub) => (
              <SubEjeBlock
                key={sub.summary.tree.id}
                sub={sub}
                query={query}
                dimmed={filtering && !summaryMatches(sub.summary, q, organo)}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="grid grid-cols-2 gap-2" aria-label="Métricas del árbol de problemas">
          <MetricChip
            value={causas}
            label={causas === 1 ? 'causa' : 'causas'}
            detail={`${causasDirectas} directas · ${causas - causasDirectas} indirectas`}
          />
          <MetricChip
            value={efectos}
            label={efectos === 1 ? 'efecto' : 'efectos'}
            detail={`${efectosDirectos} directos · ${efectos - efectosDirectos} indirectos`}
          />
        </div>
        <div>
          <div className={cn(MICRO_LABEL, 'mb-1.5 text-slate-400')}>Órganos involucrados</div>
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
        </div>
        {single ? (
          <span
            className={cn(
              BUTTON,
              'self-start group-hover:border-emerald-900 group-hover:bg-emerald-900 group-hover:text-white',
            )}
          >
            Explorar Árbol Causal
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            {subEjes.map(({ summary, nombre }) => (
              <a
                key={summary.tree.id}
                href={routeHref({ view: 'tree', treeId: summary.tree.id })}
                onClick={openOnPlainClick(() => onOpenTree(summary.tree.id))}
                title={summary.tree.descripcionGeneral}
                className={cn(
                  BUTTON,
                  FOCUS,
                  'group/btn justify-between hover:border-emerald-900 hover:bg-emerald-900 hover:text-white',
                )}
              >
                <span className="truncate">
                  Explorar {nombre} <span className="font-mono font-medium opacity-60">({summary.tree.mesa})</span>
                </span>
                <ArrowRight className="size-4 shrink-0 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // Mesa consolidada: la tarjeta no es un enlace (no se anidan <a>); cada sub-eje abre su propio árbol.
  if (!single) return <article className={CARD}>{body}</article>;
  return (
    <a
      href={routeHref({ view: 'tree', treeId: single.tree.id })}
      onClick={openOnPlainClick(() => onOpenTree(single.tree.id))}
      title={single.tree.descripcionGeneral}
      className={cn(CARD, FOCUS, 'group')}
    >
      {body}
    </a>
  );
}

const TOTALS = {
  causas: MESAS.reduce((a, g) => a + g.causas, 0),
  efectos: MESAS.reduce((a, g) => a + g.efectos, 0),
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
    return MESAS.filter((g) => g.summaries.some((s) => summaryMatches(s, q, organo)));
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
              [MESAS.length, 'Mesas'],
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
            {visible.length === MESAS.length ? `${MESAS.length} mesas` : `${visible.length} de ${MESAS.length} mesas`}
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((g) => (
              <MesaCard key={g.mesa} group={g} query={query} organo={organo} onOpenTree={onOpenTree} />
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
