import { InjectionToken } from '@angular/core';
import type { Entry } from '../model/entry';
import type { Tracker } from '../model/tracker';
import type { TrackerVersion } from '../model/tracker-version';

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export interface SeriesScope {
  /** Omitted or empty means every Tracker is in scope. */
  readonly trackerIds?: readonly string[];
}

/**
 * Entries plus the exact Tracker Versions they pin to — never a Tracker's current
 * schema, since an old Entry's Series reads against its own Version (ADR 0005).
 */
export interface CorrelationDataset {
  readonly entries: readonly Entry[];
  readonly trackers: readonly Tracker[];
  readonly trackerVersions: readonly TrackerVersion[];
}

export interface CorrelationDataSource {
  loadEntriesForScope(range: DateRange, scope: SeriesScope): Promise<CorrelationDataset>;
}

export const CORRELATION_DATA_SOURCE = new InjectionToken<CorrelationDataSource>(
  'CorrelationDataSource',
);
