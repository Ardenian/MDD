import { localDayOf, resolveCoveredSpan, spansOverlap } from './placement';

describe('resolveCoveredSpan', () => {
  it('covers a Point plus its trailing Fadeout', () => {
    const span = resolveCoveredSpan({
      kind: 'point',
      at: '2026-03-01T10:01:00.000Z',
      fadeout: { beforeMinutes: 0, afterMinutes: 60 },
    });

    expect(span).toEqual({
      start: Date.parse('2026-03-01T10:01:00.000Z'),
      end: Date.parse('2026-03-01T11:01:00.000Z'),
    });
  });

  it('covers a Period widened on both sides by its Fadeout', () => {
    const span = resolveCoveredSpan({
      kind: 'period',
      start: '2026-03-01T09:02:00.000Z',
      end: '2026-03-01T10:03:00.000Z',
      fadeout: { beforeMinutes: 30, afterMinutes: 60 },
    });

    expect(span).toEqual({
      start: Date.parse('2026-03-01T08:32:00.000Z'),
      end: Date.parse('2026-03-01T11:03:00.000Z'),
    });
  });

  it('covers exactly one local calendar day for a Day-bucketed Entry', () => {
    expect(resolveCoveredSpan({ kind: 'dayBucketed', day: '2026-03-01' })).toEqual({
      start: new Date(2026, 2, 1).getTime(),
      end: new Date(2026, 2, 2).getTime() - 1,
    });
  });

  it('does not touch the following day', () => {
    const day = resolveCoveredSpan({ kind: 'dayBucketed', day: '2026-03-01' });
    const nextDay = {
      start: new Date(2026, 2, 2).getTime(),
      end: new Date(2026, 2, 3).getTime() - 1,
    };

    expect(spansOverlap(day, nextDay)).toBe(false);
  });

  it('rolls a Day-bucketed month end over correctly', () => {
    expect(resolveCoveredSpan({ kind: 'dayBucketed', day: '2026-02-28' }).end).toBe(
      new Date(2026, 2, 1).getTime() - 1,
    );
  });
});

describe('localDayOf', () => {
  it('names the local calendar day an instant falls on', () => {
    expect(localDayOf(new Date(2026, 0, 9, 23, 59).getTime())).toBe('2026-01-09');
  });
});

describe('spansOverlap', () => {
  it('counts touching spans as overlapping', () => {
    expect(spansOverlap({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(true);
    expect(spansOverlap({ start: 0, end: 10 }, { start: 11, end: 20 })).toBe(false);
  });
});
