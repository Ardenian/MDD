import { deserializeViewState, serializeViewState, type CalendarViewState } from './calendar-view-state';

const fallback: CalendarViewState = {
  view: 'day',
  visibleDate: '2026-01-01',
  hiddenTrackerIds: [],
  showChildEntries: false,
};

describe('serializeViewState / deserializeViewState', () => {
  it('round-trips a valid state', () => {
    const state: CalendarViewState = {
      view: 'week',
      visibleDate: '2026-03-04',
      hiddenTrackerIds: ['tracker-1'],
      showChildEntries: true,
    };
    const known = new Set(['tracker-1']);

    const roundTripped = deserializeViewState(serializeViewState(state), known, fallback);

    expect(roundTripped).toEqual(state);
  });

  it('falls back entirely when there is nothing stored', () => {
    expect(deserializeViewState(null, new Set(), fallback)).toEqual(fallback);
  });

  it('falls back entirely on malformed JSON', () => {
    expect(deserializeViewState('{not json', new Set(), fallback)).toEqual(fallback);
  });

  it('drops a hidden Tracker id that no longer exists, keeping the rest', () => {
    const state: CalendarViewState = {
      view: 'day',
      visibleDate: '2026-01-01',
      hiddenTrackerIds: ['known', 'deleted'],
      showChildEntries: true,
    };
    const known = new Set(['known']);

    const result = deserializeViewState(serializeViewState(state), known, fallback);

    expect(result.hiddenTrackerIds).toEqual(['known']);
    expect(result.showChildEntries).toBe(true);
  });

  it('falls back per-field when a stored field has the wrong shape', () => {
    const raw = JSON.stringify({ view: 'sideways', visibleDate: 42, hiddenTrackerIds: 'nope' });
    const result = deserializeViewState(raw, new Set(), fallback);
    expect(result).toEqual(fallback);
  });
});
