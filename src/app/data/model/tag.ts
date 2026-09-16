import type { AggregateMeta } from './aggregate-meta';

/** A free-text label; the aggregate row is what autocomplete suggests from. */
export interface Tag extends AggregateMeta {
  readonly name: string;
}

export interface TagSuggestion {
  readonly name: string;
  readonly usageCount: number;
}
