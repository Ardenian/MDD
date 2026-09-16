import { TestBed } from '@angular/core/testing';
import { IDB_ENGINE } from '../data/adapters/indexeddb/idb-engine';
import { CORRELATION_DATA_SOURCE } from '../data/ports/correlation-data-source';
import { ENTRY_REPOSITORY } from '../data/ports/entry-repository';
import { MAINTENANCE_PORT } from '../data/ports/maintenance-port';
import { PRESET_REPOSITORY } from '../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../data/ports/settings-repository';
import { TAG_REPOSITORY } from '../data/ports/tag-repository';
import { TRACKER_REPOSITORY } from '../data/ports/tracker-repository';
import { InMemoryIdbEngine } from '../data/testing/in-memory-idb-engine';
import { ActivePortSet, provideDataAdapters } from './data-providers';
import { provideCoreState } from './core.providers';
import { OFFLINE_PROFILE } from './storage-profile';

describe('data adapter wiring', () => {
  let engine: InMemoryIdbEngine;

  beforeEach(() => {
    engine = new InMemoryIdbEngine();
    TestBed.configureTestingModule({
      providers: [
        provideCoreState(),
        provideDataAdapters(),
        { provide: IDB_ENGINE, useValue: engine },
      ],
    });
  });

  it('resolves every port token from one shared set', () => {
    const set = TestBed.inject(ActivePortSet).get();

    expect(TestBed.inject(TRACKER_REPOSITORY)).toBe(set.trackers);
    expect(TestBed.inject(ENTRY_REPOSITORY)).toBe(set.entries);
    expect(TestBed.inject(PRESET_REPOSITORY)).toBe(set.presets);
    expect(TestBed.inject(TAG_REPOSITORY)).toBe(set.tags);
    expect(TestBed.inject(SETTINGS_REPOSITORY)).toBe(set.settings);
    expect(TestBed.inject(CORRELATION_DATA_SOURCE)).toBe(set.correlation);
    expect(TestBed.inject(MAINTENANCE_PORT)).toBe(set.maintenance);
  });

  it('stamps records with the identity context', async () => {
    const tracker = await TestBed.inject(TRACKER_REPOSITORY).create({
      name: 'Sleep',
      defaultTimeMode: 'period',
    });

    expect(tracker).toMatchObject({ ownerId: 'dev', userId: 'dev' });
  });

  it('bootstraps to Offline when nothing has been saved', async () => {
    await expect(TestBed.inject(ActivePortSet).bootstrap()).resolves.toBe(OFFLINE_PROFILE);
  });

  it('bootstraps to Offline when the stored profile id is unknown', async () => {
    const active = TestBed.inject(ActivePortSet);
    await active.get().settings.save({ activeProfileId: 'some-future-cloud-profile' });

    await expect(active.bootstrap()).resolves.toBe(OFFLINE_PROFILE);
  });

  it('keeps serving the same port instances after bootstrap', async () => {
    const active = TestBed.inject(ActivePortSet);
    const before = active.get();

    await active.bootstrap();

    expect(active.get()).toBe(before);
  });
});
