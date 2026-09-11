import type { CorrelationDataset, CorrelationScope } from '../model/correlation';
import type { Entry } from '../model/entry';
import type { TrackerVersion } from '../model/tracker';
import type { CorrelationDataSource } from '../ports/correlation-data-source';
import type { EntryRepository } from '../ports/entry-repository';
import type { TrackerRepository } from '../ports/tracker-repository';

const MAX_ANCESTOR_HOPS = 32;

/** Mirrors `CorrelationDataSourceIndexedDbAdapter`'s scoping rules over fake repositories. */
export class FakeCorrelationDataSource implements CorrelationDataSource {
  constructor(
    private readonly entryRepository: EntryRepository,
    private readonly trackerRepository: TrackerRepository,
  ) {}

  async loadEntriesForScope(scope: CorrelationScope): Promise<CorrelationDataset> {
    const candidates = await this.entryRepository.listByRange(scope.from, scope.to, {
      includeChildren: true,
    });
    const byId = new Map(candidates.map((entry) => [entry.id, entry]));
    const inScope = candidates.filter((entry) => this.isInScope(entry, byId, scope.trackerIds));

    const keys = new Set(inScope.map((entry) => `${entry.trackerId}::${entry.trackerVersion}`));
    const versions = await Promise.all(
      [...keys].map((key) => {
        const [trackerId, version] = key.split('::');
        return this.trackerRepository.getVersion(trackerId, Number(version));
      }),
    );

    return {
      entries: inScope,
      trackerVersions: versions.filter((version): version is TrackerVersion => version !== null),
      tags: [...new Set(inScope.flatMap((entry) => entry.tags))].sort(),
    };
  }

  private isInScope(
    entry: Entry,
    byId: ReadonlyMap<string, Entry>,
    trackerIds: CorrelationScope['trackerIds'],
  ): boolean {
    if (trackerIds === 'all') {
      return true;
    }
    return trackerIds.includes(this.resolveRoot(entry, byId).trackerId);
  }

  private resolveRoot(entry: Entry, byId: ReadonlyMap<string, Entry>): Entry {
    let current = entry;
    for (let hop = 0; hop < MAX_ANCESTOR_HOPS && current.parentEntryId !== null; hop++) {
      const parent = byId.get(current.parentEntryId);
      if (!parent) {
        break;
      }
      current = parent;
    }
    return current;
  }
}
