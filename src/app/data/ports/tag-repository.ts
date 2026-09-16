import { InjectionToken } from '@angular/core';
import type { Tag, TagSuggestion } from '../model/tag';

export interface TagRepository {
  listAll(): Promise<readonly Tag[]>;
  /** Case-insensitive prefix match, ranked by usage frequency then alphabetically. */
  suggest(prefix: string): Promise<readonly TagSuggestion[]>;
}

export const TAG_REPOSITORY = new InjectionToken<TagRepository>('TagRepository');
