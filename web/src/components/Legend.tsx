import { Panel } from '@xyflow/react';
import { SEVERIDAD_CLASSES, TYPE_COLOR } from '@/lib/theme';
import { NODE_TYPE_LABEL, SEVERIDAD_LABEL, type NodeType, type Severidad } from '@/types/tree';

const TYPES: NodeType[] = ['efecto_indirecto', 'efecto_directo', 'problema_central', 'causa_directa', 'causa_indirecta'];
const SEVERIDADES: Severidad[] = ['critica', 'moderada', 'baja'];

export function Legend() {
  return (
    <Panel position="bottom-center" className="!mb-3">
      <div className="hidden items-center gap-4 rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-[11px] text-slate-600 shadow-md backdrop-blur md:flex">
        {TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-full" style={{ backgroundColor: TYPE_COLOR[t] }} />
            {NODE_TYPE_LABEL[t]}
          </span>
        ))}
        <span className="h-4 w-px bg-slate-200" aria-hidden />
        {SEVERIDADES.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${SEVERIDAD_CLASSES[s].dot}`} />
            {SEVERIDAD_LABEL[s]}
          </span>
        ))}
      </div>
    </Panel>
  );
}
