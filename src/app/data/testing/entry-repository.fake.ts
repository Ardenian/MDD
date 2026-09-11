import type { Uuid } from '../model/common';
import { dataError } from '../model/data-error';
import type { Entry, EntryInput, EntryPatch, ListEntriesOptions } from '../model/entry';
import type { Identity } from '../model/identity';
import type { EntryRepository } from '../ports/entry-repository';
import type { TrackerRepository } from '../ports/tracker-repository';
import { stampNew, stampSoftDelete, stampUpdate } from '../util/aggregate';
import { resolvePlacementRange, rangesOverlap } from '../adapters/indexeddb/placement-range.util';

/** In-memory double satisfying the same contract as the IndexedDB adapter. */
export class FakeEntryRepository implements EntryRepository {
  private readonly entries = new Map<Uuid, Entry>();
  private readonly tagCounts = new Map<string, number>();

  constructor(
    private readonly trackerRepository: TrackerRepository,
    private readonly identity: Identity = { ownerId: 'dev', userId: 'dev' },
  ) {}

  async get(id: Uuid): Promise<Entry | null> {
    return this.entries.get(id) ?? null;
  }

  async listByRange(start: string, end: string, options?: ListEntriesOptions): Promise<readonly Entry[]> {
    const queryStart = Date.parse(start);
    const queryEnd = Date.parse(end);
    const includeChildren = options?.includeChildren ?? false;

    return [...this.entries.values()]
      .filter((entry) => entry.deletedAt === null)
      .filter((entry) => includeChildren || entry.parentEntryId === null)
      .filter((entry) => rangesOverlap(resolvePlacementRange(entry.placement), queryStart, queryEnd))
      .sort((a, b) => resolvePlacementRange(a.placement).start - resolvePlacementRange(b.placement).start);
  }

  async listByTracker(trackerId: Uuid): Promise<readonly Entry[]> {
    return [...this.entries.values()].filter(
      (entry) => entry.trackerId === trackerId && entry.deletedAt === null,
    );
  }

  async listChildren(parentId: Uuid): Promise<readonly Entry[]> {
    return [...this.entries.values()].filter(
      (entry) => entry.parentEntryId === parentId && entry.deletedAt === null,
    );
  }

  async create(input: EntryInput): Promise<Entry> {
    const tracker = await this.trackerRepository.get(input.trackerId);
    if (!tracker || tracker.currentVersion === 0) {
      throw dataError('invalid-input', `Tracker ${input.trackerId} has no committed Version yet`);
    }

    const entry: Entry = {
      ...stampNew(this.identity),
      trackerId: input.trackerId,
      trackerVersion: tracker.currentVersion,
      parentEntryId: input.parentEntryId,
      placement: input.placement,
      snapshot: input.snapshot,
      tags: input.tags,
    };

    this.adjustTagCounts([], entry.tags);
    this.entries.set(entry.id, entry);
    return entry;
  }

  async update(id: Uuid, patch: EntryPatch): Promise<Entry> {
    const entry = this.getOrThrow(id);
    const nextTags = patch.tags ?? entry.tags;

    if (patch.tags) {
      this.adjustTagCounts(entry.tags, nextTags);
    }

    const updated = stampUpdate({
      ...entry,
      placement: patch.placement ?? entry.placement,
      snapshot: patch.snapshot ?? entry.snapshot,
      tags: nextTags,
    });
    this.entries.set(id, updated);
    return updated;
  }

  async softDelete(id: Uuid): Promise<void> {
    const entry = this.getOrThrow(id);
    this.adjustTagCounts(entry.tags, []);
    this.entries.set(id, stampSoftDelete(entry));
  }

  /** Test-only accessor mirroring what `TagRepositoryIndexedDbAdapter` reads. */
  tagCountsSnapshot(): ReadonlyMap<string, number> {
    return new Map(this.tagCounts);
  }

  /** Test-only reset, used by `FakeMaintenancePort`. */
  clear(): void {
    this.entries.clear();
    this.tagCounts.clear();
  }

  private adjustTagCounts(previousTags: readonly string[], nextTags: readonly string[]): void {
    for (const tag of previousTags.filter((t) => !nextTags.includes(t))) {
      this.tagCounts.set(tag, Math.max(0, (this.tagCounts.get(tag) ?? 0) - 1));
    }
    for (const tag of nextTags.filter((t) => !previousTags.includes(t))) {
      this.tagCounts.set(tag, (this.tagCounts.get(tag) ?? 0) + 1);
    }
  }

  private getOrThrow(id: Uuid): Entry {
    const entry = this.entries.get(id);
    if (!entry || entry.deletedAt !== null) {
      throw dataError('not-found', `Entry ${id} not found`);
    }
    return entry;
  }
}
