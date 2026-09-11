import type { Uuid } from '../model/common';
import { dataError } from '../model/data-error';
import type { Identity } from '../model/identity';
import type { FieldDef, Tracker, TrackerCreateInput, TrackerMetaPatch, TrackerVersion } from '../model/tracker';
import type { TrackerRepository } from '../ports/tracker-repository';
import { stampNew, stampUpdate } from '../util/aggregate';
import { fieldDefsEqual } from '../util/field-defs-equal';

/** In-memory double satisfying the same contract as the IndexedDB adapter. */
export class FakeTrackerRepository implements TrackerRepository {
  private readonly trackers = new Map<Uuid, Tracker>();
  private readonly versions = new Map<string, TrackerVersion>();

  constructor(private readonly identity: Identity = { ownerId: 'dev', userId: 'dev' }) {}

  async list(): Promise<readonly Tracker[]> {
    return [...this.trackers.values()];
  }

  async get(id: Uuid): Promise<Tracker | null> {
    return this.trackers.get(id) ?? null;
  }

  async create(input: TrackerCreateInput): Promise<Tracker> {
    const tracker: Tracker = {
      ...stampNew(this.identity),
      name: input.name,
      defaultTimeMode: input.defaultTimeMode,
      currentVersion: 0,
      archived: false,
      draftFields: [],
    };
    this.trackers.set(tracker.id, tracker);
    return tracker;
  }

  async saveDraft(id: Uuid, fields: readonly FieldDef[]): Promise<Tracker> {
    const updated = stampUpdate({ ...this.getOrThrow(id), draftFields: fields });
    this.trackers.set(id, updated);
    return updated;
  }

  async commitDraft(id: Uuid): Promise<Tracker> {
    const tracker = this.getOrThrow(id);
    if (tracker.draftFields === null) {
      return tracker;
    }

    // currentVersion === 0 means there is no Version yet to be "unchanged from" — the
    // first commit always mints Version 1, even from an empty (fieldless) Draft.
    if (tracker.currentVersion > 0) {
      const currentFields = this.versions.get(this.versionKey(id, tracker.currentVersion))!.fields;
      if (fieldDefsEqual(tracker.draftFields, currentFields)) {
        const updated = stampUpdate({ ...tracker, draftFields: null });
        this.trackers.set(id, updated);
        return updated;
      }
    }

    const nextVersion = tracker.currentVersion + 1;
    const versionRecord: TrackerVersion = {
      ...stampNew(this.identity),
      trackerId: id,
      version: nextVersion,
      fields: tracker.draftFields,
    };
    this.versions.set(this.versionKey(id, nextVersion), versionRecord);

    const updated = stampUpdate({ ...tracker, currentVersion: nextVersion, draftFields: null });
    this.trackers.set(id, updated);
    return updated;
  }

  async discardDraft(id: Uuid): Promise<Tracker> {
    const tracker = this.getOrThrow(id);
    if (tracker.draftFields === null) {
      return tracker;
    }
    const updated = stampUpdate({ ...tracker, draftFields: null });
    this.trackers.set(id, updated);
    return updated;
  }

  async updateMeta(id: Uuid, patch: TrackerMetaPatch): Promise<Tracker> {
    const tracker = this.getOrThrow(id);
    const updated = stampUpdate({
      ...tracker,
      name: patch.name ?? tracker.name,
      defaultTimeMode: patch.defaultTimeMode ?? tracker.defaultTimeMode,
    });
    this.trackers.set(id, updated);
    return updated;
  }

  async archive(id: Uuid): Promise<Tracker> {
    const updated = stampUpdate({ ...this.getOrThrow(id), archived: true });
    this.trackers.set(id, updated);
    return updated;
  }

  async unarchive(id: Uuid): Promise<Tracker> {
    const updated = stampUpdate({ ...this.getOrThrow(id), archived: false });
    this.trackers.set(id, updated);
    return updated;
  }

  async getVersion(trackerId: Uuid, version: number): Promise<TrackerVersion | null> {
    return this.versions.get(this.versionKey(trackerId, version)) ?? null;
  }

  /** Test-only reset, used by `FakeMaintenancePort`. */
  clear(): void {
    this.trackers.clear();
    this.versions.clear();
  }

  private versionKey(trackerId: Uuid, version: number): string {
    return `${trackerId}::${version}`;
  }

  private getOrThrow(id: Uuid): Tracker {
    const tracker = this.trackers.get(id);
    if (!tracker) {
      throw dataError('not-found', `Tracker ${id} not found`);
    }
    return tracker;
  }
}
