import { useEffect, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, FileText, Landmark, Route, ScrollText, X } from 'lucide-react';
import { SeverityLight } from '@/components/CustomNode';
import { ancestorsOf } from '@/lib/graph';
import { organoBadge, organoTooltip, SEVERIDAD_CLASSES, TYPE_CLASSES, TYPE_COLOR } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useTreeActions, useTreeView } from '@/state/TreeStore';
import { NODE_TYPE_LABEL, SEVERIDAD_LABEL, type NodeMetadata } from '@/types/tree';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function NodeLink({ node, onSelect }: { node: NodeMetadata; onSelect: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
      >
        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLOR[node.type] }} />
        <span className="leading-snug">{node.label}</span>
      </button>
    </li>
  );
}

/** Lectura del rol del nodo en la cadena causal (el texto íntegro del insumo es el título). */
function diagnosis(node: NodeMetadata, parents: (NodeMetadata | undefined)[], dependents: number): string {
  const tipo = NODE_TYPE_LABEL[node.type];
  const destinos = parents.filter((p): p is NodeMetadata => p !== undefined).map((p) => `«${p.label}»`);
  if (node.level === 0) {
    return 'Estado negativo sobre la entidad o el bien público que articula el árbol: las causas lo explican y los efectos describen sus externalidades.';
  }
  if (node.level > 0) {
    const raiz = dependents === 0 ? ' Es una causa raíz: no se desagrega en factores más profundos.' : ` Se explica a su vez por ${dependents} factor(es) más profundo(s).`;
    return `${tipo} que contribuye a ${destinos.join(' y ')}.${raiz}`;
  }
  const fin = dependents === 0 ? ' Es una externalidad final del árbol.' : ` Desencadena ${dependents} efecto(s) adicional(es).`;
  return `${tipo} originado en ${destinos.join(' y ')}.${fin}`;
}

/** Panel lateral de lectura de nivel 2: diagnóstico íntegro, evidencia y trazabilidad. */
export function NodeDrawer() {
  const { index, selectedId, treeId } = useTreeView();
  const { selectNode, focusNode } = useTreeActions();
  const node = selectedId ? index.byId.get(selectedId) : undefined;
  const open = node !== undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectNode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectNode]);

  const dependents = node ? (index.children.get(node.id) ?? []).map((id) => index.byId.get(id)) : [];
  const parents = node ? (index.parents.get(node.id) ?? []).map((id) => index.byId.get(id)) : [];
  const route = node
    ? [...ancestorsOf(index, node.id)]
        .map((id) => index.byId.get(id))
        .filter((n): n is NodeMetadata => n !== undefined)
        .sort((a, b) => Math.abs(b.level) - Math.abs(a.level))
    : [];
  const isCause = (node?.level ?? 0) > 0;
  const go = (id: string) => focusNode(treeId, id);

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        'relative h-full shrink-0 overflow-hidden border-l border-slate-200 bg-white shadow-xl transition-[width] duration-300 ease-out',
        open ? 'w-[min(420px,100vw)]' : 'w-0',
      )}
    >
      {node && (
        <div className="flex h-full w-[min(420px,100vw)] flex-col">
          <header className="relative px-5 pb-4 pt-5" style={{ borderTop: `4px solid ${TYPE_COLOR[node.type]}` }}>
            <button
              type="button"
              onClick={() => selectNode(null)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar panel de detalle"
            >
              <X className="size-4" />
            </button>
            <p className={cn('text-[11px] font-semibold uppercase tracking-wider', TYPE_CLASSES[node.type].eyebrow)}>
              {NODE_TYPE_LABEL[node.type]} · nivel {node.level}
            </p>
            <h2 className="mt-1 pr-8 text-lg font-semibold leading-snug text-slate-900">{node.description}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', organoBadge(node.organo))}
                title={organoTooltip(node.organo)}
              >
                {node.organo}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-medium ring-1',
                  SEVERIDAD_CLASSES[node.severidad].text,
                  SEVERIDAD_CLASSES[node.severidad].ring,
                )}
              >
                <SeverityLight severidad={node.severidad} />
                {SEVERIDAD_LABEL[node.severidad]}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{node.ejeTematico}</span>
              <span
                className="text-[11px] text-slate-400"
                title={
                  node.severidad_manual
                    ? 'Severidad revisada por el equipo técnico; se conserva en futuras re-extracciones.'
                    : 'Severidad estimada por la heurística de extracción (priorización relativa dentro del árbol).'
                }
              >
                {node.severidad_manual ? 'Severidad ajustada manualmente' : 'Severidad estimada'}
              </span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <Section icon={<ScrollText className="size-3.5" />} title="Diagnóstico y sustento">
              <p className="text-sm leading-relaxed text-slate-700">{diagnosis(node, parents, dependents.length)}</p>
              {node.level === 0 && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                  {index.tree.descripcionGeneral}
                </p>
              )}
            </Section>

            <Section icon={<BarChart3 className="size-3.5" />} title="Evidencia y brechas">
              {node.evidencia ? (
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {node.evidencia.split(' · ').map((item) => (
                    <li key={item} className="rounded-lg bg-slate-50 px-3 py-2 leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-slate-400">
                  El documento fuente no consigna cifras ni referencias normativas para este elemento.
                </p>
              )}
            </Section>

            {node.level !== 0 && (
              <Section icon={<Route className="size-3.5" />} title="Ruta causal">
                <ol className="space-y-0.5">
                  {route.map((n) => (
                    <NodeLink key={n.id} node={n} onSelect={go} />
                  ))}
                </ol>
              </Section>
            )}

            {parents.length > 0 && node.level !== 0 && (
              <Section
                icon={isCause ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                title={isCause ? 'Contribuye directamente a' : 'Se origina en'}
              >
                <ul className="space-y-0.5">
                  {parents.map((n) => n && <NodeLink key={n.id} node={n} onSelect={go} />)}
                </ul>
              </Section>
            )}

            {dependents.length > 0 && (
              <Section
                icon={<Landmark className="size-3.5" />}
                title={node.level === 0 ? 'Causas y efectos directos' : isCause ? 'Causas que lo explican' : 'Efectos que genera'}
              >
                <ul className="space-y-0.5">
                  {dependents.map((n) => n && <NodeLink key={n.id} node={n} onSelect={go} />)}
                </ul>
              </Section>
            )}

            <Section icon={<FileText className="size-3.5" />} title="Trazabilidad">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-400">Fuente</dt>
                <dd className="text-slate-700">{node.fuente}</dd>
                <dt className="text-slate-400">Árbol</dt>
                <dd className="text-slate-700">{index.tree.titulo}</dd>
                <dt className="text-slate-400">ID</dt>
                <dd className="font-mono text-xs leading-5 text-slate-500">{node.id}</dd>
              </dl>
              {node.textoOriginal !== undefined && (
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-500">Texto original del documento:</span> {node.textoOriginal}
                </p>
              )}
            </Section>
          </div>
        </div>
      )}
    </aside>
  );
}
