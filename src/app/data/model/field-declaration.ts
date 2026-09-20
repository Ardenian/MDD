import type { FieldValue } from './field-values';

/**
 * How a Field's Series should read on the Correlation page: whether it also produces a
 * total, and what an unlogged Bucket means for it.
 *
 * Tracker-level metadata, deliberately *not* part of the versioned Field schema — it
 * says nothing about how a Snapshot is validated or rendered, only how a later scan
 * reads gaps and totals, and a baseline declared today must apply to Entries logged
 * under older Tracker Versions too. Changing one never mints a Tracker Version, the same
 * way a Tracker's name and default Time mode don't (ADR 0005).
 */
export interface FieldDeclaration {
  /** Opt-in: also produce a per-Bucket total alongside the weighted mean. */
  readonly sum?: true;
  /**
   * What "I didn't log this Tracker in this Bucket" means for this Field. Never
   * inferred: `false` is the calm case for `headache` but the alarming one for
   * `noHeadache`, and `0` is a neutral baseline for grams but an out-of-range worst
   * case for a 1–5 rating. No declaration, no filling.
   */
  readonly baseline?: FieldValue;
}

/** Keyed by Field name — a rename orphans its declaration, as it orphans its Series. */
export type FieldDeclarations = Readonly<Record<string, FieldDeclaration>>;
