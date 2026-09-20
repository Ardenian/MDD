import {
  type CoveredSpan,
  localDayOf,
  type Placement,
  resolveCoveredSpan,
} from '../../data/model/placement';
import type { TimeMode } from '../../data/model/tracker';

export type PlacementProblem = 'invalid-time' | 'period-ends-before-start' | 'invalid-fadeout';

const HOUR_MS = 3_600_000;

/**
 * Resolves through `data/`'s single definition rather than re-deriving the arithmetic,
 * so the Calendar and the range query can never disagree with the form about what an
 * Entry covers.
 */
export function coveredSpan(placement: Placement): CoveredSpan {
  return resolveCoveredSpan(placement);
}

export function validatePlacement(placement: Placement): PlacementProblem | null {
  switch (placement.kind) {
    case 'dayBucketed':
      return isValidDay(placement.day) ? null : 'invalid-time';
    case 'point':
      if (Number.isNaN(Date.parse(placement.at))) return 'invalid-time';
      break;
    case 'period': {
      const start = Date.parse(placement.start);
      const end = Date.parse(placement.end);
      if (Number.isNaN(start) || Number.isNaN(end)) return 'invalid-time';
      if (end < start) return 'period-ends-before-start';
      break;
    }
  }
  const fadeout = placement.fadeout;
  const isWholeMinutes = (minutes: number) => Number.isInteger(minutes) && minutes >= 0;
  return fadeout !== undefined &&
    !(isWholeMinutes(fadeout.beforeMinutes) && isWholeMinutes(fadeout.afterMinutes))
    ? 'invalid-fadeout'
    : null;
}

/** Switches the placement's Time mode while keeping it anchored where the user put it. */
export function withTimeMode(placement: Placement, mode: TimeMode): Placement {
  if (placement.kind === mode) {
    return placement;
  }
  const anchor = anchorOf(placement);
  switch (mode) {
    case 'point':
      return withFadeout({ kind: 'point', at: new Date(anchor).toISOString() }, placement);
    case 'period':
      return withFadeout(
        {
          kind: 'period',
          start: new Date(anchor).toISOString(),
          end: new Date(anchor + HOUR_MS).toISOString(),
        },
        placement,
      );
    case 'dayBucketed':
      return { kind: 'dayBucketed', day: localDayOf(anchor) };
  }
}

function anchorOf(placement: Placement): number {
  switch (placement.kind) {
    case 'point':
      return Date.parse(placement.at);
    case 'period':
      return Date.parse(placement.start);
    case 'dayBucketed': {
      const [year, month, day] = placement.day.split('-').map(Number);
      return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 9).getTime();
    }
  }
}

function withFadeout<T extends Placement>(target: T, source: Placement): T {
  return source.kind !== 'dayBucketed' && source.fadeout !== undefined
    ? { ...target, fadeout: source.fadeout }
    : target;
}

function isValidDay(day: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (match === null) {
    return false;
  }
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(year, month - 1, date);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === date
  );
}

/**
 * Moves a placement so it starts at `instant`, keeping its Time mode, its Period length
 * and its Fadeout — what the "Now" shortcut does.
 */
export function movedTo(placement: Placement, instant: number): Placement {
  switch (placement.kind) {
    case 'point':
      return { ...placement, at: new Date(instant).toISOString() };
    case 'period': {
      const length = Math.max(0, Date.parse(placement.end) - Date.parse(placement.start));
      return {
        ...placement,
        start: new Date(instant).toISOString(),
        end: new Date(instant + length).toISOString(),
      };
    }
    case 'dayBucketed':
      return { kind: 'dayBucketed', day: localDayOf(instant) };
  }
}
