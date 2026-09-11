import { Injectable, inject } from '@angular/core';
import type { CorrelationDataset, CorrelationScope } from '../../model/correlation';
import type { Entry } from '../../model/entry';
import type { TrackerVersion } from '../../model/tracker';
import { ENTRY_REPOSITORY } from '../../ports/entry-repository';
import type { CorrelationDataSource } from '../../ports/correlation-data-source';
import { TRACKER_REPOSITORY } from '../../ports/tracker-repository';

const MAX_ANCESTOR_HOPS = 32;

@Injectable()
export class CorrelationDataSourceIndexedDbAdapter implements CorrelationDataSource {
  private readonly entryRepository = inject(ENTRY_REPOSITORY);
  private readonly trackerRepository = inject(TRACKER_REPOSITORY);

  async loadEntriesForScope(scope: CorrelationScope): Promise<CorrelationDataset> {
    const candidates = await this.entryRepository.listByRange(scope.from, scope.to, {
      includeChildren: true,
    });
    const byId = new Map(candidates.map((entry) => [entry.id, entry]));

    const inScope = candidates.filter((entry) =>
      this.isInScope(entry, byId, scope.trackerIds),
    );

    const trackerVersions = await this.loadReferencedVersions(inScope);
    const tags = [...new Set(inScope.flatMap((entry) => entry.tags))].sort();

    return { entries: inScope, trackerVersions, tags };
  }

  private isInScope(
    entry: Entry,
    byId: ReadonlyMap<string, Entry>,
    trackerIds: CorrelationScope['trackerIds'],
  ): boolean {
    if (trackerIds === 'all') {
      return true;
    }

    const root = this.resolveRoot(entry, byId);
    return trackerIds.includes(root.trackerId);
  }

  /** Walks the parent chain to the top-level ancestor (no re-parenting means no cycles). */
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

  private async loadReferencedVersions(entries: readonly Entry[]): Promise<readonly TrackerVersion[]> {
    const keys = new Set(entries.map((entry) => `${entry.trackerId}::${entry.trackerVersion}`));
    const versions = await Promise.all(
      [...keys].map((key) => {
        const [trackerId, version] = key.split('::');
        return this.trackerRepository.getVersion(trackerId, Number(version));
      }),
    );
    return versions.filter((version): version is TrackerVersion => version !== null);
  }
}
