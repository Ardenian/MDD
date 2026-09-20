import { InjectionToken } from '@angular/core';
import type { Entry } from '../model/entry';
import type { Tag } from '../model/tag';
import type { Tracker } from '../model/tracker';
import type { TrackerVersion } from '../model/tracker-version';

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export interface SeriesScope {
  /** Omitted or empty means every Tracker is in scope. */
  readonly trackerIds?: readonly string[];
  /**
   * Omitted or empty means every extracted Series is in scope.
   *
   * Read *after* extraction, never by the load: a Series' identity is a function of
   * Tracker scope (ADR 0015) — drop a parent Tracker and a Nested reading becomes a
   * Standalone reading with a different key — so letting Series selection decide what
   * loads would make that identity self-referential. A data source therefore ignores
   * this field; only the caller that extracts Series reads it.
   */
  readonly seriesIds?: readonly string[];
}

/**
 * Entries plus the exact Tracker Versions they pin to — never a Tracker's current
 * schema, since an old Entry's Series reads against its own Version (ADR 0005).
 */
export interface CorrelationDataset {
  readonly entries: readonly Entry[];
  readonly trackers: readonly Tracker[];
  readonly trackerVersions: readonly TrackerVersion[];
  /** In the same batch, so Tag Series never need a second round trip. */
  readonly tags: readonly Tag[];
}

export interface CorrelationDataSource {
  loadEntriesForScope(range: DateRange, scope: SeriesScope): Promise<CorrelationDataset>;
}

export const CORRELATION_DATA_SOURCE = new InjectionToken<CorrelationDataSource>(
  'CorrelationDataSource',
);
