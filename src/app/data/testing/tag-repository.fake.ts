import type { TagRepository } from '../ports/tag-repository';
import type { FakeEntryRepository } from './entry-repository.fake';

/** Reads the same tag counts `FakeEntryRepository` maintains, mirroring how the real
 *  `TagRepositoryIndexedDbAdapter` reads the store `EntryRepositoryIndexedDbAdapter`
 *  writes to. */
export class FakeTagRepository implements TagRepository {
  constructor(private readonly entryRepository: FakeEntryRepository) {}

  async listAll(): Promise<readonly string[]> {
    return this.activeTags().map(([tag]) => tag);
  }

  async suggest(prefix: string): Promise<readonly string[]> {
    const needle = prefix.toLowerCase();
    return this.activeTags()
      .filter(([tag]) => tag.toLowerCase().startsWith(needle))
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }

  private activeTags(): Array<[string, number]> {
    return [...this.entryRepository.tagCountsSnapshot().entries()].filter(([, count]) => count > 0);
  }
}
