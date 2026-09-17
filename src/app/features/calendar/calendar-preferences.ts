import type { CalendarView } from './calendar-dates';

/**
 * Convenience state kept on this device only — never the source of truth, so anything
 * unreadable quietly falls back to a default rather than breaking the page.
 */
export interface CalendarPreferences {
  readonly view: CalendarView;
  /** Hidden rather than shown, so a Tracker created later starts out visible. */
  readonly hiddenTrackerIds: readonly string[];
  readonly showChildren: boolean;
}

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  view: 'day',
  hiddenTrackerIds: [],
  showChildren: false,
};

export const CALENDAR_PREFERENCES_KEY = 'diary-calendar.calendar-preferences';

export function parsePreferences(raw: string | null): CalendarPreferences {
  let parsed: unknown;
  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    return DEFAULT_CALENDAR_PREFERENCES;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_CALENDAR_PREFERENCES;
  }
  const record = parsed as Record<string, unknown>;
  return {
    view: record['view'] === 'week' ? 'week' : 'day',
    hiddenTrackerIds: Array.isArray(record['hiddenTrackerIds'])
      ? record['hiddenTrackerIds'].filter((id): id is string => typeof id === 'string')
      : [],
    showChildren: record['showChildren'] === true,
  };
}

export function serializePreferences(preferences: CalendarPreferences): string {
  return JSON.stringify(preferences);
}

/** A stored id for a Tracker that no longer exists is simply ignored. */
export function forKnownTrackers(
  preferences: CalendarPreferences,
  knownIds: ReadonlySet<string>,
): CalendarPreferences {
  return {
    ...preferences,
    hiddenTrackerIds: preferences.hiddenTrackerIds.filter((id) => knownIds.has(id)),
  };
}
