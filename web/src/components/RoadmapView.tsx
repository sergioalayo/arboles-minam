import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { ViewTabs } from '@/components/ViewTabs';
import { FASES, ROADMAP_METRICAS, type Fase, type Hito } from '@/data/roadmapData';
import { HOME, routeHref } from '@/hooks/useHashRoute';
import { cn } from '@/lib/utils';

const OVERVIEW_HREF = routeHref(HOME);
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2';
const MICRO_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-slate-500';

const HITOS: readonly { hito: Hito; fase: Fase }[] = FASES.flatMap((fase) => fase.hitos.map((hito) => ({ hito, fase })));
const LAST = HITOS.length - 1;
const clamp = (i: number) => Math.max(0, Math.min(LAST, i));
const pad = (n: number) => String(n).padStart(2, '0');

/** Distancia entre centros de tarjetas; `--step` se fija en px desde un ResizeObserver del escenario. */
const stepFor = (width: number) => Math.min(720, width * 0.78);

/** Hito visible al volver a la vista (p. ej. desde la Vista Panorámica). */
let savedIndex = 0;

function CtaLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <a
      href={OVERVIEW_HREF}
      className={cn(
        'group inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-amber-300',
        FOCUS,
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </a>
  );
}

/** «112 Hallazgos Críticos» → cifra destacada + etiqueta. */
function Metric({ text }: { text: string }) {
  const [, value = '', label = text] = /^(\d+)\s+(.*)$/.exec(text) ?? [];
  return (
    <div className="inline-flex items-baseline gap-2.5 rounded-xl bg-emerald-50 px-4 py-2.5 ring-1 ring-emerald-100">
      {value && <span className="text-4xl font-bold leading-none tabular-nums text-emerald-800">{value}</span>}
      <span className="text-xs font-bold uppercase tracking-wider text-emerald-900/80">{label}</span>
    </div>
  );
}

function StageCard({ hito, fase, active }: { hito: Hito; fase: Fase; active: boolean }) {
  const final = hito.estado === 'hito_actual';
  return (
    <article
      data-scroll
      className={cn(
        'min-h-0 overflow-y-auto rounded-2xl border bg-white p-6 shadow-2xl shadow-slate-900/15 sm:p-8',
        final ? 'border-emerald-700/60' : 'border-slate-200',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn(MICRO_LABEL, 'text-emerald-800')}>
          Fase {fase.numero} · {fase.titulo}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            final ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800',
          )}
        >
          {final ? <Flag className="size-3" aria-hidden /> : <CheckCircle2 className="size-3" aria-hidden />}
          {final ? 'Hito culminado · Actual' : 'Completado'}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <time
          className={cn(
            'inline-flex whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold tabular-nums shadow-sm',
            final ? 'bg-amber-400 text-slate-900' : 'bg-slate-900 text-white',
          )}
        >
          {hito.fecha}
        </time>
        <span className="font-mono text-xs font-semibold tabular-nums text-slate-400">
          Hito {pad(hito.numero)} / {pad(HITOS.length)}
        </span>
      </div>

      <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">{hito.titulo}</h2>
      <p className="mt-3 text-base leading-relaxed text-slate-600">{hito.resumen}</p>

      {hito.metrica && (
        <div className="mt-6">
          <Metric text={hito.metrica} />
        </div>
      )}

      {final && (
        <div className="mt-6 flex flex-col gap-4 rounded-xl bg-emerald-900 p-5 text-white">
          <p className="text-sm font-medium leading-snug">
            El resultado de este hito son los <strong className="text-amber-300">12 árboles causales</strong>{' '}
            sistematizados.
          </p>
          <a
            href={OVERVIEW_HREF}
            className={cn(
              'group relative inline-flex items-center justify-center gap-2 self-start rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition-[background-color,translate] hover:-translate-y-0.5 hover:bg-amber-300 sm:text-base',
              FOCUS,
              'focus-visible:ring-offset-emerald-900',
            )}
          >
            {active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-lg bg-amber-300 animate-[cta-halo_1.8s_ease-out_infinite] motion-reduce:hidden"
              />
            )}
            <span className="relative">Explorar los 12 Árboles de Problemas y Causas</span>
            <ArrowRight
              className={cn(
                'relative size-5 shrink-0',
                active && 'animate-[cta-nudge_1.2s_ease-in-out_infinite] motion-reduce:animate-none',
              )}
              aria-hidden
            />
          </a>
        </div>
      )}
    </article>
  );
}

/** Minimapa: el viaje completo con barra de progreso y paradas seleccionables. */
function Track({ active, onSelect }: { active: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Minimapa del camino" className="shrink-0 border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-8 sm:px-12">
        <div className="relative h-20">
          <div aria-hidden className="absolute inset-x-0 top-10 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
          <div
            aria-hidden
            className="absolute inset-x-0 top-10 h-1 origin-left rounded-full bg-emerald-600 transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateY(-50%) scaleX(${active / LAST})` }}
          />
          <ol className="absolute inset-0">
            {HITOS.map(({ hito }, i) => {
              const current = i === active;
              return (
                <li key={hito.numero} className="absolute top-0 h-full -translate-x-1/2" style={{ left: `${(i / LAST) * 100}%` }}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`Hito ${hito.numero}, ${hito.fecha}: ${hito.titulo}`}
                    title={hito.titulo}
                    className="group flex h-full w-10 flex-col items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <span className="flex h-7 items-end whitespace-nowrap pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      {current && 'Estás aquí'}
                    </span>
                    <span className="relative flex h-6 items-center justify-center">
                      {current && (
                        <span
                          aria-hidden
                          className="absolute size-4 rounded-full bg-emerald-500/50 animate-ping motion-reduce:animate-none"
                        />
                      )}
                      <span
                        className={cn(
                          'relative rounded-full transition-[background-color,box-shadow] duration-300',
                          current
                            ? 'size-4 bg-emerald-600 ring-4 ring-emerald-100'
                            : i < active
                              ? 'size-3 bg-emerald-600 group-hover:ring-4 group-hover:ring-emerald-100'
                              : 'size-3 bg-white ring-2 ring-slate-300 group-hover:ring-emerald-400',
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        'h-7 whitespace-nowrap pt-1 font-mono text-[11px] tabular-nums',
                        current ? 'font-bold text-slate-900' : 'hidden text-slate-500 group-hover:text-slate-800 md:block',
                      )}
                    >
                      {hito.fechaCorta}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </nav>
  );
}

function SideArrow({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight;
  // Se intensifica hacia el lado al que apunta el cursor (`--nx` ∈ [-1, 1]).
  const style: CSSProperties | undefined = disabled
    ? undefined
    : { opacity: `calc(0.6 + max(calc(var(--nx, 0) * ${dir}), 0) * 0.4)` };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      aria-label={dir < 0 ? 'Hito anterior' : 'Hito siguiente'}
      className={cn(
        'absolute top-1/2 z-20 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg ring-1 ring-slate-200 backdrop-blur transition-[background-color,color] hover:bg-slate-900 hover:text-white disabled:pointer-events-none disabled:opacity-20 sm:flex',
        FOCUS,
        dir < 0 ? 'left-4 lg:left-8' : 'right-4 lg:right-8',
      )}
    >
      <Icon className="size-6" aria-hidden />
    </button>
  );
}

interface DragState {
  id: number;
  x0: number;
  lastX: number;
  lastT: number;
  v: number;
  moved: boolean;
}

/** Hoja de Ruta: storytelling horizontal de los hitos de la reorganización. */
export function RoadmapView() {
  const [active, setActive] = useState(savedIndex);
  const stageRef = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const stepPx = useRef(stepFor(window.innerWidth));
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const go = useCallback((i: number) => setActive(clamp(i)), []);
  const move = useCallback((d: number) => setActive((a) => clamp(a + d)), []);

  useEffect(() => {
    savedIndex = active;
  }, [active]);

  const setVars = (vars: Record<string, string>) => {
    const el = stageRef.current;
    if (el) for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      stepPx.current = stepFor(el.clientWidth);
      el.style.setProperty('--step', `${stepPx.current}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  // Teclado: flechas, Inicio/Fin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const actions: Record<string, () => void> = {
        ArrowRight: () => move(1),
        ArrowLeft: () => move(-1),
        Home: () => go(0),
        End: () => go(LAST),
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, move]);

  // Rueda / trackpad: un hito por gesto (la inercia del trackpad no encadena saltos).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let acc = 0;
    let locked = false;
    let idle = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // zoom con pellizco
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      // Deja desplazar verticalmente una tarjeta con contenido desbordado.
      const scroller = (e.target as Element).closest<HTMLElement>('[data-scroll]');
      if (!horizontal && scroller && scroller.scrollHeight > scroller.clientHeight) return;
      e.preventDefault();
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        acc = 0;
        locked = false;
      }, 220);
      if (locked) return;
      acc += horizontal ? e.deltaX : e.deltaY;
      if (Math.abs(acc) < 40) return;
      move(Math.sign(acc));
      acc = 0;
      locked = true;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.clearTimeout(idle);
    };
  }, [move]);

  const endDrag = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    delete stageRef.current?.dataset.dragging;
    setVars({ '--drag': '0px' });
    if (!commit) return;
    suppressClick.current = true;
    const dx = d.lastX - d.x0;
    // Inercia: se proyecta el desplazamiento con la velocidad final del gesto.
    let n = Math.round(-(dx + d.v * 260) / stepPx.current);
    if (n === 0 && (Math.abs(dx) > 50 || Math.abs(d.v) > 0.45)) n = dx < 0 ? 1 : -1;
    move(Math.max(-3, Math.min(3, n)));
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (e.pointerType === 'mouse') return;
    drag.current = { id: e.pointerId, x0: e.clientX, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') {
      if (reducedMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setVars({ '--nx': nx.toFixed(3), '--ny': ny.toFixed(3) }));
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < 8) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = '';
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    // Resistencia elástica en los extremos del recorrido.
    const edge = (active === 0 && dx > 0) || (active === LAST && dx < 0);
    setVars({ '--drag': `${edge ? dx * 0.3 : dx}px` });
  };

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const current = HITOS[active]?.hito;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="shrink-0 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-5">
            <ViewTabs active="roadmap" />
            <div className="sr-only lg:not-sr-only">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">Reorganización MINAM</p>
              <h1 className="text-lg font-semibold leading-tight">Hoja de Ruta de la Reorganización</h1>
            </div>
          </div>
          <CtaLink>
            <span className="sm:hidden">Explorar resultados</span>
            <span className="hidden sm:inline">Explorar Resultados: Árboles de Problemas de las 11 Mesas</span>
          </CtaLink>
        </div>
        <div className="border-t border-white/10 bg-slate-950/40">
          <p className="mx-auto flex max-w-[1600px] flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-xs sm:px-6 sm:text-sm">
            <span className="font-semibold text-slate-300">Proceso de Modernización MINAM:</span>
            {ROADMAP_METRICAS.map(({ valor, etiqueta }, i) => (
              <span key={etiqueta} className="inline-flex items-baseline gap-1.5">
                {i > 0 && (
                  <span className="mr-1.5 text-slate-600" aria-hidden>
                    ·
                  </span>
                )}
                <strong className="text-base font-bold tabular-nums text-amber-300 sm:text-lg">{valor}</strong>
                <span className="text-slate-300">{etiqueta}</span>
              </span>
            ))}
          </p>
        </div>
      </header>

      <Track active={active} onSelect={go} />

      <main
        ref={stageRef}
        aria-roledescription="carrusel"
        aria-label="Hitos del proceso de reorganización"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setVars({ '--nx': '0', '--ny': '0' });
        }}
        onClickCapture={onClickCapture}
        className="group/stage relative min-h-0 flex-1 touch-pan-y overflow-hidden bg-[radial-gradient(ellipse_at_center,_#ffffff_0%,_#f1f5f9_55%,_#e2e8f0_100%)]"
      >
        {/* Paneo de cámara guiado por el cursor: a la derecha se asoma el futuro, a la izquierda el pasado. */}
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out group-data-dragging/stage:transition-none motion-reduce:transition-none"
          style={{ transform: 'translate3d(calc(var(--nx, 0) * -40px), 0, 0)' }}
        >
          {HITOS.map(({ hito, fase }, i) => {
            const offset = i - active;
            const abs = Math.abs(offset);
            const isActive = offset === 0;
            const scale = isActive ? 1 : abs === 1 ? 0.9 : 0.8;
            return (
              <div
                key={hito.numero}
                data-card
                aria-hidden={!isActive}
                onClick={abs === 1 ? () => go(i) : undefined}
                className={cn(
                  'absolute left-1/2 top-1/2 flex max-h-[calc(100%-4.5rem)] w-[min(640px,82vw)] flex-col will-change-transform',
                  'transition-[transform,opacity,filter] duration-500 ease-out group-data-dragging/stage:transition-none motion-reduce:transition-none',
                  isActive && 'z-10',
                  abs === 1 && 'cursor-pointer opacity-40 blur-[0.5px] hover:opacity-60',
                  abs > 1 && 'pointer-events-none opacity-0',
                )}
                style={{
                  transform: `translate3d(calc(-50% + ${offset} * var(--step, min(720px, 78vw)) + var(--drag, 0px)), -50%, 0) scale(${scale})`,
                }}
              >
                <div
                  inert={!isActive}
                  className="flex min-h-0 flex-col transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={
                    isActive
                      ? { transform: 'perspective(1400px) rotateY(calc(var(--nx, 0) * 3deg)) rotateX(calc(var(--ny, 0) * -2deg))' }
                      : undefined
                  }
                >
                  <StageCard hito={hito} fase={fase} active={isActive} />
                </div>
              </div>
            );
          })}
        </div>

        <SideArrow dir={-1} disabled={active === 0} onClick={() => move(-1)} />
        <SideArrow dir={1} disabled={active === LAST} onClick={() => move(1)} />

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-3 pb-3 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={active === 0}
            aria-label="Hito anterior"
            className="flex size-8 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200 disabled:opacity-30 sm:hidden"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="font-mono font-semibold tabular-nums text-slate-700">
            {pad(active + 1)} / {pad(HITOS.length)}
          </span>
          <span className="hidden pointer-fine:inline">· ← → teclado · rueda del ratón · clic en las tarjetas laterales</span>
          <span className="hidden pointer-coarse:inline">· desliza para avanzar</span>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={active === LAST}
            aria-label="Hito siguiente"
            className="flex size-8 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200 disabled:opacity-30 sm:hidden"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {current && `Hito ${current.numero} de ${HITOS.length}, ${current.fecha}: ${current.titulo}`}
        </p>
      </main>
    </div>
  );
}
