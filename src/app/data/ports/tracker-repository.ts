import { InjectionToken } from '@angular/core';
import type { Uuid } from '../model/common';
import type {
  FieldDef,
  Tracker,
  TrackerCreateInput,
  TrackerMetaPatch,
  TrackerVersion,
} from '../model/tracker';

/**
 * Raw, storage-shaped port. Only `data/` facades and `core/`'s wiring inject this
 * directly — presentation code never does (ADR 0002).
 */
export interface TrackerRepository {
  list(): Promise<readonly Tracker[]>;
  get(id: Uuid): Promise<Tracker | null>;
  create(input: TrackerCreateInput): Promise<Tracker>;
  saveDraft(id: Uuid, fields: readonly FieldDef[]): Promise<Tracker>;
  /** Mints the next Tracker Version; a no-op if the Draft is unchanged from current. */
  commitDraft(id: Uuid): Promise<Tracker>;
  updateMeta(id: Uuid, patch: TrackerMetaPatch): Promise<Tracker>;
  archive(id: Uuid): Promise<Tracker>;
  unarchive(id: Uuid): Promise<Tracker>;
  getVersion(trackerId: Uuid, version: number): Promise<TrackerVersion | null>;
}

export const TRACKER_REPOSITORY = new InjectionToken<TrackerRepository>('TrackerRepository');
