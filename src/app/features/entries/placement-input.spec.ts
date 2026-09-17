import { fromLocalDateTimeInput, minutesFromInput, toLocalDateTimeInput } from './placement-input';

describe('datetime-local conversion', () => {
  it('shows an instant as local wall-clock time', () => {
    expect(toLocalDateTimeInput(new Date(2026, 2, 1, 10, 1).toISOString())).toBe(
      '2026-03-01T10:01',
    );
  });

  it('reads local wall-clock time back as the same instant', () => {
    expect(fromLocalDateTimeInput('2026-03-01T10:01')).toBe(
      new Date(2026, 2, 1, 10, 1).toISOString(),
    );
  });

  it('round-trips', () => {
    const iso = new Date(2026, 11, 31, 23, 59).toISOString();

    expect(fromLocalDateTimeInput(toLocalDateTimeInput(iso))).toBe(iso);
  });

  it('rejects what the input cannot produce', () => {
    expect(fromLocalDateTimeInput('')).toBeNull();
    expect(fromLocalDateTimeInput('yesterday')).toBeNull();
    expect(toLocalDateTimeInput('not a time')).toBe('');
  });
});

describe('minutesFromInput', () => {
  it('treats an empty box as no Fadeout', () => {
    expect(minutesFromInput('')).toBe(0);
  });

  it('reads whole minutes and flags anything else', () => {
    expect(minutesFromInput('60')).toBe(60);
    expect(minutesFromInput('1.5')).toBeNaN();
  });
});
