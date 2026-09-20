import {
  DEFAULT_CORRELATION_PREFERENCES,
  forKnownSeries,
  forKnownTrackers,
  isSeriesVisible,
  parseCorrelationPreferences,
  serializeCorrelationPreferences,
  togglePinned,
  toggleSeriesInScope,
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
      scopeSeriesIds: ['sleep|field|Hours', 3],
    });

    expect(parseCorrelationPreferences(stored)).toEqual({
      pinnedPairIds: ['a::b'],
      overlayTrackerIds: ['sleep'],
      hiddenSeriesIds: [],
      scopeSeriesIds: ['sleep|field|Hours'],
    });
  });

  it('round-trips through serialization', () => {
    const preferences = {
      pinnedPairIds: ['a::b'],
      overlayTrackerIds: ['sleep', 'workout'],
      hiddenSeriesIds: ['sleep|field|Hours'],
      scopeSeriesIds: ['sleep|field|Hours', 'coffee|field|Cups'],
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

describe('toggleSeriesInScope', () => {
  const candidates = ['coffee|occurrence', 'coffee|field|Cups', 'sleep|field|Hours'];

  it('reads an empty selection as every Series, so the first switch-off names the rest', () => {
    const narrowed = toggleSeriesInScope(
      DEFAULT_CORRELATION_PREFERENCES,
      'coffee|occurrence',
      candidates,
    );

    expect(narrowed.scopeSeriesIds).toEqual(['coffee|field|Cups', 'sleep|field|Hours']);
  });

  it('collapses back to empty once every candidate is chosen again', () => {
    const narrowed = toggleSeriesInScope(
      DEFAULT_CORRELATION_PREFERENCES,
      'coffee|occurrence',
      candidates,
    );

    expect(toggleSeriesInScope(narrowed, 'coffee|occurrence', candidates).scopeSeriesIds).toEqual(
      [],
    );
  });

  it('narrows further without disturbing the other preferences', () => {
    const once = toggleSeriesInScope(
      DEFAULT_CORRELATION_PREFERENCES,
      'coffee|occurrence',
      candidates,
    );
    const twice = toggleSeriesInScope(once, 'coffee|field|Cups', candidates);

    expect(twice.scopeSeriesIds).toEqual(['sleep|field|Hours']);
    expect(twice.pinnedPairIds).toEqual([]);
    expect(twice.hiddenSeriesIds).toEqual([]);
  });
});

describe('forKnownSeries', () => {
  it('drops a Series key the latest extraction no longer produced', () => {
    // `Meal → Ingredients: Protein` read as a Nested reading; the Meal Tracker has since
    // left scope, so that key cannot come back (ADR 0015).
    const preferences = {
      ...DEFAULT_CORRELATION_PREFERENCES,
      scopeSeriesIds: ['meal>ingredients>protein|field|grams', 'sleep|field|Hours'],
    };

    expect(
      forKnownSeries(preferences, new Set(['protein|field|grams', 'sleep|field|Hours']))
        .scopeSeriesIds,
    ).toEqual(['sleep|field|Hours']);
  });

  it('never re-matches a vanished key onto the Standalone reading of the same Field', () => {
    const preferences = {
      ...DEFAULT_CORRELATION_PREFERENCES,
      scopeSeriesIds: ['meal>ingredients>protein|field|grams'],
    };

    expect(forKnownSeries(preferences, new Set(['protein|field|grams'])).scopeSeriesIds).toEqual(
      [],
    );
  });

  it('prunes a selection loaded from storage exactly as it prunes a scope change', () => {
    const stored = parseCorrelationPreferences(
      serializeCorrelationPreferences({
        ...DEFAULT_CORRELATION_PREFERENCES,
        scopeSeriesIds: ['sleep|field|Hours', 'deleted-tracker|occurrence'],
      }),
    );

    expect(forKnownSeries(stored, new Set(['sleep|field|Hours'])).scopeSeriesIds).toEqual([
      'sleep|field|Hours',
    ]);
  });

  it('leaves the overlay and the pins alone', () => {
    const preferences = {
      ...DEFAULT_CORRELATION_PREFERENCES,
      pinnedPairIds: ['a::b'],
      hiddenSeriesIds: ['sleep|field|Hours'],
      scopeSeriesIds: ['sleep|field|Hours'],
    };
    const pruned = forKnownSeries(preferences, new Set());

    expect(pruned.pinnedPairIds).toEqual(['a::b']);
    expect(pruned.hiddenSeriesIds).toEqual(['sleep|field|Hours']);
    expect(pruned.scopeSeriesIds).toEqual([]);
  });
});
