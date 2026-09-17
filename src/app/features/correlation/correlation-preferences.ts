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
}

export const DEFAULT_CORRELATION_PREFERENCES: CorrelationPreferences = {
  pinnedPairIds: [],
  overlayTrackerIds: [],
  hiddenSeriesIds: [],
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
