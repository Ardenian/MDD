import type { Entry } from './entry';
import type { Preset } from './preset';
import type { PortableSettings } from './settings';
import type { Tag } from './tag';
import type { Tracker } from './tracker';
import type { TrackerVersion } from './tracker-version';

/**
 * Bumped whenever the bundle shape changes. An import whose version differs is rejected
 * outright — no partial or best-effort restore (ADR 0009).
 */
export const EXPORT_FORMAT_VERSION = 1;

export interface ExportBundle {
  readonly formatVersion: number;
  readonly exportedAt: string;
  readonly trackers: readonly Tracker[];
  readonly trackerVersions: readonly TrackerVersion[];
  readonly entries: readonly Entry[];
  readonly presets: readonly Preset[];
  readonly tags: readonly Tag[];
  readonly settings: PortableSettings;
}

export interface RecordCounts {
  readonly trackers: number;
  readonly trackerVersions: number;
  readonly entries: number;
  readonly presets: number;
  readonly tags: number;
}
