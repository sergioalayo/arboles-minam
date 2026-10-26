import { memo, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CARD_METRICS, INLINE_BADGE, INLINE_CONTROLS, type CardKind } from '@/lib/cardMetrics';
import { KIND_CLASSES, KIND_LABEL, KIND_SHORT, kindCount, kindOf } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useTreeActions } from '@/state/TreeStore';
import type { PanelFlowNode, ProblemFlowNode } from '@/types/tree';

const handleClass = '!size-2 !min-h-0 !min-w-0 !border-0 !bg-slate-400 opacity-0';

function cardKind(level: number): CardKind {
  if (level === 0) return 'central';
  return Math.abs(level) === 1 ? 'direct' : 'deep';
}

/**
 * Tarjeta compacta de la Vista general: alto ajustado al texto íntegro (ver lib/cardMetrics.ts),
 * con su denominación (directa / indirecta / raíz; directo / indirecto / final) y el botón de
 * colapso de su rama.
 */
function CustomNodeComponent({ data, width, height }: NodeProps<ProblemFlowNode>) {
  const { selectNode, toggleCollapse } = useTreeActions();
  const isCentral = data.branch === 'central';
  const card = cardKind(data.level);
  const m = CARD_METRICS[card];
  const kind = kindOf(data.level);
  const styles = KIND_CLASSES[kind];

  const onToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // no dispara onNodeClick (selección de la tarjeta)
    toggleCollapse(data.id);
  };

  const childKind = kindOf(data.level + (data.branch === 'causa' ? 1 : -1));
  const toggle = !isCentral && data.childCount > 0 && (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'nodrag nopan ml-0.5 inline-flex h-4 shrink-0 items-center gap-0.5 rounded px-1 text-[10px] font-bold leading-none transition-colors',
        data.isCollapsed ? styles.soft : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
      )}
      aria-expanded={!data.isCollapsed}
      title={data.isCollapsed ? `Mostrar ${kindCount(childKind, data.childCount)}` : 'Colapsar rama'}
    >
      {data.isCollapsed ? <ChevronDown className="size-3" aria-hidden /> : <ChevronUp className="size-3" aria-hidden />}
      {data.isCollapsed && data.descendantCount}
    </button>
  );

  return (
    <div
      role="button"
      tabIndex={data.isDimmed ? -1 : 0}
      aria-label={`${KIND_LABEL[kind]}: ${data.label}`}
      aria-pressed={data.isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectNode(data.id);
        }
      }}
      style={{ width, height, padding: `${m.padY}px ${m.padX}px` }}
      className={cn(
        'problem-card group relative flex cursor-pointer flex-col overflow-hidden border border-l-4 outline-none',
        'transition-[opacity,box-shadow] duration-300 ease-out hover:shadow-lg',
        'focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
        isCentral
          ? 'rounded-xl border-slate-700 bg-slate-900 text-white shadow-md'
          : 'rounded-lg border-slate-200 bg-white text-slate-900 shadow-sm',
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
      ) : (
        <>
          {/* `in`: enlace con el problema central (directos) o con la fila de nodos compartidos. */}
          <Handle
            id="in"
            type="target"
            position={data.branch === 'causa' ? Position.Top : Position.Bottom}
            className={handleClass}
            isConnectable={false}
          />
          {/* Enlaces del DAG fuera del panel: por el costado izquierdo. */}
          <Handle id="side-out" type="source" position={Position.Left} style={{ top: '72%' }} className={handleClass} isConnectable={false} />
          <Handle id="side-in" type="target" position={Position.Left} style={{ top: '28%' }} className={handleClass} isConnectable={false} />
        </>
      )}

      {card === 'deep' ? (
        // Sin fila de cabecera: denominación al inicio de la primera línea y colapso flotando a la
        // derecha (lib/cardMetrics.ts reserva ese espacio al medir).
        <p style={{ fontSize: m.fontSize, lineHeight: `${m.lineHeight}px`, fontWeight: m.weight }} className="text-slate-800">
          {toggle && (
            <span className="float-right flex items-center" style={{ marginLeft: INLINE_CONTROLS.marginLeft, height: m.lineHeight }}>
              {toggle}
            </span>
          )}
          <span
            className={cn('uppercase', styles.eyebrow)}
            style={{
              fontSize: INLINE_BADGE.fontSize,
              fontWeight: INLINE_BADGE.weight,
              letterSpacing: INLINE_BADGE.letterSpacing,
              marginRight: INLINE_BADGE.marginRight,
            }}
          >
            {KIND_SHORT[kind]}
          </span>
          {data.description}
        </p>
      ) : (
        <>
          {/* Cabecera de una línea */}
          <div className="flex min-w-0 shrink-0 items-center gap-1.5" style={{ height: m.header }}>
            <span className={cn('truncate text-[10px] font-bold uppercase tracking-wider', styles.eyebrow)}>{KIND_LABEL[kind]}</span>
            <span className="ml-auto" />
            {toggle}
          </div>

          {/* Cuerpo: texto íntegro del insumo (legible sin abrir el Drawer). */}
          <p
            style={{ marginTop: m.gap, fontSize: m.fontSize, lineHeight: `${m.lineHeight}px`, fontWeight: m.weight }}
            className={isCentral ? 'tracking-tight' : 'text-slate-800'}
          >
            {data.description}
          </p>
        </>
      )}
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);

/** Fondo de un panel: agrupa una causa (o efecto) directa con toda su descendencia. */
function PanelNodeComponent({ data }: NodeProps<PanelFlowNode>) {
  return (
    <div
      className={cn(
        'size-full rounded-xl border border-dashed transition-opacity duration-300',
        data.side === 'causa' ? 'border-orange-200 bg-orange-50/70' : 'border-sky-200 bg-sky-50/70',
        data.isDimmed && 'opacity-30',
      )}
    />
  );
}

export const PanelNode = memo(PanelNodeComponent);
