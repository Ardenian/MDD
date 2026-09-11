import type { AggregateMeta } from './common';

/**
 * The single implicit Calendar every Entry is placed onto (Q12: exactly one per Owner
 * in v1 — no Calendar-management UI). `core/` ensures exactly one row exists.
 */
export interface Calendar extends AggregateMeta {
  readonly name: string;
}
