import { coveredSpan, movedTo, validatePlacement, withTimeMode } from './fadeout';

const at = (iso: string) => Date.parse(iso);

describe('coveredSpan', () => {
  it('extends a Point at 10:01 with a 1h trailing Fadeout to 11:01', () => {
    expect(
      coveredSpan({
        kind: 'point',
        at: '2026-03-01T10:01:00.000Z',
        fadeout: { beforeMinutes: 0, afterMinutes: 60 },
      }),
    ).toEqual({ start: at('2026-03-01T10:01:00.000Z'), end: at('2026-03-01T11:01:00.000Z') });
  });

  it('extends a Period 09:02–10:03 with 30m/60m to 08:32–11:03', () => {
    expect(
      coveredSpan({
        kind: 'period',
        start: '2026-03-01T09:02:00.000Z',
        end: '2026-03-01T10:03:00.000Z',
        fadeout: { beforeMinutes: 30, afterMinutes: 60 },
      }),
    ).toEqual({ start: at('2026-03-01T08:32:00.000Z'), end: at('2026-03-01T11:03:00.000Z') });
  });

  it('covers the whole day for a Day-bucketed Entry', () => {
    expect(coveredSpan({ kind: 'dayBucketed', day: '2026-03-01' })).toEqual({
      start: new Date(2026, 2, 1).getTime(),
      end: new Date(2026, 2, 2).getTime() - 1,
    });
  });
});

describe('validatePlacement', () => {
  it('accepts well-formed placements', () => {
    expect(validatePlacement({ kind: 'point', at: '2026-03-01T10:01:00.000Z' })).toBeNull();
    expect(validatePlacement({ kind: 'dayBucketed', day: '2026-03-01' })).toBeNull();
  });

  it('rejects a Period that ends before it starts', () => {
    expect(
      validatePlacement({
        kind: 'period',
        start: '2026-03-01T10:00:00.000Z',
        end: '2026-03-01T09:00:00.000Z',
      }),
    ).toBe('period-ends-before-start');
  });

  it('rejects a negative or fractional Fadeout', () => {
    const at = '2026-03-01T10:00:00.000Z';

    expect(
      validatePlacement({ kind: 'point', at, fadeout: { beforeMinutes: -5, afterMinutes: 0 } }),
    ).toBe('invalid-fadeout');
    expect(
      validatePlacement({
        kind: 'point',
        at,
        fadeout: { beforeMinutes: 0, afterMinutes: Number.NaN },
      }),
    ).toBe('invalid-fadeout');
  });

  it('rejects an unreadable time', () => {
    expect(validatePlacement({ kind: 'point', at: 'not a time' })).toBe('invalid-time');
    expect(validatePlacement({ kind: 'dayBucketed', day: '2026-13-45' })).toBe('invalid-time');
  });
});

describe('withTimeMode', () => {
  const point = {
    kind: 'point',
    at: '2026-03-01T10:00:00.000Z',
    fadeout: { beforeMinutes: 0, afterMinutes: 30 },
  } as const;

  it('turns a Point into a one-hour Period starting there, keeping its Fadeout', () => {
    expect(withTimeMode(point, 'period')).toEqual({
      kind: 'period',
      start: '2026-03-01T10:00:00.000Z',
      end: '2026-03-01T11:00:00.000Z',
      fadeout: { beforeMinutes: 0, afterMinutes: 30 },
    });
  });

  it('turns a Period into a Point at its start', () => {
    expect(
      withTimeMode(
        { kind: 'period', start: '2026-03-01T10:00:00.000Z', end: '2026-03-01T12:00:00.000Z' },
        'point',
      ),
    ).toEqual({ kind: 'point', at: '2026-03-01T10:00:00.000Z' });
  });

  it('drops the Fadeout when becoming Day-bucketed, which permits none', () => {
    const day = withTimeMode(point, 'dayBucketed');

    expect(day).toEqual({ kind: 'dayBucketed', day: expect.stringMatching(/^2026-03-0[12]$/) });
    expect(day).not.toHaveProperty('fadeout');
  });

  it('anchors a Day-bucketed Entry at 09:00 local when it gains a time', () => {
    expect(withTimeMode({ kind: 'dayBucketed', day: '2026-03-01' }, 'point')).toEqual({
      kind: 'point',
      at: new Date(2026, 2, 1, 9).toISOString(),
    });
  });

  it('returns the placement untouched when the mode does not change', () => {
    expect(withTimeMode(point, 'point')).toBe(point);
  });
});

describe('movedTo', () => {
  const now = Date.parse('2026-05-05T08:00:00.000Z');

  it('moves a Point to the instant, keeping its Fadeout', () => {
    expect(
      movedTo(
        {
          kind: 'point',
          at: '2026-03-01T10:00:00.000Z',
          fadeout: { beforeMinutes: 5, afterMinutes: 0 },
        },
        now,
      ),
    ).toEqual({
      kind: 'point',
      at: '2026-05-05T08:00:00.000Z',
      fadeout: { beforeMinutes: 5, afterMinutes: 0 },
    });
  });

  it('moves a Period keeping its length', () => {
    expect(
      movedTo(
        { kind: 'period', start: '2026-03-01T10:00:00.000Z', end: '2026-03-01T11:30:00.000Z' },
        now,
      ),
    ).toEqual({
      kind: 'period',
      start: '2026-05-05T08:00:00.000Z',
      end: '2026-05-05T09:30:00.000Z',
    });
  });

  it('moves a Day-bucketed Entry to the instant’s local day', () => {
    expect(movedTo({ kind: 'dayBucketed', day: '2026-03-01' }, now)).toEqual({
      kind: 'dayBucketed',
      day: expect.stringMatching(/^2026-05-0[45]$/),
    });
  });
});
