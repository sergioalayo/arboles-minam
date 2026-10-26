import { memo } from 'react';
import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import type { Point } from '@/lib/layout';

export type RoutedFlowEdge = Edge<{ points: Point[] }, 'routed'>;

const RADIUS = 8;

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Punto a `r` px de `from` en dirección a `to`. */
function toward(from: Point, to: Point, r: number): Point {
  const len = dist(from, to) || 1;
  return { x: from.x + ((to.x - from.x) / len) * r, y: from.y + ((to.y - from.y) / len) * r };
}

/** Polilínea ortogonal con esquinas redondeadas (omite puntos repetidos o alineados). */
function roundedPath(input: Point[]): string {
  const pts: Point[] = [];
  for (const p of input) {
    const prev = pts[pts.length - 1];
    if (prev && dist(prev, p) < 0.5) continue;
    const before = pts[pts.length - 2];
    // Tres puntos en la misma recta: el del medio sobra.
    if (prev && before && ((before.x === prev.x && prev.x === p.x) || (before.y === prev.y && prev.y === p.y))) pts.pop();
    pts.push(p);
  }
  let d = '';
  pts.forEach((b, i) => {
    const a = pts[i - 1];
    const c = pts[i + 1];
    if (!a) d = `M ${b.x} ${b.y}`;
    else if (!c) d += ` L ${b.x} ${b.y}`;
    else {
      const r = Math.min(RADIUS, dist(a, b) / 2, dist(b, c) / 2);
      const p1 = toward(b, a, r);
      const p2 = toward(b, c, r);
      d += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
    }
  });
  return d;
}

/** Arista con trazo precalculado por el layout (lib/layout.ts → `routes`). */
function RoutedEdgeComponent({ id, data, style, markerStart, markerEnd }: EdgeProps<RoutedFlowEdge>) {
  return (
    <BaseEdge
      id={id}
      path={roundedPath(data?.points ?? [])}
      {...(style ? { style } : {})}
      {...(markerStart ? { markerStart } : {})}
      {...(markerEnd ? { markerEnd } : {})}
    />
  );
}

export const RoutedEdge = memo(RoutedEdgeComponent);
