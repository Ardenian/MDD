import type { Timestamp, Uuid } from './common';
import type { Entry } from './entry';
import type { TrackerVersion } from './tracker';

export interface CorrelationScope {
  readonly from: Timestamp;
  readonly to: Timestamp;
  /** 'all' or an explicit set of in-scope Tracker ids. */
  readonly trackerIds: readonly Uuid[] | 'all';
}

/**
 * One batched read for the Correlation feature: every in-scope Entry (including
 * children), the exact Tracker Versions those Entries are snapshotted against (so
 * Signal extraction knows each Field's data type), and every Tag in play.
 */
export interface CorrelationDataset {
  readonly entries: readonly Entry[];
  readonly trackerVersions: readonly TrackerVersion[];
  readonly tags: readonly string[];
}
