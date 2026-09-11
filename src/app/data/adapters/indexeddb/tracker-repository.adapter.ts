import { Injectable, inject } from '@angular/core';
import { dataError } from '../../model/data-error';
import type { FieldDef, Tracker, TrackerCreateInput, TrackerMetaPatch, TrackerVersion } from '../../model/tracker';
import type { Uuid } from '../../model/common';
import { IDENTITY_CONTEXT } from '../../ports/identity-context';
import type { TrackerRepository } from '../../ports/tracker-repository';
import { fieldDefsEqual } from '../../util/field-defs-equal';
import { stampNew, stampUpdate } from '../../util/aggregate';
import { STORE } from './database';
import { getAllRecords, getByIndex, getRecord, putRecord } from './store.util';

@Injectable()
export class TrackerRepositoryIndexedDbAdapter implements TrackerRepository {
  private readonly identityContext = inject(IDENTITY_CONTEXT);

  list(): Promise<readonly Tracker[]> {
    return getAllRecords<Tracker>(STORE.trackers);
  }

  async get(id: Uuid): Promise<Tracker | null> {
    const tracker = await getRecord<Tracker>(STORE.trackers, id);
    return tracker ?? null;
  }

  async create(input: TrackerCreateInput): Promise<Tracker> {
    const tracker: Tracker = {
      ...stampNew(this.identityContext.current()),
      name: input.name,
      defaultTimeMode: input.defaultTimeMode,
      currentVersion: 0,
      archived: false,
      draftFields: [],
    };

    return putRecord(STORE.trackers, tracker);
  }

  async saveDraft(id: Uuid, fields: readonly FieldDef[]): Promise<Tracker> {
    const tracker = await this.getOrThrow(id);
    const updated: Tracker = stampUpdate({ ...tracker, draftFields: fields });
    return putRecord(STORE.trackers, updated);
  }

  async commitDraft(id: Uuid): Promise<Tracker> {
    const tracker = await this.getOrThrow(id);

    if (tracker.draftFields === null) {
      return tracker;
    }

    // currentVersion === 0 means there is no Version yet to be "unchanged from" — the
    // first commit always mints Version 1, even from an empty (fieldless) Draft.
    if (tracker.currentVersion > 0) {
      const currentFields = (await this.getVersion(id, tracker.currentVersion))!.fields;
      if (fieldDefsEqual(tracker.draftFields, currentFields)) {
        const updated: Tracker = stampUpdate({ ...tracker, draftFields: null });
        return putRecord(STORE.trackers, updated);
      }
    }

    const nextVersion = tracker.currentVersion + 1;
    const versionRecord: TrackerVersion = {
      ...stampNew(this.identityContext.current()),
      trackerId: id,
      version: nextVersion,
      fields: tracker.draftFields,
    };
    await putRecord(STORE.trackerVersions, versionRecord);

    const updated: Tracker = stampUpdate({
      ...tracker,
      currentVersion: nextVersion,
      draftFields: null,
    });
    return putRecord(STORE.trackers, updated);
  }

  async discardDraft(id: Uuid): Promise<Tracker> {
    const tracker = await this.getOrThrow(id);
    if (tracker.draftFields === null) {
      return tracker;
    }
    return putRecord(STORE.trackers, stampUpdate({ ...tracker, draftFields: null }));
  }

  async updateMeta(id: Uuid, patch: TrackerMetaPatch): Promise<Tracker> {
    const tracker = await this.getOrThrow(id);
    const updated: Tracker = stampUpdate({
      ...tracker,
      name: patch.name ?? tracker.name,
      defaultTimeMode: patch.defaultTimeMode ?? tracker.defaultTimeMode,
    });
    return putRecord(STORE.trackers, updated);
  }

  async archive(id: Uuid): Promise<Tracker> {
    const tracker = await this.getOrThrow(id);
    return putRecord(STORE.trackers, stampUpdate({ ...tracker, archived: true }));
  }

  async unarchive(id: Uuid): Promise<Tracker> {
    const tracker = await this.getOrThrow(id);
    return putRecord(STORE.trackers, stampUpdate({ ...tracker, archived: false }));
  }

  async getVersion(trackerId: Uuid, version: number): Promise<TrackerVersion | null> {
    const record = await getByIndex<TrackerVersion>(STORE.trackerVersions, 'byTrackerAndVersion', [
      trackerId,
      version,
    ]);
    return record ?? null;
  }

  private async getOrThrow(id: Uuid): Promise<Tracker> {
    const tracker = await this.get(id);
    if (!tracker) {
      throw dataError('not-found', `Tracker ${id} not found`);
    }
    return tracker;
  }
}
