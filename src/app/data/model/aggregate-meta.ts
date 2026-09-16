/** Carried by every persisted aggregate. See ADR 0003. */
export interface AggregateMeta {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly revision: number;
  readonly ownerId: string;
  readonly userId: string;
}
