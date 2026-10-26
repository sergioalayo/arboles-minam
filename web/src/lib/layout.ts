import { cardHeight } from '@/lib/cardMetrics';
import type { TreeIndex } from '@/lib/graph';
import { KIND_SHORT, kindOf } from '@/lib/theme';

/** Ancho de las tarjetas apiladas (causas raíz / efectos indirectos) y del problema central. */
export const DEEP_WIDTH = 232;
export const CENTRAL_WIDTH = 380;

/** Escala mínima a la que las tarjetas apiladas siguen siendo legibles (≈ 10 px de texto). */
export const LEGIBLE_ZOOM = 0.8;

/** Separación entre sub-columnas de un mismo panel. */
const SUB_GAP = 10;
/** Margen interior de cada panel. */
const PAD = 10;
/** Separación vertical entre tarjetas apiladas. */
const STACK_GAP = 8;
/** Separación entre paneles vecinos. */
const PANEL_GAP = 22;
/** Distancia entre el problema central y la fila de paneles. */
const CENTRAL_GAP = 44;
/** Sangría por cada nivel por debajo de la causa indirecta (p. ej. causas raíz). */
const INDENT = 16;
/** Fila de causas raíz / efectos finales compartidos por varios padres. */
const SHARED_WIDTH = 300;
const SHARED_GAP = 40;

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Panel de una causa (o efecto) directa: la agrupa con toda su descendencia. */
export interface PanelBox extends Box {
  id: string;
  side: 'causa' | 'efecto';
}

export interface TreeLayout {
  /** Esquina superior izquierda y tamaño de cada nodo visible (convención de React Flow). */
  boxes: Map<string, Box>;
  panels: PanelBox[];
  /** Padre a través del cual se ubicó cada nodo; las demás aristas del DAG cruzan paneles. */
  placedUnder: Map<string, string>;
  /** Causas raíz / efectos finales con varios padres: van en una fila propia, enlazados a todos. */
  shared: Set<string>;
  /** Trazo ortogonal (coordenadas del lienzo) de cada arista que sale de su panel, por `padre>hijo`. */
  routes: Map<string, Point[]>;
  bounds: Box;
}

/** Ubicación de un nodo en su panel; `col = -1` para la causa (o efecto) directa. */
interface Slot {
  panel: PanelBox;
  col: number;
  cols: number;
  colLeft: number;
  /** Último de su sub-columna: nada lo separa del borde exterior del panel. */
  outermost: boolean;
}

export interface Viewport {
  width: number;
  height: number;
  /** Escala mínima a la que las tarjetas siguen siendo legibles. */
  minZoom: number;
}

type Side = 'causa' | 'efecto';

interface Item {
  id: string;
  depth: number;
  width: number;
  height: number;
}

/** Causa raíz (o efecto indirecto) con su descendencia: se apila sin partirse entre columnas. */
interface Block {
  items: Item[];
  height: number;
}

interface PanelInput {
  id: string;
  description: string;
  blocks: Block[];
}

interface PanelPlan {
  input: PanelInput;
  columns: Block[][];
  innerWidth: number;
  directHeight: number;
  width: number;
  height: number;
}

const naturalCompare = new Intl.Collator('es', { numeric: true }).compare;

function sortedChildren(index: TreeIndex, id: string, visible: Set<string>, side: Side): string[] {
  return (index.children.get(id) ?? [])
    .filter((c) => {
      const lv = index.byId.get(c)?.level ?? 0;
      return visible.has(c) && (side === 'causa' ? lv > 0 : lv < 0);
    })
    .sort(naturalCompare);
}

const stackHeight = (heights: number[]) => heights.reduce((a, h) => a + h, 0) + Math.max(0, heights.length - 1) * STACK_GAP;

function deepHeight(index: TreeIndex, id: string, width: number): number {
  const meta = index.byId.get(id);
  const inline = { badge: KIND_SHORT[kindOf(meta?.level ?? 2)], toggle: (index.children.get(id)?.length ?? 0) > 0 };
  return cardHeight(meta?.description ?? '', 'deep', width, inline);
}

/** Nodos de tercer nivel (o más) con varios padres visibles: se ubican fuera de los paneles. */
function sharedNodes(index: TreeIndex, visible: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of visible) {
    const level = Math.abs(index.byId.get(id)?.level ?? 0);
    const parents = (index.parents.get(id) ?? []).filter((p) => visible.has(p));
    if (level >= 3 && parents.length > 1) out.add(id);
  }
  return out;
}

function collectPanels(index: TreeIndex, visible: Set<string>, side: Side, placed: Map<string, string>): PanelInput[] {
  return sortedChildren(index, index.centralId, visible, side).map((directId) => {
    placed.set(directId, index.centralId);
    const blocks: Block[] = [];
    for (const rootId of sortedChildren(index, directId, visible, side)) {
      if (placed.has(rootId)) continue;
      const items: Item[] = [];
      const visit = (id: string, depth: number, parent: string) => {
        if (placed.has(id)) return;
        placed.set(id, parent);
        const width = DEEP_WIDTH - (depth - 1) * INDENT;
        items.push({ id, depth, width, height: deepHeight(index, id, width) });
        for (const c of sortedChildren(index, id, visible, side)) visit(c, depth + 1, id);
      };
      visit(rootId, 1, directId);
      blocks.push({ items, height: stackHeight(items.map((i) => i.height)) });
    }
    return { id: directId, description: index.byId.get(directId)?.description ?? '', blocks };
  });
}

/** Reparte los bloques en sub-columnas de alto máximo `limit` (en orden documental). */
function planPanel(input: PanelInput, limit: number): PanelPlan {
  const columns: Block[][] = [];
  let current: Block[] = [];
  let height = 0;
  for (const b of input.blocks) {
    if (current.length > 0 && height + STACK_GAP + b.height > limit) {
      columns.push(current);
      current = [];
      height = 0;
    }
    height += (current.length > 0 ? STACK_GAP : 0) + b.height;
    current.push(b);
  }
  if (current.length > 0) columns.push(current);
  const n = Math.max(1, columns.length);
  const innerWidth = n * DEEP_WIDTH + (n - 1) * SUB_GAP;
  const directHeight = cardHeight(input.description, 'direct', innerWidth);
  const childrenHeight = Math.max(0, ...columns.map((col) => stackHeight(col.map((b) => b.height))));
  return {
    input,
    columns,
    innerWidth,
    directHeight,
    width: innerWidth + 2 * PAD,
    height: 2 * PAD + directHeight + (childrenHeight > 0 ? STACK_GAP + childrenHeight : 0),
  };
}

interface SidePlan {
  panels: PanelPlan[];
  width: number;
  height: number;
}

function planSide(inputs: PanelInput[], limit: number): SidePlan {
  const panels = inputs.map((p) => planPanel(p, limit));
  return {
    panels,
    width: panels.reduce((a, p) => a + p.width, 0) + Math.max(0, panels.length - 1) * PANEL_GAP,
    height: Math.max(0, ...panels.map((p) => p.height)),
  };
}

/** Altos de columna candidatos: los cortes naturales entre bloques de cada panel. */
function candidateLimits(inputs: PanelInput[]): number[] {
  const tallest = Math.max(0, ...inputs.flatMap((p) => p.blocks.map((b) => b.height)));
  const set = new Set<number>([Number.POSITIVE_INFINITY]);
  for (const p of inputs) {
    let acc = 0;
    p.blocks.forEach((b, i) => {
      acc += (i > 0 ? STACK_GAP : 0) + b.height;
      if (acc >= tallest) set.add(acc);
    });
  }
  return [...set];
}

/** Alto que añade la fila de nodos compartidos de un lado (0 si no hay). */
function sharedRowHeight(index: TreeIndex, ids: string[]): number {
  return ids.length ? SHARED_GAP + Math.max(...ids.map((id) => deepHeight(index, id, SHARED_WIDTH))) : 0;
}

/**
 * Ubica la fila de nodos compartidos más allá de los paneles: cada nodo, centrado bajo (o sobre)
 * el promedio de sus padres, sin solaparse con sus vecinos.
 */
function placeShared(index: TreeIndex, ids: string[], side: Side, offset: number, out: TreeLayout): void {
  const wanted = ids
    .map((id) => {
      const centers = (index.parents.get(id) ?? [])
        .map((p) => out.boxes.get(p))
        .filter((b): b is Box => b !== undefined)
        .map((b) => b.x + b.width / 2);
      return { id, cx: centers.length ? centers.reduce((a, c) => a + c, 0) / centers.length : 0 };
    })
    .sort((a, b) => a.cx - b.cx);
  let right = Number.NEGATIVE_INFINITY;
  for (const { id, cx } of wanted) {
    const height = deepHeight(index, id, SHARED_WIDTH);
    const x = Math.max(cx - SHARED_WIDTH / 2, right + SUB_GAP * 2);
    right = x + SHARED_WIDTH;
    out.boxes.set(id, { x, y: side === 'causa' ? offset : -offset - height, width: SHARED_WIDTH, height });
  }
}

/** Ubica una fila de paneles; en efectos se refleja verticalmente (crecen hacia arriba). */
function placeSide(plan: SidePlan, side: Side, offset: number, out: TreeLayout, slots: Map<string, Slot>): void {
  const flip = (y: number, h: number) => (side === 'causa' ? offset + y : -offset - y - h);
  let x = -plan.width / 2;
  for (const p of plan.panels) {
    const panel: PanelBox = { id: p.input.id, side, x, y: flip(0, p.height), width: p.width, height: p.height };
    const cols = p.columns.length;
    out.panels.push(panel);
    out.boxes.set(p.input.id, { x: x + PAD, y: flip(PAD, p.directHeight), width: p.innerWidth, height: p.directHeight });
    slots.set(p.input.id, { panel, col: -1, cols, colLeft: x + PAD, outermost: cols === 0 });
    const top = PAD + p.directHeight + STACK_GAP;
    p.columns.forEach((col, j) => {
      const colX = x + PAD + j * (DEEP_WIDTH + SUB_GAP);
      const items = col.flatMap((b) => b.items);
      let y = top;
      items.forEach((item, k) => {
        out.boxes.set(item.id, { x: colX + (item.depth - 1) * INDENT, y: flip(y, item.height), width: item.width, height: item.height });
        slots.set(item.id, { panel, col: j, cols, colLeft: colX, outermost: k === items.length - 1 });
        y += item.height + STACK_GAP;
      });
    });
    x += p.width + PANEL_GAP;
  }
}

/** Canal vertical junto a un nodo, a su izquierda (`s = -1`) o derecha; `outside` si queda entre paneles. */
function gutter(slot: Slot, s: -1 | 1): { s: -1 | 1; x: number; outside: boolean } {
  const p = slot.panel;
  const edge = slot.col < 0 || (s < 0 ? slot.col === 0 : slot.col === slot.cols - 1);
  if (edge) return { s, x: s < 0 ? p.x - PANEL_GAP / 2 : p.x + p.width + PANEL_GAP / 2, outside: true };
  return { s, x: s < 0 ? slot.colLeft - SUB_GAP / 2 : slot.colLeft + DEEP_WIDTH + SUB_GAP / 2, outside: false };
}

/** Canal del lado que mira hacia `towardX`; con `preferOutside`, el que queda entre paneles si lo hay. */
function pickGutter(slot: Slot, box: Box, towardX: number, preferOutside: boolean) {
  const facing = gutter(slot, towardX < box.x + box.width / 2 ? -1 : 1);
  if (!preferOutside || facing.outside) return facing;
  const other = gutter(slot, facing.s === -1 ? 1 : -1);
  return other.outside ? other : facing;
}

const centerOf = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * Trazos ortogonales de las aristas que salen de su panel, sin atravesar tarjetas:
 * - Hacia la fila de compartidos: la tarjeta sale por su borde exterior (abajo en causas, arriba en
 *   efectos) si es la última de su sub-columna; si no, por el canal lateral que mira al destino.
 *   Cada destino tiene su carril horizontal y reparte las llegadas a lo ancho de su borde.
 * - Entre paneles: por el canal entre paneles; si no son vecinos, cruzan por el carril que separa
 *   la fila de paneles del problema central.
 * `rowEdge` es la distancia al centro del borde exterior de cada fila de paneles; `innerEdge`, la del interior.
 */
function routeEdges(
  index: TreeIndex,
  visible: Set<string>,
  out: TreeLayout,
  slots: Map<string, Slot>,
  rowEdge: Record<Side, number>,
  innerEdge: number,
): void {
  const dirOf = (id: string) => ((index.byId.get(id)?.level ?? 0) > 0 ? 1 : -1);
  // Tramos verticales por canal: si varias aristas usan el mismo, se separan en pistas paralelas.
  const tracks = new Map<number, { step: number; groups: Point[][] }>();
  const onTrack = (g: { x: number; outside: boolean }, pts: Point[]) => {
    const key = Math.round(g.x);
    const track = tracks.get(key) ?? { step: g.outside ? 6 : 3, groups: [] };
    track.groups.push(pts);
    tracks.set(key, track);
  };

  for (const side of ['causa', 'efecto'] as const) {
    const dir = side === 'causa' ? 1 : -1;
    const targets = [...out.shared]
      .flatMap((id) => {
        const box = out.boxes.get(id);
        return box && dirOf(id) === dir ? [{ id, box }] : [];
      })
      .sort((a, b) => a.box.x - b.box.x);
    targets.forEach(({ id: sid, box: S }, k) => {
      const lane = dir * (rowEdge[side] + (SHARED_GAP * (k + 1)) / (targets.length + 1));
      const entryY = dir > 0 ? S.y : S.y + S.height;
      // Salida de cada padre: por su borde exterior o, si tiene tarjetas detrás, por un canal lateral.
      const exits: { pid: string; start: Point; turn: Point | null; gutter: ReturnType<typeof gutter> | null }[] = [];
      for (const pid of index.parents.get(sid) ?? []) {
        const P = out.boxes.get(pid);
        if (!P || !visible.has(pid)) continue;
        const c = centerOf(P);
        const slot = slots.get(pid);
        if (!slot || slot.outermost) exits.push({ pid, start: { x: c.x, y: dir > 0 ? P.y + P.height : P.y }, turn: null, gutter: null });
        else {
          const g = pickGutter(slot, P, centerOf(S).x, false);
          exits.push({ pid, start: { x: g.s < 0 ? P.x : P.x + P.width, y: c.y }, turn: { x: g.x, y: c.y }, gutter: g });
        }
      }
      exits.sort((a, b) => (a.turn ?? a.start).x - (b.turn ?? b.start).x);
      exits.forEach((e, i) => {
        const entryX = S.x + (S.width * (i + 1)) / (exits.length + 1);
        const down = { x: (e.turn ?? e.start).x, y: lane };
        if (e.turn && e.gutter) onTrack(e.gutter, [e.turn, down]);
        out.routes.set(`${e.pid}>${sid}`, [e.start, ...(e.turn ? [e.turn] : []), down, { x: entryX, y: lane }, { x: entryX, y: entryY }]);
      });
    });
  }

  const lanesUsed = new Map<number, number>();
  for (const [child, placedParent] of out.placedUnder) {
    for (const pid of index.parents.get(child) ?? []) {
      if (pid === placedParent || pid === index.centralId || !visible.has(pid)) continue;
      const A = out.boxes.get(pid);
      const T = out.boxes.get(child);
      const sa = slots.get(pid);
      const st = slots.get(child);
      if (!A || !T || !sa || !st) continue;
      const a = centerOf(A);
      const t = centerOf(T);
      const ga = pickGutter(sa, A, t.x, true);
      const gt = pickGutter(st, T, a.x, true);
      const start = { x: ga.s < 0 ? A.x : A.x + A.width, y: a.y };
      const end = { x: gt.s < 0 ? T.x : T.x + T.width, y: t.y };
      const out1 = { x: ga.x, y: a.y };
      const in1 = { x: gt.x, y: t.y };
      if (Math.abs(ga.x - gt.x) < 1) {
        onTrack(ga, [out1, in1]);
        out.routes.set(`${pid}>${child}`, [start, out1, in1, end]);
        continue;
      }
      // Paneles no vecinos: se cruza por el carril interior (carriles escalonados si hay varios).
      const dir = dirOf(child);
      const k = lanesUsed.get(dir) ?? 0;
      lanesUsed.set(dir, k + 1);
      const lane = dir * (innerEdge - 8 - 6 * (k % 3));
      const out2 = { x: ga.x, y: lane };
      const in2 = { x: gt.x, y: lane };
      onTrack(ga, [out1, out2]);
      onTrack(gt, [in2, in1]);
      out.routes.set(`${pid}>${child}`, [start, out1, out2, in2, in1, end]);
    }
  }

  for (const { step, groups } of tracks.values()) {
    groups.forEach((pts, i) => {
      const dx = (i - (groups.length - 1) / 2) * step;
      for (const p of pts) p.x += dx;
    });
  }
}

/**
 * Layout compacto bi-direccional anclado en el problema central (x = 0, y = 0): un panel por causa
 * directa con sus causas indirectas (y raíz) debajo y un panel por efecto directo con sus efectos
 * indirectos (y finales) encima; las causas raíz y los efectos finales con varios padres forman una
 * fila propia más allá de los paneles. Las tarjetas se ajustan a su texto y, si un panel es muy alto, sus bloques se reparten en
 * sub-columnas: se elige el reparto que muestra el árbol completo legible en `viewport` o, si no
 * cabe, el que ocupa todo el ancho legible con el menor alto.
 */
export function layoutTree(index: TreeIndex, visible: Set<string>, viewport: Viewport): TreeLayout {
  const shared = sharedNodes(index, visible);
  // Los compartidos no entran en ningún panel (se ubican después, en su fila).
  const placed = new Map<string, string>([...shared].map((id) => [id, '']));
  const causes = collectPanels(index, visible, 'causa', placed);
  const effects = collectPanels(index, visible, 'efecto', placed);
  const central = index.byId.get(index.centralId);
  const centralHeight = cardHeight(central?.description ?? '', 'central', CENTRAL_WIDTH);
  const sharedCauses = [...shared].filter((id) => (index.byId.get(id)?.level ?? 0) > 0);
  const sharedEffects = [...shared].filter((id) => (index.byId.get(id)?.level ?? 0) < 0);
  const extraHeight = sharedRowHeight(index, sharedCauses) + sharedRowHeight(index, sharedEffects);

  // Preferencias: 1) todo el árbol a la vista a escala legible (la mayor posible); 2) si no cabe,
  // todo el ancho a escala legible con el menor alto posible (scroll vertical); 3) el mejor ajuste.
  const legibleWidth = viewport.width / viewport.minZoom;
  const score = (width: number, height: number): [number, number] => {
    const fit = Math.min(viewport.width / width, viewport.height / height);
    if (fit >= viewport.minZoom) return [2, fit];
    return width <= legibleWidth ? [1, -height] : [0, fit];
  };
  let best: { c: SidePlan; e: SidePlan; score: [number, number] } | null = null;
  const effectPlans = candidateLimits(effects).map((l) => planSide(effects, l));
  for (const limit of candidateLimits(causes)) {
    const c = planSide(causes, limit);
    for (const e of effectPlans) {
      const s = score(Math.max(c.width, e.width, CENTRAL_WIDTH), e.height + c.height + centralHeight + 2 * CENTRAL_GAP + extraHeight);
      if (!best || s[0] > best.score[0] || (s[0] === best.score[0] && s[1] > best.score[1] + 1e-6)) best = { c, e, score: s };
    }
  }

  for (const id of shared) placed.delete(id);
  const out: TreeLayout = { boxes: new Map(), panels: [], placedUnder: placed, shared, routes: new Map(), bounds: { x: 0, y: 0, width: 0, height: 0 } };
  const slots = new Map<string, Slot>();
  out.boxes.set(index.centralId, { x: -CENTRAL_WIDTH / 2, y: -centralHeight / 2, width: CENTRAL_WIDTH, height: centralHeight });
  if (best) {
    const offset = centralHeight / 2 + CENTRAL_GAP;
    placeSide(best.c, 'causa', offset, out, slots);
    placeSide(best.e, 'efecto', offset, out, slots);
    placeShared(index, sharedCauses, 'causa', offset + best.c.height + SHARED_GAP, out);
    placeShared(index, sharedEffects, 'efecto', offset + best.e.height + SHARED_GAP, out);
    routeEdges(index, visible, out, slots, { causa: offset + best.c.height, efecto: offset + best.e.height }, offset);
  }
  const all = [...out.boxes.values(), ...out.panels];
  const minX = Math.min(...all.map((b) => b.x));
  const minY = Math.min(...all.map((b) => b.y));
  const maxX = Math.max(...all.map((b) => b.x + b.width));
  const maxY = Math.max(...all.map((b) => b.y + b.height));
  out.bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  return out;
}
