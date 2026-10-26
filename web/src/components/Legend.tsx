import { Panel } from '@xyflow/react';
import { KIND_COLOR, KIND_LABEL, KINDS } from '@/lib/theme';

export function Legend() {
  return (
    <Panel position="bottom-center" className="!mb-3">
      <div className="hidden items-center gap-4 rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-[11px] text-slate-600 shadow-md backdrop-blur md:flex">
        {KINDS.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-full" style={{ backgroundColor: KIND_COLOR[k] }} />
            {KIND_LABEL[k]}
          </span>
        ))}
      </div>
    </Panel>
  );
}
