import { Fragment, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Target, ZoomIn } from 'lucide-react';
import { HOME, navigate, sceneKey, type ExploreRoute } from '@/hooks/useHashRoute';
import { childrenOf, deeperByKind, mesaNumber, sideByKind, zoomableSiblings } from '@/lib/explore';
import type { TreeIndex } from '@/lib/graph';
import { MESAS, subEjeOf, type MesaGroup } from '@/lib/overview';
import { KIND_CLASSES, KIND_LABEL, kindCount, kindNoun, kindOf, type NodeKind } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { getIndex } from '@/state/TreeStore';
import type { NodeMetadata } from '@/types/tree';

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';

/** Elemento que acerca la cámara hacia la escena `to` (ver lib/zoom.ts). */
function Zoomable({ to, label, className, children }: { to: ExploreRoute; label: string; className?: string; children: ReactNode }) {
  const go = () => navigate(to);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      data-zoom={sceneKey(to)}
      onClick={go}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
      className={cn('cursor-pointer', FOCUS_RING, className)}
    >
      {children}
    </div>
  );
}

type KindCount = { kind: NodeKind; count: number };

/** «3 causas indirectas · 1 causa raíz». */
const countsText = (counts: KindCount[]) => counts.map((c) => kindCount(c.kind, c.count)).join(' · ');

/* ------------------------------------------------------------------ *
 * Nivel 0 · Las 11 mesas
 * ------------------------------------------------------------------ */

function MesaTile({ group }: { group: MesaGroup }) {
  return (
    <Zoomable
      to={{ ...HOME, mesa: group.mesa }}
      label={`Acercar a la Mesa ${mesaNumber(group.mesa)}: ${group.eje}`}
      className="group flex min-h-[11rem] flex-col rounded-2xl border border-slate-200 border-t-4 border-t-emerald-700 bg-white p-5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-emerald-600 hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mesa</span>
          <span className="text-4xl font-black leading-none tabular-nums text-emerald-800">{mesaNumber(group.mesa)}</span>
        </div>
        <ZoomIn className="size-5 shrink-0 text-slate-300 transition-colors group-hover:text-emerald-700" aria-hidden />
      </div>
      <h2 className="mt-3 flex flex-1 items-center text-[clamp(1.3rem,0.9rem+1.1vw,2.2rem)] font-bold leading-[1.12] tracking-tight text-slate-900">
        {group.eje}
      </h2>
      {group.subEjes.length > 0 && (
        <p className="mt-2 text-sm font-medium text-slate-500">
          {group.subEjes.map((s) => `${s.letra}. ${s.nombre}`).join('   ·   ')}
        </p>
      )}
    </Zoomable>
  );
}

export function MesasScene() {
  const problemas = MESAS.reduce((a, g) => a + g.summaries.length, 0);
  const causas = MESAS.reduce((a, g) => a + g.causas, 0);
  const efectos = MESAS.reduce((a, g) => a + g.efectos, 0);
  return (
    <div className="mx-auto grid min-h-full max-w-[1920px] auto-rows-[minmax(11rem,1fr)] grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
      {MESAS.map((g) => (
        <MesaTile key={g.mesa} group={g} />
      ))}
      <div className="flex flex-col justify-center rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Marco lógico</p>
        <p className="mt-2 text-lg font-semibold leading-snug">
          {MESAS.length} mesas · {problemas} problemas centrales
        </p>
        <p className="mt-1 text-sm text-slate-300">
          {causas} causas · {efectos} efectos identificados
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <ZoomIn className="size-4" aria-hidden /> Haga clic en una mesa para acercarse
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Nivel 1 · Mesa: eje temático (izq.) y problema identificado (der.)
 * ------------------------------------------------------------------ */

function CountBand({ side, direct, deeper, large = false }: { side: 'causa' | 'efecto'; direct: number; deeper: KindCount[]; large?: boolean }) {
  const isCause = side === 'causa';
  const Icon = isCause ? ArrowDown : ArrowUp;
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 rounded-2xl px-4 py-3',
        isCause ? 'bg-orange-50 text-[#c2410c] ring-1 ring-orange-200' : 'bg-sky-50 text-[#0369a1] ring-1 ring-sky-200',
      )}
    >
      <Icon className={large ? 'size-7' : 'size-5'} aria-hidden />
      <span className={cn('font-black leading-none tabular-nums', large ? 'text-5xl' : 'text-3xl')}>{direct}</span>
      <span className="text-left leading-tight">
        <span className={cn('block font-bold', large ? 'text-lg' : 'text-base')}>
          {kindNoun(isCause ? 'causa_directa' : 'efecto_directo', direct)}
        </span>
        {deeper.length > 0 && <span className="block text-sm opacity-80">{countsText(deeper)}</span>}
      </span>
    </div>
  );
}

const Stem = () => <div className="mx-auto h-5 w-0.5 shrink-0 bg-slate-300" aria-hidden />;

function ProblemSummary({ group, treeId, single }: { group: MesaGroup; treeId: string; single: boolean }) {
  const index = getIndex(treeId);
  const directEffects = childrenOf(index, index.centralId, 'efecto').length;
  const directCauses = childrenOf(index, index.centralId, 'causa').length;
  const deeper = (side: 'causa' | 'efecto') => sideByKind(index, side).filter((c) => c.kind !== 'causa_directa' && c.kind !== 'efecto_directo');
  const sub = subEjeOf(group, treeId);
  return (
    <Zoomable
      to={{ view: 'explore', mesa: group.mesa, treeId, path: [] }}
      label={`Acercar al problema central${sub ? ` del sub-eje ${sub.nombre}` : ''}`}
      className="group flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-xl sm:p-6"
    >
      {sub && (
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-emerald-800">
          Sub-eje {sub.letra} · {sub.nombre}
        </p>
      )}
      <CountBand side="efecto" direct={directEffects} deeper={deeper('efecto')} large={single} />
      <Stem />
      <div className="rounded-2xl bg-slate-900 p-5 text-white sm:p-6">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
          <Target className="size-4" aria-hidden /> Problema identificado
        </p>
        <p className={cn('mt-2 font-semibold leading-snug', single ? 'text-[clamp(1.1rem,0.7rem+1vw,1.75rem)]' : 'text-[clamp(1rem,0.7rem+0.6vw,1.3rem)]')}>
          {index.tree.problemaCentral}
        </p>
      </div>
      <Stem />
      <CountBand side="causa" direct={directCauses} deeper={deeper('causa')} large={single} />
      <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-400 transition-colors group-hover:text-slate-700">
        <ZoomIn className="size-4" aria-hidden /> Acercar para ver causas y efectos
      </p>
    </Zoomable>
  );
}

export function MesaScene({ group }: { group: MesaGroup }) {
  const single = group.summaries.length === 1;
  return (
    <div className="mx-auto grid min-h-full max-w-[1920px] grid-cols-1 gap-6 p-4 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex flex-col justify-center rounded-3xl bg-emerald-900 p-8 text-white sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-200">Mesa {mesaNumber(group.mesa)}</p>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-emerald-300">Eje temático</p>
        <h2 className="mt-2 text-[clamp(2rem,1rem+3vw,4.5rem)] font-black leading-[1.04] tracking-tight">{group.eje}</h2>
        {group.subEjes.length > 0 && (
          <ul className="mt-6 space-y-1 text-lg font-semibold text-emerald-100">
            {group.subEjes.map((s) => (
              <li key={s.letra}>
                Sub-eje {s.letra} · {s.nombre}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={cn('grid gap-6', !single && 'xl:grid-cols-2')}>
        {group.summaries.map((s) => (
          <ProblemSummary key={s.tree.id} group={group} treeId={s.tree.id} single={single} />
        ))}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tarjetas de causa / efecto
 * ------------------------------------------------------------------ */

interface BranchCardProps {
  node: NodeMetadata;
  index: TreeIndex;
  /** Escena a la que acerca la tarjeta (si tiene ramas dependientes). */
  to: ExploreRoute;
  focus?: boolean;
  /** Posición entre sus hermanos navegables («2 de 5»), en la tarjeta enfocada. */
  position?: string | undefined;
  /** Padre por el que se llegó a la tarjeta; los demás se mencionan («también se nutre de…»). */
  parentId: string;
}

/** Otros padres del nodo (DAG): causas a las que también contribuye o efectos de los que también se nutre. */
function OtherParents({ node, index, parentId, focus }: { node: NodeMetadata; index: TreeIndex; parentId: string; focus: boolean }) {
  const others = (index.parents.get(node.id) ?? [])
    .filter((id) => id !== parentId)
    .map((id) => index.byId.get(id))
    .filter((n): n is NodeMetadata => n !== undefined);
  const [first] = others;
  if (!first) return null;
  const verb = node.level > 0 ? 'También contribuye a' : 'También se nutre de';
  return (
    <p className={cn('mt-2 leading-snug text-slate-500', focus ? 'text-sm' : 'text-xs')}>
      <span className="font-semibold">{verb}</span>{' '}
      {focus
        ? others.map((o) => `«${o.label}»`).join('; ')
        : `${kindCount(kindOf(first.level), others.length)} más`}
    </p>
  );
}

function BranchCard({ node, index, to, focus = false, position, parentId }: BranchCardProps) {
  const deeper = deeperByKind(index, node.id);
  const isCause = node.level > 0;
  const kind = kindOf(node.level);
  const styles = KIND_CLASSES[kind];
  const body = (
    <>
      <p className={cn('text-[11px] font-bold uppercase tracking-wider', styles.eyebrow)}>
        {KIND_LABEL[kind]}
        {position && <span className="text-slate-400"> · {position}</span>}
      </p>
      <p className={cn('mt-1 leading-snug text-slate-800', focus ? 'text-[clamp(1.05rem,0.8rem+0.6vw,1.4rem)] font-semibold' : 'text-sm font-medium')}>
        {node.description}
      </p>
      <OtherParents node={node} index={index} parentId={parentId} focus={focus} />
      {!focus && deeper.length > 0 && (
        <div className="mt-auto pt-3">
          <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold', styles.soft)}>
            {isCause ? <ArrowDown className="size-4 shrink-0" aria-hidden /> : <ArrowUp className="size-4 shrink-0" aria-hidden />}
            {countsText(deeper)}
            <ZoomIn className="ml-1 size-4 shrink-0 opacity-60" aria-hidden />
          </span>
        </div>
      )}
    </>
  );
  const cls = cn(
    'flex flex-col rounded-xl border border-l-4 border-slate-200 bg-white p-3.5 text-left shadow-sm',
    styles.accent,
    focus ? 'min-w-0 max-w-3xl flex-1 p-5 shadow-md ring-2 ring-offset-2 ring-slate-300' : 'h-full',
  );
  const [nearest] = deeper;
  if (nearest && !focus) {
    return (
      <Zoomable
        to={to}
        label={`Acercar a las ${kindNoun(nearest.kind, 2)} de: ${node.label}`}
        className={cn(cls, 'transition-shadow duration-200 hover:shadow-lg')}
      >
        {body}
      </Zoomable>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Conjunto de tarjetas hermanas: en una fila si caben legibles, si no en varias. */
function CardGroup({ side, title, children }: { side: 'causa' | 'efecto'; title: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-dashed p-3 sm:p-4',
        side === 'causa' ? 'border-orange-200 bg-orange-50/40' : 'border-sky-200 bg-sky-50/40',
      )}
    >
      <h3
        className={cn(
          'mb-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider',
          side === 'causa' ? 'text-[#c2410c]' : 'text-[#0369a1]',
        )}
      >
        {side === 'causa' ? <ArrowDown className="size-4" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
        {title}
      </h3>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </section>
  );
}

const CARD_SLOT = 'flex min-w-[11.5rem] max-w-[19rem] flex-1 basis-0 flex-col';

function ProblemBox({ text, compact = false, to }: { text: string; compact?: boolean; to?: ExploreRoute }) {
  const box = (
    <span className={cn('mx-auto block w-full rounded-2xl bg-slate-900 text-white shadow-lg', compact ? 'max-w-2xl px-4 py-2.5' : 'max-w-4xl p-5 sm:p-6')}>
      <span className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
        <Target className="size-4" aria-hidden /> Problema central
      </span>
      <span
        className={cn(
          'mt-1.5 block text-center font-semibold leading-snug',
          compact ? 'line-clamp-2 text-sm text-slate-200' : 'text-[clamp(1.1rem,0.8rem+0.8vw,1.6rem)]',
        )}
      >
        {text}
      </span>
    </span>
  );
  if (!to) return box;
  // Volver al problema central es alejar la cámara un nivel.
  return (
    <button type="button" onClick={() => navigate(to)} title="Volver al problema central" className={cn('block w-full rounded-2xl', FOCUS_RING)}>
      {box}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Nivel 2 · Problema central con causas (abajo) y efectos (arriba)
 * ------------------------------------------------------------------ */

export function ProblemScene({ route }: { route: ExploreRoute & { treeId: string } }) {
  const index = getIndex(route.treeId);
  const effects = childrenOf(index, index.centralId, 'efecto');
  const causes = childrenOf(index, index.centralId, 'causa');
  const toNode = (id: string): ExploreRoute => ({ ...route, path: [id] });
  return (
    <div className="mx-auto flex min-h-full max-w-[1920px] flex-col justify-center px-4 py-5 sm:px-8">
      <CardGroup side="efecto" title={`${effects.length} efectos directos`}>
        {effects.map((n) => (
          <div key={n.id} className={CARD_SLOT}>
            <BranchCard node={n} index={index} to={toNode(n.id)} parentId={index.centralId} />
          </div>
        ))}
      </CardGroup>
      <Stem />
      <ProblemBox text={index.tree.problemaCentral} />
      <Stem />
      <CardGroup side="causa" title={`${causes.length} causas directas`}>
        {causes.map((n) => (
          <div key={n.id} className={CARD_SLOT}>
            <BranchCard node={n} index={index} to={toNode(n.id)} parentId={index.centralId} />
          </div>
        ))}
      </CardGroup>
    </div>
  );
}

/** Paso a la causa (o efecto) hermana anterior / siguiente sin salir del nivel de zoom. */
function SiblingButton({ dir, node, to }: { dir: 'prev' | 'next'; node: NodeMetadata | undefined; to: ExploreRoute | null }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  const verb = dir === 'prev' ? 'anterior' : 'siguiente';
  if (!node || !to) {
    // Hueco del mismo ancho: la tarjeta enfocada no se desplaza en los extremos.
    return <div className="w-12 shrink-0 md:w-44 xl:w-56" aria-hidden />;
  }
  const label = `${KIND_LABEL[kindOf(node.level)]} ${verb}`;
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      title={`${label} (${dir === 'prev' ? '←' : '→'}): ${node.label}`}
      aria-label={`${label}: ${node.label}`}
      className={cn(
        'group flex w-12 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 md:w-44 md:p-3 xl:w-56',
        dir === 'next' && 'flex-row-reverse text-right',
        FOCUS_RING,
      )}
    >
      <Icon className="size-7 shrink-0" aria-hidden />
      <span className="hidden min-w-0 md:block">
        <span className={cn('block text-[10px] font-bold uppercase tracking-wider', KIND_CLASSES[kindOf(node.level)].eyebrow)}>{label}</span>
        <span className="mt-0.5 line-clamp-3 text-xs leading-snug">{node.label}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Nivel 3+ · Causa (o efecto) con sus causas raíz (o efectos indirectos)
 * ------------------------------------------------------------------ */

export function BranchScene({ route }: { route: ExploreRoute & { treeId: string } }) {
  const index = getIndex(route.treeId);
  const focusId = route.path[route.path.length - 1] ?? index.centralId;
  const node = index.byId.get(focusId);
  if (!node) return null;
  const isCause = node.level > 0;
  const kids = childrenOf(index, focusId);
  // Ascendencia recorrida desde el problema (sin el nodo enfocado), del más cercano al centro al más lejano.
  const trail = route.path
    .slice(0, -1)
    .map((id) => index.byId.get(id))
    .filter((n): n is NodeMetadata => n !== undefined);
  const toChild = (id: string): ExploreRoute => ({ ...route, path: [...route.path, id] });

  // Cadena desde el problema central hacia afuera: problema → ancestros recorridos.
  const chain: ReactNode[] = [
    <ProblemBox key="central" text={index.tree.problemaCentral} compact to={{ ...route, path: [] }} />,
    ...trail.map((t, i) => (
      <button
        key={t.id}
        type="button"
        onClick={() => navigate({ ...route, path: route.path.slice(0, i + 1) })}
        className={cn(
          'mx-auto block w-full max-w-2xl rounded-xl border border-l-4 border-slate-200 bg-white px-4 py-2 text-left text-sm text-slate-600 shadow-sm hover:bg-slate-50',
          KIND_CLASSES[kindOf(t.level)].accent,
          FOCUS_RING,
        )}
      >
        <span className={cn('block text-[11px] font-bold uppercase tracking-wider', KIND_CLASSES[kindOf(t.level)].eyebrow)}>
          {KIND_LABEL[kindOf(t.level)]}
        </span>
        <span className="line-clamp-1">{t.label}</span>
      </button>
    )),
  ];

  const siblings = zoomableSiblings(index, route.path);
  const at = siblings.findIndex((n) => n.id === focusId);
  const toSibling = (n: NodeMetadata | undefined): ExploreRoute | null =>
    n ? { ...route, path: [...route.path.slice(0, -1), n.id] } : null;
  const focusCard = (
    <div className="flex items-stretch justify-center gap-2 sm:gap-3">
      {siblings.length > 1 && <SiblingButton dir="prev" node={siblings[at - 1]} to={toSibling(siblings[at - 1])} />}
      <BranchCard
        node={node}
        index={index}
        to={route}
        parentId={route.path[route.path.length - 2] ?? index.centralId}
        focus
        position={siblings.length > 1 && at >= 0 ? `${at + 1} de ${siblings.length}` : undefined}
      />
      {siblings.length > 1 && <SiblingButton dir="next" node={siblings[at + 1]} to={toSibling(siblings[at + 1])} />}
    </div>
  );
  const group = (
    <CardGroup side={isCause ? 'causa' : 'efecto'} title={kindCount(kindOf(node.level + (isCause ? 1 : -1)), kids.length)}>
      {kids.map((k) => (
        <div key={k.id} className={CARD_SLOT}>
          <BranchCard node={k} index={index} to={toChild(k.id)} parentId={focusId} />
        </div>
      ))}
    </CardGroup>
  );

  // Causas: el problema queda arriba y las causas raíz abajo; efectos: a la inversa.
  const items = isCause ? [...chain, focusCard, group] : [group, focusCard, ...chain.reverse()];
  return (
    <div className="mx-auto flex min-h-full max-w-[1920px] flex-col justify-center px-4 py-5 sm:px-8">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <Stem />}
          {item}
        </Fragment>
      ))}
    </div>
  );
}
