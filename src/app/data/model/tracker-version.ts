import type { AggregateMeta } from './aggregate-meta';
import type { FieldDef } from './field-def';

/**
 * Immutable, sequentially numbered snapshot of a Tracker's Field schema. Write-once:
 * never updated, never soft-deleted, `revision` always 1 (ADR 0005, data/SPEC.md).
 */
export interface TrackerVersion extends AggregateMeta {
  readonly trackerId: string;
  readonly version: number;
  readonly fields: readonly FieldDef[];
}

export function trackerVersionKey(trackerId: string, version: number): string {
  return `${trackerId}:${version}`;
}
