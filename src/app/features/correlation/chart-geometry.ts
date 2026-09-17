import type { SeriesValue } from './correlation-stats';

/** The drawing area of a chart, in the SVG's own coordinates. */
export interface ChartBox {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

export interface Extent {
  readonly min: number;
  readonly max: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The span a Series occupies. A Series that never moves still needs a band to be drawn
 * in, so a flat one is given a unit of room and sits in the middle of it.
 */
export function extentOf(values: readonly SeriesValue[]): Extent {
  const present = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (present.length === 0) {
    return { min: 0, max: 1 };
  }
  const min = Math.min(...present);
  const max = Math.max(...present);
  return min === max ? { min: min - 0.5, max: max + 0.5 } : { min, max };
}

/** Maps a value onto a pixel position, with the y axis growing upward as charts do. */
export function scaleY(value: number, extent: Extent, box: ChartBox): number {
  const span = extent.max - extent.min;
  const ratio = span === 0 ? 0.5 : (value - extent.min) / span;
  return box.height - box.padding - ratio * (box.height - 2 * box.padding);
}

/** Maps a 0..1 position onto the drawing area — the basis of both x scales. */
export function scaleRatioX(ratio: number, box: ChartBox): number {
  return box.padding + ratio * (box.width - 2 * box.padding);
}

/** Buckets are evenly spaced, the first and last sitting on the edges. */
export function scaleX(index: number, count: number, box: ChartBox): number {
  return count <= 1 ? box.width / 2 : scaleRatioX(index / (count - 1), box);
}

/**
 * An SVG path for a Series. A gap in the data breaks the line rather than being bridged:
 * drawing straight through a Bucket with no Entries would invent data that was never
 * recorded.
 */
export function linePath(values: readonly SeriesValue[], extent: Extent, box: ChartBox): string {
  let path = '';
  let penDown = false;

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      penDown = false;
      return;
    }
    const x = scaleX(index, values.length, box);
    const y = scaleY(value, extent, box);
    path += `${penDown ? 'L' : 'M'}${round(x)},${round(y)} `;
    penDown = true;
  });

  return path.trim();
}

/** Only Buckets where both Series have a value can be plotted against each other. */
export function scatterPoints(
  a: readonly SeriesValue[],
  b: readonly SeriesValue[],
  box: ChartBox,
): readonly Point[] {
  const extentA = extentOf(a);
  const extentB = extentOf(b);
  const points: Point[] = [];

  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const left = a[index];
    const right = b[index];
    if (left === null || right === null) {
      continue;
    }
    points.push({
      x: round(scaleRatioX(ratio(left, extentA), box)),
      y: round(scaleY(right, extentB, box)),
    });
  }
  return points;
}

function ratio(value: number, extent: Extent): number {
  const span = extent.max - extent.min;
  return span === 0 ? 0.5 : (value - extent.min) / span;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
