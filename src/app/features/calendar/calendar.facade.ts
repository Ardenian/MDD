import { Injectable, InjectionToken, inject } from '@angular/core';
import type { Entry, ListEntriesOptions } from '../../data/model/entry';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';

export interface CalendarViewData {
  /** Point / Period Entries — drawn on the time grid. */
  readonly gridEntries: readonly Entry[];
  /** Day-bucketed Entries — drawn in the day header strip, never the grid. */
  readonly stripEntries: readonly Entry[];
}

/**
 * Feature-local facade (ADR 0002): the Calendar page's only way to reach
 * `EntryRepository` — the only read this feature does. Only the Calendar page (this
 * feature's top-level component) injects this.
 */
export interface CalendarFacade {
  loadRange(start: string, end: string, options?: ListEntriesOptions): Promise<CalendarViewData>;
}

export const CALENDAR_FACADE = new InjectionToken<CalendarFacade>('CalendarFacade');

@Injectable()
export class CalendarFacadeService implements CalendarFacade {
  private readonly entryRepository = inject(ENTRY_REPOSITORY);

  async loadRange(start: string, end: string, options?: ListEntriesOptions): Promise<CalendarViewData> {
    const entries = await this.entryRepository.listByRange(start, end, options);
    return splitEntriesForDisplay(entries);
  }
}

export function splitEntriesForDisplay(entries: readonly Entry[]): CalendarViewData {
  return {
    gridEntries: entries.filter((entry) => entry.placement.kind !== 'dayBucketed'),
    stripEntries: entries.filter((entry) => entry.placement.kind === 'dayBucketed'),
  };
}
