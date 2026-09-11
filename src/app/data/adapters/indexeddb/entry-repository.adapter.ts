import { Injectable, inject } from '@angular/core';
import type { Uuid } from '../../model/common';
import { dataError } from '../../model/data-error';
import type { Entry, EntryInput, EntryPatch, ListEntriesOptions } from '../../model/entry';
import { IDENTITY_CONTEXT } from '../../ports/identity-context';
import type { EntryRepository } from '../../ports/entry-repository';
import { TRACKER_REPOSITORY } from '../../ports/tracker-repository';
import { stampNew, stampSoftDelete, stampUpdate } from '../../util/aggregate';
import { STORE } from './database';
import { resolvePlacementRange, rangesOverlap } from './placement-range.util';
import { getAllByIndex, getAllRecords, getRecord, putRecord } from './store.util';

interface TagRecord {
  readonly text: string;
  readonly count: number;
}

@Injectable()
export class EntryRepositoryIndexedDbAdapter implements EntryRepository {
  private readonly identityContext = inject(IDENTITY_CONTEXT);
  private readonly trackerRepository = inject(TRACKER_REPOSITORY);

  async get(id: Uuid): Promise<Entry | null> {
    const entry = await getRecord<Entry>(STORE.entries, id);
    return entry ?? null;
  }

  async listByRange(start: string, end: string, options?: ListEntriesOptions): Promise<readonly Entry[]> {
    const queryStart = Date.parse(start);
    const queryEnd = Date.parse(end);
    const includeChildren = options?.includeChildren ?? false;

    const entries = await getAllRecords<Entry>(STORE.entries);

    return entries
      .filter((entry) => entry.deletedAt === null)
      .filter((entry) => includeChildren || entry.parentEntryId === null)
      .filter((entry) => rangesOverlap(resolvePlacementRange(entry.placement), queryStart, queryEnd))
      .sort(
        (a, b) => resolvePlacementRange(a.placement).start - resolvePlacementRange(b.placement).start,
      );
  }

  async listByTracker(trackerId: Uuid): Promise<readonly Entry[]> {
    const entries = await getAllByIndex<Entry>(STORE.entries, 'byTracker', trackerId);
    return entries.filter((entry) => entry.deletedAt === null);
  }

  async listChildren(parentId: Uuid): Promise<readonly Entry[]> {
    const entries = await getAllByIndex<Entry>(STORE.entries, 'byParent', parentId);
    return entries.filter((entry) => entry.deletedAt === null);
  }

  async create(input: EntryInput): Promise<Entry> {
    const tracker = await this.trackerRepository.get(input.trackerId);
    if (!tracker) {
      throw dataError('invalid-input', `Tracker ${input.trackerId} not found`);
    }
    if (tracker.currentVersion === 0) {
      throw dataError('invalid-input', `Tracker ${input.trackerId} has no committed Version yet`);
    }

    const entry: Entry = {
      ...stampNew(this.identityContext.current()),
      trackerId: input.trackerId,
      trackerVersion: tracker.currentVersion,
      parentEntryId: input.parentEntryId,
      placement: input.placement,
      snapshot: input.snapshot,
      tags: input.tags,
    };

    await this.adjustTagCounts([], entry.tags);
    return putRecord(STORE.entries, entry);
  }

  async update(id: Uuid, patch: EntryPatch): Promise<Entry> {
    const entry = await this.getOrThrow(id);
    const nextTags = patch.tags ?? entry.tags;

    if (patch.tags) {
      await this.adjustTagCounts(entry.tags, nextTags);
    }

    const updated: Entry = stampUpdate({
      ...entry,
      placement: patch.placement ?? entry.placement,
      snapshot: patch.snapshot ?? entry.snapshot,
      tags: nextTags,
    });
    return putRecord(STORE.entries, updated);
  }

  async softDelete(id: Uuid): Promise<void> {
    const entry = await this.getOrThrow(id);
    await this.adjustTagCounts(entry.tags, []);
    await putRecord(STORE.entries, stampSoftDelete(entry));
  }

  private async getOrThrow(id: Uuid): Promise<Entry> {
    const entry = await this.get(id);
    if (!entry || entry.deletedAt !== null) {
      throw dataError('not-found', `Entry ${id} not found`);
    }
    return entry;
  }

  /** Keeps the `tags` frequency index (read by TagRepository) in sync. */
  private async adjustTagCounts(previousTags: readonly string[], nextTags: readonly string[]): Promise<void> {
    const removed = previousTags.filter((tag) => !nextTags.includes(tag));
    const added = nextTags.filter((tag) => !previousTags.includes(tag));

    for (const tag of removed) {
      const record = await getRecord<TagRecord>(STORE.tags, tag);
      if (!record) {
        continue;
      }
      if (record.count <= 1) {
        await putRecord(STORE.tags, { text: tag, count: 0 });
      } else {
        await putRecord(STORE.tags, { text: tag, count: record.count - 1 });
      }
    }

    for (const tag of added) {
      const record = await getRecord<TagRecord>(STORE.tags, tag);
      await putRecord(STORE.tags, { text: tag, count: (record?.count ?? 0) + 1 });
    }
  }
}
