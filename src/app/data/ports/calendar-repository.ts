import { InjectionToken } from '@angular/core';
import type { Calendar } from '../model/calendar';

/**
 * Raw, storage-shaped port for the single implicit Calendar (not enumerated in
 * `data/SPEC.md`'s original port list, added to back `core/SPEC.md`'s "ensure exactly
 * one Calendar record exists on first run" responsibility — same pattern as every other
 * aggregate rather than a one-off). Only `core/`'s bootstrap uses this in v1.
 */
export interface CalendarRepository {
  get(): Promise<Calendar | null>;
  /** Creates the single Calendar record if none exists yet; otherwise returns it as-is. */
  ensureExists(): Promise<Calendar>;
}

export const CALENDAR_REPOSITORY = new InjectionToken<CalendarRepository>('CalendarRepository');
