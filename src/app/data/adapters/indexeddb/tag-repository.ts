import type { Entry } from '../../model/entry';
import type { Tag, TagSuggestion } from '../../model/tag';
import type { TagRepository } from '../../ports/tag-repository';
import type { IdbEngine } from './idb-engine';
import { liveOnly } from './records';

export class IndexedDbTagRepository implements TagRepository {
  constructor(private readonly engine: IdbEngine) {}

  async listAll(): Promise<readonly Tag[]> {
    const tags = liveOnly(await this.engine.getAll<Tag>('tags'));
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  async suggest(prefix: string): Promise<readonly TagSuggestion[]> {
    const normalised = prefix.toLowerCase();
    const [tags, entries] = await Promise.all([
      this.listAll(),
      this.engine.getAll<Entry>('entries'),
    ]);
    const usage = countUsage(liveOnly(entries));

    return tags
      .filter((tag) => tag.name.toLowerCase().startsWith(normalised))
      .map((tag) => ({ name: tag.name, usageCount: usage.get(tag.name) ?? 0 }))
      .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name));
  }
}

function countUsage(entries: readonly Entry[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      usage.set(tag, (usage.get(tag) ?? 0) + 1);
    }
  }
  return usage;
}
