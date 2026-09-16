import type { AggregateMeta } from './aggregate-meta';

/**
 * The single implicit Calendar every Entry is placed on. v1 has exactly one, seeded at
 * bootstrap and re-seeded by `clearAll()`/`importAll()`; it carries no settings of its
 * own yet.
 */
export type Calendar = AggregateMeta;
