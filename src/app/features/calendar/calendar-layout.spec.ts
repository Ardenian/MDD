import type { Placement } from '../../data/model/placement';
import { dayBounds } from './calendar-dates';
import { layoutDay } from './calendar-layout';

const day = dayBounds('2026-03-02');
const at = (hours: number, minutes = 0) => new Date(2026, 2, 2, hours, minutes).toISOString();
/** Whole hours or `[hours, minutes]` — the Date constructor truncates fractional hours. */
const time = (value: number | readonly [number, number]) =>
  typeof value === 'number' ? at(value) : at(value[0], value[1]);
const period = (
  id: string,
  from: number | readonly [number, number],
  to: number | readonly [number, number],
  fadeout?: { beforeMinutes: number; afterMinutes: number },
) => ({
  id,
  placement: {
    kind: 'period',
    start: time(from),
    end: time(to),
    ...(fadeout ? { fadeout } : {}),
  } as Placement,
});
const HOUR = 1 / 24;

describe('layoutDay', () => {
  it('gives two overlapping Periods two columns', () => {
    const { timed } = layoutDay([period('a', 9, 11), period('b', 10, 12)], day);

    expect(timed.map((item) => [item.id, item.column, item.columns])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
    ]);
  });

  it('gives a three-way overlap three columns', () => {
    const { timed } = layoutDay(
      [period('a', 9, 12), period('b', 10, 12), period('c', 11, 12)],
      day,
    );

    expect(timed.map((item) => item.columns)).toEqual([3, 3, 3]);
    expect(new Set(timed.map((item) => item.column)).size).toBe(3);
  });

  it('gives non-overlapping Periods one column each', () => {
    const { timed } = layoutDay([period('a', 9, 10), period('b', 13, 14)], day);

    expect(timed.map((item) => [item.column, item.columns])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('does not put Entries that only touch side by side', () => {
    const { timed } = layoutDay([period('a', 9, 10), period('b', 10, 11)], day);

    expect(timed.every((item) => item.columns === 1)).toBe(true);
  });

  it('reuses a freed column inside one overlap group', () => {
    const { timed } = layoutDay([period('a', 9, 12), period('b', 9, 10), period('c', 10, 11)], day);

    expect(timed.find((item) => item.id === 'c')).toMatchObject({ column: 1, columns: 2 });
  });

  it('draws a Period 09:00–10:30 with a 30-minute trailing Fadeout as a block and a band to 11:00', () => {
    const [item] = layoutDay(
      [period('a', 9, [10, 30], { beforeMinutes: 0, afterMinutes: 30 })],
      day,
    ).timed;

    expect(item!.block.top).toBeCloseTo(9 * HOUR);
    expect(item!.block.height).toBeCloseTo(1.5 * HOUR);
    expect(item!.fadeBefore).toBeNull();
    expect(item!.fadeAfter!.top).toBeCloseTo(10.5 * HOUR);
    expect(item!.fadeAfter!.height).toBeCloseTo(0.5 * HOUR);
  });

  it('lets overlap include the Fadeout bands, since they take up room too', () => {
    const { timed } = layoutDay(
      [
        period('a', 9, 10, { beforeMinutes: 0, afterMinutes: 60 }),
        period('b', 10, [10, 30], { beforeMinutes: 30, afterMinutes: 0 }),
      ],
      day,
    );

    expect(timed.map((item) => item.columns)).toEqual([2, 2]);
  });

  it('routes Day-bucketed Entries to the strip, never the grid', () => {
    const layout = layoutDay(
      [{ id: 'd', placement: { kind: 'dayBucketed', day: '2026-03-02' } }],
      day,
    );

    expect(layout).toEqual({ strip: ['d'], timed: [] });
  });

  it('leaves out Entries that belong to other days', () => {
    const layout = layoutDay(
      [
        { id: 'd', placement: { kind: 'dayBucketed', day: '2026-03-03' } },
        { id: 'p', placement: { kind: 'point', at: new Date(2026, 2, 3, 0, 0).toISOString() } },
      ],
      day,
    );

    expect(layout).toEqual({ strip: [], timed: [] });
  });

  it('gives a Point a minimum visual height', () => {
    const [item] = layoutDay([{ id: 'p', placement: { kind: 'point', at: at(8) } }], day).timed;

    expect(item!.isPoint).toBe(true);
    expect(item!.block.height).toBeCloseTo(20 / (24 * 60));
  });

  it('clips a Period crossing midnight and says so', () => {
    const [item] = layoutDay(
      [
        {
          id: 'n',
          placement: { kind: 'period', start: at(22), end: new Date(2026, 2, 3, 6).toISOString() },
        },
      ],
      day,
    ).timed;

    expect(item!.block.top).toBeCloseTo(22 * HOUR);
    expect(item!.block.top + item!.block.height).toBeCloseTo(1);
    expect(item!).toMatchObject({ startsBefore: false, endsAfter: true });
  });
});
