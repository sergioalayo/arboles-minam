import { Panel } from '@xyflow/react';
import { KIND_CLASSES, KIND_LABEL, KINDS } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Leyenda con las mismas etiquetas que las tarjetas (sólidas en directos y raíz / finales) y, si el
 * árbol la tiene, la nota al pie del problema central.
 */
export function Legend({ note }: { note?: string | undefined }) {
  return (
    <Panel position="bottom-center" className="!mb-3 flex max-w-[min(56rem,calc(100vw-2rem))] flex-col items-center gap-1.5">
      {note && (
        <p className="rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] leading-snug text-slate-600 shadow-md backdrop-blur">
          {note}
        </p>
      )}
      <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur md:flex">
        {KINDS.map((k) => (
          <span key={k} className={cn('rounded px-1.5 text-[10px] font-bold uppercase leading-4 tracking-wide', KIND_CLASSES[k].badge)}>
            {KIND_LABEL[k]}
          </span>
        ))}
      </div>
    </Panel>
  );
}
