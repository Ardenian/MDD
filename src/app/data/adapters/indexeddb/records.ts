import type { AggregateMeta } from '../../model/aggregate-meta';
import { DataError } from '../../model/data-error';
import { isLive } from './record-meta';

export function liveOnly<T extends AggregateMeta>(records: readonly T[]): T[] {
  return records.filter(isLive);
}

/** Creation order, with `id` breaking a same-millisecond tie so reads are stable. */
export function byCreation<T extends AggregateMeta>(a: T, b: T): number {
  return a.createdAt === b.createdAt
    ? a.id.localeCompare(b.id)
    : a.createdAt.localeCompare(b.createdAt);
}

export function requireLive<T extends AggregateMeta>(
  record: T | undefined,
  what: string,
  id: string,
): T {
  if (record === undefined || !isLive(record)) {
    throw new DataError('not-found', `${what} ${id} does not exist`);
  }
  return record;
}
