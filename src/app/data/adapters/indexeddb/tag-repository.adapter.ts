import { Injectable } from '@angular/core';
import type { TagRepository } from '../../ports/tag-repository';
import { STORE } from './database';
import { getAllRecords } from './store.util';

interface TagRecord {
  readonly text: string;
  readonly count: number;
}

/** The `tags` store's counts are maintained by `EntryRepositoryIndexedDbAdapter`. */
@Injectable()
export class TagRepositoryIndexedDbAdapter implements TagRepository {
  async listAll(): Promise<readonly string[]> {
    const tags = await this.activeTags();
    return tags.map((tag) => tag.text);
  }

  async suggest(prefix: string): Promise<readonly string[]> {
    const needle = prefix.toLowerCase();
    const tags = await this.activeTags();
    return tags
      .filter((tag) => tag.text.toLowerCase().startsWith(needle))
      .sort((a, b) => b.count - a.count)
      .map((tag) => tag.text);
  }

  private async activeTags(): Promise<TagRecord[]> {
    const tags = await getAllRecords<TagRecord>(STORE.tags);
    return tags.filter((tag) => tag.count > 0);
  }
}
