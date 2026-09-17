import { type Interval, type Placement, resolveCoveredInterval } from '../../data/model/placement';
import type { DayBounds } from './calendar-dates';

export interface CalendarItem {
  readonly id: string;
  readonly placement: Placement;
}

/** A band's extent, as fractions of the day's height. */
export interface Band {
  readonly top: number;
  readonly height: number;
}

export interface TimedLayout {
  readonly id: string;
  /** Zero-based column within its overlap group, and how many columns the group has. */
  readonly column: number;
  readonly columns: number;
  /** The fixed placement, without Fadeout; `height` is at least the minimum visual length. */
  readonly block: Band;
  /** The Fadeout falloff bands either side of the block, if any fall inside the day. */
  readonly fadeBefore: Band | null;
  readonly fadeAfter: Band | null;
  readonly isPoint: boolean;
  /** The block continues from the previous day / into the next one. */
  readonly startsBefore: boolean;
  readonly endsAfter: boolean;
}

export interface DayLayout {
  /** Day-bucketed Entries sit in the strip above the grid, never on it. */
  readonly strip: readonly string[];
  readonly timed: readonly TimedLayout[];
}

export interface LayoutOptions {
  /** A Point, or a very short Period, still needs a clickable height. */
  readonly minVisualMs: number;
}

const DEFAULT_OPTIONS: LayoutOptions = { minVisualMs: 20 * 60_000 };

interface Positioned {
  readonly item: CalendarItem;
  readonly covered: Interval;
  readonly core: Interval;
  /** What occupies space on the grid: the covered span, stretched to the minimum length. */
  readonly visual: Interval;
}

/**
 * Pure geometry for one day column. Overlap is decided on each Entry's resolved covered
 * interval — Fadeout included, since the bands take up room too — and Entries that merely
 * touch (one ends at 10:00, the next starts at 10:00) do not share columns.
 */
export function layoutDay(
  items: readonly CalendarItem[],
  day: DayBounds,
  options: LayoutOptions = DEFAULT_OPTIONS,
): DayLayout {
  const strip: string[] = [];
  const positioned: Positioned[] = [];

  for (const item of items) {
    const covered = resolveCoveredInterval(item.placement);
    if (!(covered.start < day.end && covered.end >= day.start)) {
      continue;
    }
    if (item.placement.kind === 'dayBucketed') {
      strip.push(item.id);
      continue;
    }
    const core = resolveCoveredInterval({ ...item.placement, fadeout: undefined });
    const visualEnd = Math.max(covered.end, core.start + options.minVisualMs);
    positioned.push({ item, covered, core, visual: { start: covered.start, end: visualEnd } });
  }

  positioned.sort(
    (a, b) =>
      a.visual.start - b.visual.start ||
      b.visual.end - a.visual.end ||
      a.item.id.localeCompare(b.item.id),
  );

  const timed: TimedLayout[] = [];
  let group: { positioned: Positioned; column: number }[] = [];
  let columnEnds: number[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;

  const closeGroup = () => {
    for (const member of group) {
      timed.push(geometry(member.positioned, member.column, columnEnds.length, day, options));
    }
    group = [];
    columnEnds = [];
  };

  for (const entry of positioned) {
    if (entry.visual.start >= groupEnd) {
      closeGroup();
    }
    let column = columnEnds.findIndex((end) => end <= entry.visual.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(entry.visual.end);
    } else {
      columnEnds[column] = entry.visual.end;
    }
    group.push({ positioned: entry, column });
    groupEnd = Math.max(groupEnd, entry.visual.end);
  }
  closeGroup();

  return { strip, timed };
}

function geometry(
  positioned: Positioned,
  column: number,
  columns: number,
  day: DayBounds,
  options: LayoutOptions,
): TimedLayout {
  const length = day.end - day.start;
  const at = (instant: number) =>
    (Math.min(Math.max(instant, day.start), day.end) - day.start) / length;
  const { covered, core, item } = positioned;

  const blockTop = at(core.start);
  const blockBottom = at(Math.max(core.end, core.start + options.minVisualMs));
  const band = (from: number, to: number): Band | null => {
    const top = at(from);
    const height = at(to) - top;
    return height > 0 ? { top, height } : null;
  };

  return {
    id: item.id,
    column,
    columns,
    block: { top: blockTop, height: blockBottom - blockTop },
    fadeBefore: covered.start < core.start ? band(covered.start, core.start) : null,
    fadeAfter: covered.end > core.end ? band(core.end, covered.end) : null,
    isPoint: item.placement.kind === 'point',
    startsBefore: core.start < day.start,
    endsAfter: core.end > day.end,
  };
}
