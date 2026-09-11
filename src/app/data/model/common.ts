export type Uuid = string;

/** ISO 8601 timestamp. */
export type Timestamp = string;

/** Fields carried by every persisted aggregate (ADR 0003). */
export interface AggregateMeta {
  readonly id: Uuid;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  /** Set when soft-deleted; default reads exclude these rows. */
  readonly deletedAt: Timestamp | null;
  /** Monotonic per-record counter for conflict detection. */
  readonly revision: number;
  readonly ownerId: string;
  readonly userId: string;
}
