import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ViewTabs } from '@/components/ViewTabs';
import { routeHref, type Route } from '@/hooks/useHashRoute';
import { mesaNumber } from '@/lib/explore';
import { subEjeOf, type MesaGroup } from '@/lib/overview';

export interface Crumb {
  label: string;
  route: Route;
}

interface MesaHeaderProps {
  /** Mesa en foco; `null` en la vista de todas las mesas. */
  group: MesaGroup | null;
  treeId: string | null;
  crumbs?: Crumb[];
  /** Botones de acción (Alejar, Vista general…). */
  actions?: ReactNode;
}

/** Barra superior permanente: número de mesa y eje temático siempre legibles. */
export function MesaHeader({ group, treeId, crumbs = [], actions }: MesaHeaderProps) {
  const sub = group && treeId ? subEjeOf(group, treeId) : undefined;
  return (
    <header className="relative z-30 shrink-0 bg-slate-900 text-white shadow-md">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
        {group ? (
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex shrink-0 flex-col items-center rounded-lg bg-amber-400 px-3 py-1 text-slate-900">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Mesa</span>
              <span className="text-2xl font-black leading-none tabular-nums sm:text-3xl">{mesaNumber(group.mesa)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Eje temático
                {sub && (
                  <span className="text-amber-300">
                    {' '}
                    · Sub-eje {sub.letra}: {sub.nombre}
                  </span>
                )}
              </p>
              <h1 className="line-clamp-2 text-lg font-bold leading-tight tracking-tight sm:text-2xl">{group.eje}</h1>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Reorganización MINAM · Árboles de problemas
            </p>
            <h1 className="text-lg font-bold leading-tight tracking-tight sm:text-2xl">Diagnóstico por Mesas Temáticas</h1>
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          <ViewTabs active="explore" />
        </div>
      </div>
      {crumbs.length > 0 && (
        <nav aria-label="Ruta de exploración" className="border-t border-white/10 px-4 py-1.5 sm:px-6">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={routeHref(c.route)} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-600" aria-hidden />}
                  {last ? (
                    <span aria-current="page" className="max-w-[28ch] truncate font-semibold text-white">
                      {c.label}
                    </span>
                  ) : (
                    <a href={routeHref(c.route)} className="max-w-[28ch] truncate rounded hover:text-white hover:underline">
                      {c.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </header>
  );
}

export const HEADER_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-40';
