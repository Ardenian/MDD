/**
 * Convenience state kept on this device only (ADR 0009) — never the source of truth, so
 * anything unreadable quietly falls back to a default rather than breaking the page.
 */
export interface CorrelationPreferences {
  /** Pair ids the user has pinned, in the order they pinned them. */
  readonly pinnedPairIds: readonly string[];
  /** Trackers chosen for the Series overlay. */
  readonly overlayTrackerIds: readonly string[];
  /**
   * Series switched *off* in the overlay rather than on: a Series that appears later —
   * a new Field, a new Tag — is then visible by default, as the SPEC asks.
   */
  readonly hiddenSeriesIds: readonly string[];
  /**
   * The Series a Discovery scan is narrowed to, by Series key. Empty means every
   * extracted Series is in scope, mirroring `SeriesScope.trackerIds`.
   *
   * Kept as an inclusion list rather than the overlay's exclusion list because a key
   * here is only meaningful relative to the Tracker scope that produced it (ADR 0015):
   * a key that the next extraction does not produce is dropped, and an exclusion list
   * would instead quietly keep excluding a Series nobody can see any more.
   */
  readonly scopeSeriesIds: readonly string[];
}

export const DEFAULT_CORRELATION_PREFERENCES: CorrelationPreferences = {
  pinnedPairIds: [],
  overlayTrackerIds: [],
  hiddenSeriesIds: [],
  scopeSeriesIds: [],
};

export const CORRELATION_PREFERENCES_KEY = 'diary-calendar.correlation-preferences';

export function parseCorrelationPreferences(raw: string | null): CorrelationPreferences {
  let parsed: unknown;
  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    return DEFAULT_CORRELATION_PREFERENCES;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_CORRELATION_PREFERENCES;
  }

  const record = parsed as Record<string, unknown>;
  return {
    pinnedPairIds: stringsOf(record['pinnedPairIds']),
    overlayTrackerIds: stringsOf(record['overlayTrackerIds']),
    hiddenSeriesIds: stringsOf(record['hiddenSeriesIds']),
    scopeSeriesIds: stringsOf(record['scopeSeriesIds']),
  };
}

export function serializeCorrelationPreferences(preferences: CorrelationPreferences): string {
  return JSON.stringify(preferences);
}

export function togglePinned(
  preferences: CorrelationPreferences,
  pairId: string,
): CorrelationPreferences {
  const pinned = preferences.pinnedPairIds.includes(pairId)
    ? preferences.pinnedPairIds.filter((id) => id !== pairId)
    : [...preferences.pinnedPairIds, pairId];
  return { ...preferences, pinnedPairIds: pinned };
}

export function toggleSeriesVisible(
  preferences: CorrelationPreferences,
  seriesId: string,
): CorrelationPreferences {
  const hidden = preferences.hiddenSeriesIds.includes(seriesId)
    ? preferences.hiddenSeriesIds.filter((id) => id !== seriesId)
    : [...preferences.hiddenSeriesIds, seriesId];
  return { ...preferences, hiddenSeriesIds: hidden };
}

export function isSeriesVisible(preferences: CorrelationPreferences, seriesId: string): boolean {
  return !preferences.hiddenSeriesIds.includes(seriesId);
}

/**
 * Switches one Series in or out of the scan's scope.
 *
 * An empty selection means "every Series", so the first Series switched off has to be
 * written out as every other candidate: an inclusion list has no way to say "all but
 * this one". Selecting every candidate again collapses back to empty, which is how a
 * Series that only appears in a later scan is in scope by default.
 *
 * `candidateIds` is what the user is choosing between — the Series of the Trackers in
 * scope, in the order they are shown.
 */
export function toggleSeriesInScope(
  preferences: CorrelationPreferences,
  seriesId: string,
  candidateIds: readonly string[],
): CorrelationPreferences {
  const chosen = new Set(
    preferences.scopeSeriesIds.length === 0 ? candidateIds : preferences.scopeSeriesIds,
  );
  if (chosen.has(seriesId)) {
    chosen.delete(seriesId);
  } else {
    chosen.add(seriesId);
  }
  const coversEveryCandidate =
    candidateIds.length > 0 &&
    candidateIds.every((id) => chosen.has(id)) &&
    chosen.size === candidateIds.length;
  return {
    ...preferences,
    scopeSeriesIds: coversEveryCandidate ? [] : [...chosen],
  };
}

/**
 * Drops every selected Series key the latest extraction did not produce.
 *
 * The one place a Series selection is narrowed, whether the keys came from a previous
 * Tracker scope or from this device's saved preferences — one policy, exercised twice.
 * A vanished key is never re-matched on Tracker + Field + type: that would silently
 * re-bind a Standalone reading to a Nested one, the conflation ADR 0015 exists to
 * prevent.
 */
export function forKnownSeries(
  preferences: CorrelationPreferences,
  knownIds: ReadonlySet<string>,
): CorrelationPreferences {
  return {
    ...preferences,
    scopeSeriesIds: preferences.scopeSeriesIds.filter((id) => knownIds.has(id)),
  };
}

/** A stored id for a Tracker that no longer exists is simply ignored. */
export function forKnownTrackers(
  preferences: CorrelationPreferences,
  knownIds: ReadonlySet<string>,
): CorrelationPreferences {
  return {
    ...preferences,
    overlayTrackerIds: preferences.overlayTrackerIds.filter((id) => knownIds.has(id)),
  };
}

function stringsOf(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
