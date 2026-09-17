import type { AggregateMeta } from '../../model/aggregate-meta';

export interface StampContext {
  readonly ownerId: string;
  readonly userId: string;
  now(): string;
  newId(): string;
}

type Payload<T extends AggregateMeta> = Omit<T, keyof AggregateMeta>;

/** Applies the ADR 0003 invariants to a brand-new record. */
export function stampCreate<T extends object>(
  payload: T,
  context: StampContext,
): T & AggregateMeta {
  const timestamp = context.now();
  return {
    ...payload,
    id: context.newId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    revision: 1,
    ownerId: context.ownerId,
    userId: context.userId,
  };
}

/**
 * `changes` is payload-only by contract; the meta fields are re-applied afterwards so a
 * caller can never move `id`, `createdAt` or `revision` out from under the invariants.
 */
export function stampUpdate<T extends AggregateMeta>(
  record: T,
  changes: Partial<Payload<T>>,
  context: StampContext,
): T {
  return {
    ...record,
    ...changes,
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: context.now(),
    deletedAt: record.deletedAt,
    revision: record.revision + 1,
    ownerId: record.ownerId,
    userId: record.userId,
  };
}

export function stampSoftDelete<T extends AggregateMeta>(record: T, context: StampContext): T {
  const timestamp = context.now();
  return {
    ...record,
    updatedAt: timestamp,
    deletedAt: timestamp,
    revision: record.revision + 1,
  };
}

export function isLive(record: AggregateMeta): boolean {
  return record.deletedAt === null;
}

/** Getters, not snapshots, so a later identity change is picked up by the next write. */
export function browserStampContext(identity: {
  ownerId: () => string;
  userId: () => string;
}): StampContext {
  return {
    get ownerId() {
      return identity.ownerId();
    },
    get userId() {
      return identity.userId();
    },
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
  };
}
