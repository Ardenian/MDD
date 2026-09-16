import { InjectionToken } from '@angular/core';
import type { FieldDef } from '../model/field-def';
import type { Tracker, TrackerCreateInput, TrackerMetaInput } from '../model/tracker';
import type { TrackerVersion } from '../model/tracker-version';

/** No `delete`: a Tracker is archived, never removed (ADR 0005). */
export interface TrackerRepository {
  list(): Promise<readonly Tracker[]>;
  get(id: string): Promise<Tracker | undefined>;
  create(input: TrackerCreateInput): Promise<Tracker>;
  saveDraft(id: string, fields: readonly FieldDef[]): Promise<Tracker>;
  /** Mints `currentVersion + 1`; a Draft equal to the current Version mints nothing. */
  commitDraft(id: string): Promise<Tracker>;
  updateMeta(id: string, input: TrackerMetaInput): Promise<Tracker>;
  archive(id: string): Promise<Tracker>;
  unarchive(id: string): Promise<Tracker>;
  getVersion(trackerId: string, version: number): Promise<TrackerVersion | undefined>;
}

export const TRACKER_REPOSITORY = new InjectionToken<TrackerRepository>('TrackerRepository');
