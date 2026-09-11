import type { AggregateMeta } from '../model/common';
import type { Identity } from '../model/identity';

export function createId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Stamps a brand-new aggregate: fresh id, timestamps, revision 1 (ADR 0003). */
export function stampNew(identity: Identity): AggregateMeta {
  const timestamp = nowIso();
  return {
    id: createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    revision: 1,
    ownerId: identity.ownerId,
    userId: identity.userId,
  };
}

/** Bumps `updatedAt`/`revision` on an existing aggregate; `createdAt` is preserved. */
export function stampUpdate<T extends AggregateMeta>(record: T): T {
  return {
    ...record,
    updatedAt: nowIso(),
    revision: record.revision + 1,
  };
}

/** Soft-deletes: sets `deletedAt`, bumps `updatedAt`/`revision`, keeps the row. */
export function stampSoftDelete<T extends AggregateMeta>(record: T): T {
  const timestamp = nowIso();
  return {
    ...record,
    deletedAt: timestamp,
    updatedAt: timestamp,
    revision: record.revision + 1,
  };
}

export function isDeleted(record: Pick<AggregateMeta, 'deletedAt'>): boolean {
  return record.deletedAt !== null;
}
