import { InjectionToken } from '@angular/core';
import type { Uuid } from '../model/common';
import type { Entry, EntryInput, EntryPatch, ListEntriesOptions } from '../model/entry';

/**
 * Raw, storage-shaped port. Only `data/` facades and `core/`'s wiring inject this
 * directly — presentation code never does (ADR 0002).
 */
export interface EntryRepository {
  get(id: Uuid): Promise<Entry | null>;
  /** `start`/`end` are ISO timestamps; an Entry whose resolved (placement + Fadeout)
   *  interval overlaps the range at all is included. */
  listByRange(start: string, end: string, options?: ListEntriesOptions): Promise<readonly Entry[]>;
  listByTracker(trackerId: Uuid): Promise<readonly Entry[]>;
  listChildren(parentId: Uuid): Promise<readonly Entry[]>;
  /** Resolves `trackerVersion` from the target Tracker's `currentVersion` itself. */
  create(input: EntryInput): Promise<Entry>;
  update(id: Uuid, patch: EntryPatch): Promise<Entry>;
  softDelete(id: Uuid): Promise<void>;
}

export const ENTRY_REPOSITORY = new InjectionToken<EntryRepository>('EntryRepository');
