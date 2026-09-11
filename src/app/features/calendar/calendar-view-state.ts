import type { Uuid } from '../../data/model/common';

export type CalendarView = 'day' | 'week';

export interface CalendarViewState {
  readonly view: CalendarView;
  /** YYYY-MM-DD */
  readonly visibleDate: string;
  readonly hiddenTrackerIds: readonly Uuid[];
  readonly showChildEntries: boolean;
}

export function serializeViewState(state: CalendarViewState): string {
  return JSON.stringify(state);
}

/**
 * Reads persisted (`localStorage`) view state defensively (`calendar/SPEC.md`): malformed
 * JSON, a wrong-shaped field, or a Tracker id that no longer exists all fall back to a
 * sane default rather than throwing or resurrecting stale state.
 */
export function deserializeViewState(
  raw: string | null,
  knownTrackerIds: ReadonlySet<Uuid>,
  fallback: CalendarViewState,
): CalendarViewState {
  if (raw === null) {
    return fallback;
  }

  let parsed: Partial<CalendarViewState>;
  try {
    parsed = JSON.parse(raw) as Partial<CalendarViewState>;
  } catch {
    return fallback;
  }

  return {
    view: parsed.view === 'day' || parsed.view === 'week' ? parsed.view : fallback.view,
    visibleDate: typeof parsed.visibleDate === 'string' ? parsed.visibleDate : fallback.visibleDate,
    hiddenTrackerIds: Array.isArray(parsed.hiddenTrackerIds)
      ? parsed.hiddenTrackerIds.filter(
          (id): id is Uuid => typeof id === 'string' && knownTrackerIds.has(id),
        )
      : fallback.hiddenTrackerIds,
    showChildEntries:
      typeof parsed.showChildEntries === 'boolean' ? parsed.showChildEntries : fallback.showChildEntries,
  };
}
