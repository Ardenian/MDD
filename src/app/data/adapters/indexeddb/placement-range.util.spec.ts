import { rangesOverlap, resolvePlacementRange } from './placement-range.util';
import type { Placement } from '../../model/entry';

const MINUTE_MS = 60_000;

describe('resolvePlacementRange', () => {
  it('resolves a Point with a trailing Fadeout', () => {
    const placement: Placement = {
      kind: 'point',
      at: '2026-01-01T10:01:00.000Z',
      fadeout: { beforeMinutes: 0, afterMinutes: 60 },
    };

    const range = resolvePlacementRange(placement);

    expect(range.start).toBe(Date.parse('2026-01-01T10:01:00.000Z'));
    expect(range.end).toBe(Date.parse('2026-01-01T10:01:00.000Z') + 60 * MINUTE_MS);
  });

  it('resolves a Period with leading and trailing Fadeout', () => {
    const placement: Placement = {
      kind: 'period',
      start: '2026-01-01T09:02:00.000Z',
      end: '2026-01-01T10:03:00.000Z',
      fadeout: { beforeMinutes: 30, afterMinutes: 60 },
    };

    const range = resolvePlacementRange(placement);

    expect(range.start).toBe(Date.parse('2026-01-01T08:32:00.000Z'));
    expect(range.end).toBe(Date.parse('2026-01-01T11:03:00.000Z'));
  });

  it('resolves a Point/Period with no Fadeout to its bare interval', () => {
    const point: Placement = { kind: 'point', at: '2026-01-01T10:00:00.000Z', fadeout: null };
    const range = resolvePlacementRange(point);
    expect(range.start).toBe(range.end);
  });

  it('resolves a Day-bucketed placement to the whole UTC day, ignoring Fadeout', () => {
    const placement: Placement = { kind: 'dayBucketed', day: '2026-01-01' };
    const range = resolvePlacementRange(placement);

    expect(range.start).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(range.end).toBe(Date.parse('2026-01-02T00:00:00.000Z'));
  });
});

describe('rangesOverlap', () => {
  it('is true when the range touches the query boundary', () => {
    const range = { start: 1000, end: 2000 };
    expect(rangesOverlap(range, 2000, 3000)).toBe(true);
    expect(rangesOverlap(range, 0, 1000)).toBe(true);
  });

  it('is false when the range is entirely outside the query', () => {
    const range = { start: 1000, end: 2000 };
    expect(rangesOverlap(range, 2001, 3000)).toBe(false);
    expect(rangesOverlap(range, 0, 999)).toBe(false);
  });
});
