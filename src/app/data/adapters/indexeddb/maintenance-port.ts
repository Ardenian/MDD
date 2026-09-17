import type { Calendar } from '../../model/calendar';
import { DataError } from '../../model/data-error';
import type { Entry } from '../../model/entry';
import {
  EXPORT_FORMAT_VERSION,
  type ExportBundle,
  type RecordCounts,
} from '../../model/export-bundle';
import type { Preset } from '../../model/preset';
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  SETTINGS_RECORD_ID,
  type PortableSettings,
} from '../../model/settings';
import type { Tag } from '../../model/tag';
import type { Tracker } from '../../model/tracker';
import { type TrackerVersion, trackerVersionKey } from '../../model/tracker-version';
import type { AggregateMeta } from '../../model/aggregate-meta';
import type { MaintenancePort } from '../../ports/maintenance-port';
import { type IdbEngine, STORE_NAMES, type StoreName } from './idb-engine';
import { stampCreate, type StampContext } from './record-meta';
import { liveOnly } from './records';
import type { WriteQueue } from './write-queue';

export class IndexedDbMaintenancePort implements MaintenancePort {
  constructor(
    private readonly engine: IdbEngine,
    private readonly context: StampContext,
    private readonly queue: WriteQueue,
  ) {}

  async clearAll(): Promise<void> {
    return this.queue.run(() => this.clearAndReseed());
  }

  /** Queued so the snapshot never catches a write half-applied. */
  async exportAll(): Promise<ExportBundle> {
    return this.queue.run(async () => {
      const [trackers, trackerVersions, entries, presets, tags, settings] = await Promise.all([
        this.live<Tracker>('trackers'),
        this.live<TrackerVersion>('trackerVersions'),
        this.live<Entry>('entries'),
        this.live<Preset>('presets'),
        this.live<Tag>('tags'),
        this.engine.get<AppSettings>('settings', SETTINGS_RECORD_ID),
      ]);

      return {
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt: this.context.now(),
        trackers,
        trackerVersions,
        entries,
        presets,
        tags,
        settings: portable(settings),
      };
    });
  }

  async importAll(bundle: ExportBundle): Promise<void> {
    return this.queue.run(async () => {
      if (bundle.formatVersion !== EXPORT_FORMAT_VERSION) {
        throw new DataError(
          'unsupported',
          `This file was exported in format version ${bundle.formatVersion}; this app reads version ${EXPORT_FORMAT_VERSION}`,
        );
      }

      // Read before the wipe: the Storage Profile is device-local and never rides along
      // in a bundle, in either direction (ADR 0009).
      const stored = await this.engine.get<AppSettings>('settings', SETTINGS_RECORD_ID);
      const activeProfileId = stored?.activeProfileId ?? DEFAULT_SETTINGS.activeProfileId;

      await this.clearAndReseed();

      await this.engine.putAll(
        'trackers',
        bundle.trackers.map((tracker) => [tracker.id, tracker] as const),
      );
      await this.engine.putAll(
        'trackerVersions',
        bundle.trackerVersions.map(
          (version) => [trackerVersionKey(version.trackerId, version.version), version] as const,
        ),
      );
      await this.engine.putAll(
        'entries',
        bundle.entries.map((entry) => [entry.id, entry] as const),
      );
      await this.engine.putAll(
        'presets',
        bundle.presets.map((preset) => [preset.id, preset] as const),
      );
      await this.engine.putAll(
        'tags',
        bundle.tags.map((tag) => [tag.id, tag] as const),
      );

      const settings: AppSettings = {
        ...stampCreate({ ...DEFAULT_SETTINGS, ...bundle.settings, activeProfileId }, this.context),
        id: SETTINGS_RECORD_ID,
      };
      await this.engine.put('settings', SETTINGS_RECORD_ID, settings);
    });
  }

  async counts(): Promise<RecordCounts> {
    const [trackers, trackerVersions, entries, presets, tags] = await Promise.all([
      this.live<Tracker>('trackers'),
      this.live<TrackerVersion>('trackerVersions'),
      this.live<Entry>('entries'),
      this.live<Preset>('presets'),
      this.live<Tag>('tags'),
    ]);

    return {
      trackers: trackers.length,
      trackerVersions: trackerVersions.length,
      entries: entries.length,
      presets: presets.length,
      tags: tags.length,
    };
  }

  async ensureCalendar(): Promise<Calendar> {
    return this.queue.run(() => this.seedCalendar());
  }

  private async clearAndReseed(): Promise<void> {
    for (const store of STORE_NAMES) {
      await this.engine.clear(store);
    }
    await this.seedCalendar();
  }

  private async seedCalendar(): Promise<Calendar> {
    const existing = liveOnly(await this.engine.getAll<Calendar>('calendars'));
    const first = existing[0];
    if (first !== undefined) {
      return first;
    }
    const calendar = stampCreate({}, this.context);
    await this.engine.put('calendars', calendar.id, calendar);
    return calendar;
  }

  private async live<T extends AggregateMeta>(store: StoreName): Promise<T[]> {
    return liveOnly(await this.engine.getAll<T>(store));
  }
}

function portable(settings: AppSettings | undefined): PortableSettings {
  const source = settings ?? DEFAULT_SETTINGS;
  return {
    defaultBucketSize: source.defaultBucketSize,
    defaultLagRange: source.defaultLagRange,
    guardrails: source.guardrails,
    expansionDepthCap: source.expansionDepthCap,
  };
}
