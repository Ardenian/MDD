import {
  addDays,
  dayBounds,
  daysInView,
  isDayKey,
  rangeOf,
  shiftView,
  slotOf,
  slotStart,
  SLOTS_PER_DAY,
  startOfWeek,
} from './calendar-dates';

describe('calendar dates', () => {
  it('recognises only real calendar days', () => {
    expect(isDayKey('2026-03-02')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('yesterday')).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('bounds a day by its local midnights', () => {
    expect(dayBounds('2026-03-02')).toEqual({
      start: new Date(2026, 2, 2).getTime(),
      end: new Date(2026, 2, 3).getTime(),
    });
  });

  it('starts a week on Monday', () => {
    expect(startOfWeek('2026-03-04')).toBe('2026-03-02');
    expect(startOfWeek('2026-03-08')).toBe('2026-03-02');
    expect(startOfWeek('2026-03-02')).toBe('2026-03-02');
  });

  it('shows one day, or the seven days of its week', () => {
    expect(daysInView('day', '2026-03-04')).toEqual(['2026-03-04']);
    expect(daysInView('week', '2026-03-04')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
  });

  it('steps by a day in Day view and a week in Week view', () => {
    expect(shiftView('day', '2026-03-04', 1)).toBe('2026-03-05');
    expect(shiftView('week', '2026-03-04', -1)).toBe('2026-02-25');
  });

  it('loads from the first local midnight to the last millisecond of the last day', () => {
    expect(rangeOf(['2026-03-02', '2026-03-03'])).toEqual({
      start: new Date(2026, 2, 2).toISOString(),
      end: new Date(new Date(2026, 2, 4).getTime() - 1).toISOString(),
    });
  });

  it('maps between slots and wall-clock time', () => {
    expect(SLOTS_PER_DAY).toBe(48);
    expect(slotStart('2026-03-02', 29)).toBe(new Date(2026, 2, 2, 14, 30).getTime());
    expect(slotOf(new Date(2026, 2, 2, 14, 59).getTime())).toBe(29);
  });
});
