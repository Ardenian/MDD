import { InjectionToken } from '@angular/core';

/**
 * Raw, storage-shaped port over the Tag index derived from Entries' tag arrays. Tags
 * have no independent identity (CONTEXT.md) — this port only ever returns text.
 */
export interface TagRepository {
  listAll(): Promise<readonly string[]>;
  /** Case-insensitive prefix match, ranked by usage frequency. */
  suggest(prefix: string): Promise<readonly string[]>;
}

export const TAG_REPOSITORY = new InjectionToken<TagRepository>('TagRepository');
