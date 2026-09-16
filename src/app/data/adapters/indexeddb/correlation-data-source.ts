import type { Entry } from '../../model/entry';
import type { Tracker } from '../../model/tracker';
import { type TrackerVersion, trackerVersionKey } from '../../model/tracker-version';
import type {
  CorrelationDataSource,
  CorrelationDataset,
  DateRange,
  SeriesScope,
} from '../../ports/correlation-data-source';
import type { EntryRepository } from '../../ports/entry-repository';
import type { IdbEngine } from './idb-engine';
import { liveOnly } from './records';

export class IndexedDbCorrelationDataSource implements CorrelationDataSource {
  constructor(
    private readonly engine: IdbEngine,
    private readonly entries: EntryRepository,
  ) {}

  async loadEntriesForScope(range: DateRange, scope: SeriesScope): Promise<CorrelationDataset> {
    const inRange = await this.entries.listByRange(range.start, range.end, { includeChildren: true });
    const entries = scopeEntries(inRange, scope);

    const [trackers, trackerVersions] = await Promise.all([
      this.loadTrackers(entries),
      this.loadVersions(entries),
    ]);
    return { entries, trackers, trackerVersions };
  }

  private async loadTrackers(entries: readonly Entry[]): Promise<readonly Tracker[]> {
    const ids = [...new Set(entries.map((entry) => entry.trackerId))];
    const trackers = await Promise.all(ids.map((id) => this.engine.get<Tracker>('trackers', id)));
    return liveOnly(trackers.filter((tracker): tracker is Tracker => tracker !== undefined));
  }

  private async loadVersions(entries: readonly Entry[]): Promise<readonly TrackerVersion[]> {
    const keys = [
      ...new Set(entries.map((entry) => trackerVersionKey(entry.trackerId, entry.trackerVersion))),
    ];
    const versions = await Promise.all(
      keys.map((key) => this.engine.get<TrackerVersion>('trackerVersions', key)),
    );
    return versions.filter((version): version is TrackerVersion => version !== undefined);
  }
}

/**
 * A scoped Tracker brings its child Entries with it whatever Tracker they belong to —
 * a nested-child Series reads through a reference Field into another Tracker entirely.
 */
function scopeEntries(entries: readonly Entry[], scope: SeriesScope): readonly Entry[] {
  const trackerIds = scope.trackerIds ?? [];
  if (trackerIds.length === 0) {
    return entries;
  }

  const included = new Set(
    entries.filter((entry) => trackerIds.includes(entry.trackerId)).map((entry) => entry.id),
  );
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of entries) {
      if (entry.parentEntryId !== null && included.has(entry.parentEntryId) && !included.has(entry.id)) {
        included.add(entry.id);
        grew = true;
      }
    }
  }
  return entries.filter((entry) => included.has(entry.id));
}
