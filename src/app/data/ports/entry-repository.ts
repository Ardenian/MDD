import { InjectionToken } from '@angular/core';
import type { Entry, EntryInput, EntryRangeOptions } from '../model/entry';

export interface EntryRepository {
  get(id: string): Promise<Entry | undefined>;
  /** Range-inclusive on the resolved covered interval (placement + Fadeout). */
  listByRange(start: string, end: string, options?: EntryRangeOptions): Promise<readonly Entry[]>;
  listByTracker(trackerId: string): Promise<readonly Entry[]>;
  /** Live Entry count per Tracker id, in one read — the Tracker list shows one per row. */
  countsByTracker(): Promise<ReadonlyMap<string, number>>;
  listChildren(parentEntryId: string): Promise<readonly Entry[]>;
  /** Resolves `trackerVersion` from the Tracker's `currentVersion` (ADR 0005). */
  create(input: EntryInput): Promise<Entry>;
  update(id: string, input: EntryInput): Promise<Entry>;
  softDelete(id: string): Promise<void>;
}

export const ENTRY_REPOSITORY = new InjectionToken<EntryRepository>('EntryRepository');
