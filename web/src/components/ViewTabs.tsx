import { LayoutGrid, Map as MapIcon } from 'lucide-react';
import { routeHref, type Route } from '@/hooks/useHashRoute';
import { cn } from '@/lib/utils';

type TopView = Extract<Route['view'], 'roadmap' | 'overview'>;

const TABS: readonly { view: TopView; label: string; Icon: typeof MapIcon }[] = [
  { view: 'roadmap', label: 'Hoja de Ruta', Icon: MapIcon },
  { view: 'overview', label: 'Diagnóstico por Mesas', Icon: LayoutGrid },
];

/** Selector de vistas del Header institucional (sobre fondo oscuro). */
export function ViewTabs({ active }: { active: TopView }) {
  return (
    <nav aria-label="Vistas del visualizador" className="inline-flex rounded-lg bg-white/5 p-1 ring-1 ring-white/10">
      {TABS.map(({ view, label, Icon }) => {
        const current = view === active;
        return (
          <a
            key={view}
            href={routeHref({ view })}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:text-sm',
              current ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </a>
        );
      })}
    </nav>
  );
}
