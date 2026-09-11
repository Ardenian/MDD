import type { AggregateMeta, Timestamp, Uuid } from './common';

export interface Fadeout {
  readonly beforeMinutes: number;
  readonly afterMinutes: number;
}

export interface PointPlacement {
  readonly kind: 'point';
  readonly at: Timestamp;
  readonly fadeout: Fadeout | null;
}

export interface PeriodPlacement {
  readonly kind: 'period';
  readonly start: Timestamp;
  readonly end: Timestamp;
  readonly fadeout: Fadeout | null;
}

export interface DayBucketedPlacement {
  readonly kind: 'dayBucketed';
  /** YYYY-MM-DD */
  readonly day: string;
}

export type Placement = PointPlacement | PeriodPlacement | DayBucketedPlacement;

/** A Field value recorded on an Entry, keyed by name against its pinned Tracker Version. */
export interface SnapshotField {
  readonly fieldName: string;
  readonly value: unknown;
}

export interface Entry extends AggregateMeta {
  readonly trackerId: Uuid;
  /** The Tracker Version current when this Entry was created — pinned forever (ADR 0005). */
  readonly trackerVersion: number;
  /** Every Entry has zero or one parent; a child's placement always mirrors its parent's. */
  readonly parentEntryId: Uuid | null;
  readonly placement: Placement;
  readonly snapshot: readonly SnapshotField[];
  readonly tags: readonly string[];
}

export interface EntryInput {
  readonly trackerId: Uuid;
  readonly parentEntryId: Uuid | null;
  readonly placement: Placement;
  readonly snapshot: readonly SnapshotField[];
  readonly tags: readonly string[];
}

export interface EntryPatch {
  readonly placement?: Placement;
  readonly snapshot?: readonly SnapshotField[];
  readonly tags?: readonly string[];
}

export interface ListEntriesOptions {
  readonly includeChildren?: boolean;
}
