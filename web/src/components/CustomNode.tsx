import { memo, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronsDownUp, Plus, Target } from 'lucide-react';
import { CENTRAL_SIZE, NODE_SIZE } from '@/lib/layout';
import { organoBadge, organoShort, organoTooltip, SEVERIDAD_CLASSES, TYPE_CLASSES } from '@/lib/theme';
import { cn, plural } from '@/lib/utils';
import { useTreeActions } from '@/state/TreeStore';
import { NODE_TYPE_LABEL, SEVERIDAD_LABEL, type ProblemFlowNode, type Severidad } from '@/types/tree';

const SEMAFORO: Severidad[] = ['critica', 'moderada', 'baja'];

export function SeverityLight({ severidad, dark = false }: { severidad: Severidad; dark?: boolean }) {
  return (
    <span
      className={cn('flex items-center gap-1 rounded-full px-1.5 py-1', dark ? 'bg-white/10' : 'bg-slate-100')}
      title={`Severidad ${SEVERIDAD_LABEL[severidad].toLowerCase()}`}
      aria-label={`Severidad ${SEVERIDAD_LABEL[severidad]}`}
    >
      {SEMAFORO.map((s) => (
        <span
          key={s}
          className={cn(
            'size-2 rounded-full',
            s === severidad ? SEVERIDAD_CLASSES[s].dot : dark ? 'bg-white/20' : 'bg-slate-300/70',
          )}
        />
      ))}
    </span>
  );
}

const handleClass = '!size-2 !min-h-0 !min-w-0 !border-0 !bg-slate-400 opacity-0';

function CustomNodeComponent({ data }: NodeProps<ProblemFlowNode>) {
  const { selectNode, toggleCollapse } = useTreeActions();
  const isCentral = data.branch === 'central';
  const styles = TYPE_CLASSES[data.type];
  const size = isCentral ? CENTRAL_SIZE : NODE_SIZE;
  const childNoun = data.branch === 'causa' ? 'causa' : 'efecto';

  const onToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // no dispara onNodeClick (selección de la tarjeta)
    toggleCollapse(data.id);
  };

  return (
    <div
      role="button"
      tabIndex={data.isDimmed ? -1 : 0}
      aria-label={`${NODE_TYPE_LABEL[data.type]}: ${data.label}`}
      aria-pressed={data.isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectNode(data.id);
        }
      }}
      style={{ height: size.height }}
      className={cn(
        'problem-card group relative flex cursor-pointer flex-col rounded-xl border border-l-4 p-3 shadow-md outline-none',
        'transition-[opacity,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg',
        'focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
        isCentral ? 'w-80 border-slate-700 bg-slate-900 text-white' : 'w-72 border-slate-200 bg-white text-slate-900',
        styles.accent,
        data.isSelected && 'ring-2 ring-offset-2 ring-slate-900',
        data.isSearchHit && !data.isSelected && 'ring-2 ring-amber-400 ring-offset-1',
        data.isDimmed && 'pointer-events-none opacity-20',
      )}
    >
      {isCentral ? (
        <>
          <Handle id="efectos" type="source" position={Position.Top} className={handleClass} isConnectable={false} />
          <Handle id="causas" type="source" position={Position.Bottom} className={handleClass} isConnectable={false} />
        </>
      ) : data.branch === 'causa' ? (
        <>
          <Handle id="in" type="target" position={Position.Top} className={handleClass} isConnectable={false} />
          <Handle id="out" type="source" position={Position.Bottom} className={handleClass} isConnectable={false} />
        </>
      ) : (
        <>
          <Handle id="out" type="source" position={Position.Top} className={handleClass} isConnectable={false} />
          <Handle id="in" type="target" position={Position.Bottom} className={handleClass} isConnectable={false} />
        </>
      )}

      {/* Cabecera semántica */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'max-w-[70%] truncate rounded-full px-2 py-0.5 text-xs font-semibold',
            isCentral ? 'bg-amber-400 text-slate-900' : organoBadge(data.organo),
          )}
          title={organoTooltip(data.organo)}
        >
          {organoShort(data.organo)}
        </span>
        <SeverityLight severidad={data.severidad} dark={isCentral} />
      </div>
      <p className={cn('mt-2 text-[10px] font-semibold uppercase tracking-wider', styles.eyebrow)}>
        {NODE_TYPE_LABEL[data.type]}
      </p>

      {/* Cuerpo */}
      <p
        className={cn(
          'mt-0.5 line-clamp-3 leading-snug',
          isCentral ? 'text-base font-semibold tracking-tight' : 'text-sm font-medium text-slate-800',
        )}
      >
        {data.label}
      </p>

      {/* Pie interactivo */}
      <div className="mt-auto flex items-center justify-between pt-2">
        {isCentral ? (
          <span className="flex items-center gap-1.5 text-xs text-slate-300">
            <Target className="size-3.5" aria-hidden />
            Problema analizado
          </span>
        ) : data.childCount > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'nodrag nopan inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              data.isCollapsed
                ? cn('border-transparent', styles.soft, 'hover:brightness-95')
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
            aria-expanded={!data.isCollapsed}
            title={data.isCollapsed ? `Mostrar ${plural(data.descendantCount, 'nodo')} dependientes` : 'Colapsar rama'}
          >
            {data.isCollapsed ? (
              <>
                <Plus className="size-3.5" aria-hidden />
                {plural(data.childCount, childNoun)}
              </>
            ) : (
              <>
                <ChevronsDownUp className="size-3.5" aria-hidden />
                colapsar
              </>
            )}
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">
            {data.branch === 'causa' ? 'Causa raíz' : 'Efecto final'}
          </span>
        )}
        {!isCentral && data.isCollapsed && data.descendantCount > data.childCount && (
          <span className="text-[11px] text-slate-400">{data.descendantCount} en la rama</span>
        )}
      </div>
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
