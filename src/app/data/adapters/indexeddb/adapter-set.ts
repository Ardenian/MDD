import type { CorrelationDataSource } from '../../ports/correlation-data-source';
import type { EntryRepository } from '../../ports/entry-repository';
import type { MaintenancePort } from '../../ports/maintenance-port';
import type { PresetRepository } from '../../ports/preset-repository';
import type { SettingsRepository } from '../../ports/settings-repository';
import type { TagRepository } from '../../ports/tag-repository';
import type { TrackerRepository } from '../../ports/tracker-repository';
import { IndexedDbCorrelationDataSource } from './correlation-data-source';
import { IndexedDbEntryRepository } from './entry-repository';
import type { IdbEngine } from './idb-engine';
import { IndexedDbMaintenancePort } from './maintenance-port';
import { IndexedDbPresetRepository } from './preset-repository';
import type { StampContext } from './record-meta';
import { IndexedDbSettingsRepository } from './settings-repository';
import { IndexedDbTagRepository } from './tag-repository';
import { IndexedDbTrackerRepository } from './tracker-repository';
import { WriteQueue } from './write-queue';

/** One implementation of every port — what a Storage Profile resolves to (ADR 0009). */
export interface PortSet {
  readonly trackers: TrackerRepository;
  readonly entries: EntryRepository;
  readonly presets: PresetRepository;
  readonly tags: TagRepository;
  readonly settings: SettingsRepository;
  readonly correlation: CorrelationDataSource;
  readonly maintenance: MaintenancePort;
}

/**
 * Assembles the adapters; it performs no DI itself, so `core/` stays the only place that
 * *binds* a concrete adapter to a port token (ADR 0002).
 */
export function createIndexedDbPortSet(engine: IdbEngine, context: StampContext): PortSet {
  // One queue for the whole set: an Entry write registers Tags and an import rewrites
  // every store, so per-repository queues would still let those interleave.
  const queue = new WriteQueue();
  const entries = new IndexedDbEntryRepository(engine, context, queue);
  const tags = new IndexedDbTagRepository(engine);
  return {
    trackers: new IndexedDbTrackerRepository(engine, context, queue),
    entries,
    presets: new IndexedDbPresetRepository(engine, context, queue),
    tags,
    settings: new IndexedDbSettingsRepository(engine, context, queue),
    correlation: new IndexedDbCorrelationDataSource(engine, entries, tags),
    maintenance: new IndexedDbMaintenancePort(engine, context, queue),
  };
}
