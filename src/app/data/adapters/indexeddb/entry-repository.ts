import { DataError } from '../../model/data-error';
import type { Entry, EntryInput, EntryRangeOptions } from '../../model/entry';
import { intervalsOverlap, resolveCoveredInterval } from '../../model/placement';
import type { Tag } from '../../model/tag';
import type { Tracker } from '../../model/tracker';
import type { EntryRepository } from '../../ports/entry-repository';
import type { IdbEngine } from './idb-engine';
import { stampCreate, stampSoftDelete, stampUpdate, type StampContext } from './record-meta';
import { byCreation, liveOnly, requireLive } from './records';

export class IndexedDbEntryRepository implements EntryRepository {
  constructor(
    private readonly engine: IdbEngine,
    private readonly context: StampContext,
  ) {}

  async get(id: string): Promise<Entry | undefined> {
    return this.engine.get<Entry>('entries', id);
  }

  async listByRange(
    start: string,
    end: string,
    options?: EntryRangeOptions,
  ): Promise<readonly Entry[]> {
    const range = { start: Date.parse(start), end: Date.parse(end) };
    const entries = await this.live();
    return entries
      .filter((entry) => options?.includeChildren === true || entry.parentEntryId === null)
      .filter((entry) => intervalsOverlap(resolveCoveredInterval(entry.placement), range))
      .sort(byCreation);
  }

  async listByTracker(trackerId: string): Promise<readonly Entry[]> {
    const entries = await this.live();
    return entries.filter((entry) => entry.trackerId === trackerId).sort(byCreation);
  }

  async countsByTracker(): Promise<ReadonlyMap<string, number>> {
    const counts = new Map<string, number>();
    for (const entry of await this.live()) {
      counts.set(entry.trackerId, (counts.get(entry.trackerId) ?? 0) + 1);
    }
    return counts;
  }

  async listChildren(parentEntryId: string): Promise<readonly Entry[]> {
    const entries = await this.live();
    return entries.filter((entry) => entry.parentEntryId === parentEntryId).sort(byCreation);
  }

  async create(input: EntryInput): Promise<Entry> {
    const tracker = await this.requireTracker(input.trackerId);
    if (tracker.currentVersion === 0) {
      throw new DataError(
        'invalid',
        `Tracker ${tracker.id} has no committed Tracker Version to snapshot against`,
      );
    }
    const placement = await this.resolvePlacement(input);

    const entry = stampCreate(
      {
        trackerId: input.trackerId,
        trackerVersion: tracker.currentVersion,
        parentEntryId: input.parentEntryId,
        placement,
        snapshot: input.snapshot,
        tags: input.tags,
      },
      this.context,
    );
    await this.engine.put('entries', entry.id, entry);
    await this.registerTags(entry.tags);
    return entry;
  }

  async update(id: string, input: EntryInput): Promise<Entry> {
    const entry = requireLive(await this.get(id), 'Entry', id);
    if (input.parentEntryId !== entry.parentEntryId) {
      throw new DataError('invalid', 'An Entry cannot be re-parented');
    }
    if (input.trackerId !== entry.trackerId) {
      throw new DataError('invalid', 'An Entry cannot be moved to another Tracker');
    }
    const placement = await this.resolvePlacement(input);

    const updated = stampUpdate(
      entry,
      { placement, snapshot: input.snapshot, tags: input.tags },
      this.context,
    );
    await this.engine.put('entries', updated.id, updated);
    await this.registerTags(updated.tags);
    return updated;
  }

  /** Cascades: a child is only reachable through its parent, so it goes with it. */
  async softDelete(id: string): Promise<void> {
    const entries = await this.live();
    const doomed = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const entry of entries) {
        if (entry.parentEntryId !== null && doomed.has(entry.parentEntryId) && !doomed.has(entry.id)) {
          doomed.add(entry.id);
          grew = true;
        }
      }
    }

    await this.engine.putAll(
      'entries',
      entries
        .filter((entry) => doomed.has(entry.id))
        .map((entry) => [entry.id, stampSoftDelete(entry, this.context)] as const),
    );
  }

  private async resolvePlacement(input: EntryInput): Promise<Entry['placement']> {
    if (input.parentEntryId === null) {
      return input.placement;
    }
    const parent = requireLive(await this.get(input.parentEntryId), 'Entry', input.parentEntryId);
    return parent.placement;
  }

  private async registerTags(names: readonly string[]): Promise<void> {
    if (names.length === 0) {
      return;
    }
    const existing = liveOnly(await this.engine.getAll<Tag>('tags')).map((tag) => tag.name);
    const missing = [...new Set(names)].filter((name) => !existing.includes(name));
    await this.engine.putAll(
      'tags',
      missing.map((name) => {
        const tag = stampCreate({ name }, this.context);
        return [tag.id, tag] as const;
      }),
    );
  }

  private async requireTracker(id: string): Promise<Tracker> {
    return requireLive(await this.engine.get<Tracker>('trackers', id), 'Tracker', id);
  }

  private async live(): Promise<Entry[]> {
    return liveOnly(await this.engine.getAll<Entry>('entries'));
  }
}
