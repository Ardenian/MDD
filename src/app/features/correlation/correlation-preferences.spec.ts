import {
  DEFAULT_CORRELATION_PREFERENCES,
  forKnownTrackers,
  isSeriesVisible,
  parseCorrelationPreferences,
  serializeCorrelationPreferences,
  togglePinned,
  toggleSeriesVisible,
} from './correlation-preferences';

describe('parseCorrelationPreferences', () => {
  it('falls back to the defaults when nothing is stored', () => {
    expect(parseCorrelationPreferences(null)).toEqual(DEFAULT_CORRELATION_PREFERENCES);
  });

  it('falls back rather than throwing on unreadable storage', () => {
    expect(parseCorrelationPreferences('{ not json')).toEqual(DEFAULT_CORRELATION_PREFERENCES);
    expect(parseCorrelationPreferences('"a string"')).toEqual(DEFAULT_CORRELATION_PREFERENCES);
  });

  it('keeps only the string ids it recognises', () => {
    const stored = JSON.stringify({
      pinnedPairIds: ['a::b', 7, null],
      overlayTrackerIds: ['sleep'],
      hiddenSeriesIds: 'not an array',
    });

    expect(parseCorrelationPreferences(stored)).toEqual({
      pinnedPairIds: ['a::b'],
      overlayTrackerIds: ['sleep'],
      hiddenSeriesIds: [],
    });
  });

  it('round-trips through serialization', () => {
    const preferences = {
      pinnedPairIds: ['a::b'],
      overlayTrackerIds: ['sleep', 'workout'],
      hiddenSeriesIds: ['sleep|field|Hours'],
    };

    expect(parseCorrelationPreferences(serializeCorrelationPreferences(preferences))).toEqual(
      preferences,
    );
  });
});

describe('togglePinned', () => {
  it('pins a pair, keeping the order they were pinned in', () => {
    const once = togglePinned(DEFAULT_CORRELATION_PREFERENCES, 'a::b');
    const twice = togglePinned(once, 'c::d');

    expect(twice.pinnedPairIds).toEqual(['a::b', 'c::d']);
  });

  it('unpins a pair that was already pinned', () => {
    const pinned = togglePinned(DEFAULT_CORRELATION_PREFERENCES, 'a::b');

    expect(togglePinned(pinned, 'a::b').pinnedPairIds).toEqual([]);
  });
});

describe('overlay visibility', () => {
  it('shows every Series by default, including one that appears later', () => {
    expect(isSeriesVisible(DEFAULT_CORRELATION_PREFERENCES, 'brand-new-series')).toBe(true);
  });

  it('hides a Series that was toggled off, and shows it again when toggled back', () => {
    const hidden = toggleSeriesVisible(DEFAULT_CORRELATION_PREFERENCES, 'sleep|field|Hours');

    expect(isSeriesVisible(hidden, 'sleep|field|Hours')).toBe(false);
    expect(
      isSeriesVisible(toggleSeriesVisible(hidden, 'sleep|field|Hours'), 'sleep|field|Hours'),
    ).toBe(true);
  });

  it('leaves other Series alone', () => {
    const hidden = toggleSeriesVisible(DEFAULT_CORRELATION_PREFERENCES, 'a');

    expect(isSeriesVisible(hidden, 'b')).toBe(true);
  });
});

describe('forKnownTrackers', () => {
  it('drops a Tracker that no longer exists', () => {
    const preferences = {
      ...DEFAULT_CORRELATION_PREFERENCES,
      overlayTrackerIds: ['sleep', 'deleted'],
    };

    expect(forKnownTrackers(preferences, new Set(['sleep'])).overlayTrackerIds).toEqual(['sleep']);
  });

  it('leaves pins alone — a pinned pair outlives one scan', () => {
    const preferences = { ...DEFAULT_CORRELATION_PREFERENCES, pinnedPairIds: ['a::b'] };

    expect(forKnownTrackers(preferences, new Set()).pinnedPairIds).toEqual(['a::b']);
  });
});
