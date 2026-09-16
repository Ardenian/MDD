import type { AggregateMeta } from './aggregate-meta';
import type { Placement } from './placement';

/**
 * A Field value frozen onto an Entry. No dataType: the schema is looked up from the
 * Entry's pinned (trackerId, trackerVersion) TrackerVersion (ADR 0005).
 */
export interface SnapshotField {
  readonly fieldName: string;
  readonly value: unknown;
}

export interface Entry extends AggregateMeta {
  readonly trackerId: string;
  /** The Tracker Version current when this Entry was created. Immutable thereafter. */
  readonly trackerVersion: number;
  readonly parentEntryId: string | null;
  readonly placement: Placement;
  readonly snapshot: readonly SnapshotField[];
  readonly tags: readonly string[];
}

/** No `trackerVersion`: the repository resolves it from the Tracker's `currentVersion`. */
export interface EntryInput {
  readonly trackerId: string;
  readonly parentEntryId: string | null;
  readonly placement: Placement;
  readonly snapshot: readonly SnapshotField[];
  readonly tags: readonly string[];
}

export interface EntryRangeOptions {
  readonly includeChildren?: boolean;
}
