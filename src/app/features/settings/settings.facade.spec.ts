import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS } from '../../data/model/settings';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { MAINTENANCE_PORT } from '../../data/ports/maintenance-port';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { FakeCalendarRepository } from '../../data/testing/calendar-repository.fake';
import { FakeEntryRepository } from '../../data/testing/entry-repository.fake';
import { FakeMaintenancePort } from '../../data/testing/maintenance-port.fake';
import { FakePresetRepository } from '../../data/testing/preset-repository.fake';
import { FakeSettingsRepository } from '../../data/testing/settings-repository.fake';
import { FakeTrackerRepository } from '../../data/testing/tracker-repository.fake';
import type { FieldDef } from '../../data/model/tracker';
import type { Placement } from '../../data/model/entry';
import { SettingsFacadeService } from './settings.facade';

const satisfaction: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };

function pointAt(iso: string): Placement {
  return { kind: 'point', at: iso, fadeout: null };
}

function setup() {
  const trackerRepository = new FakeTrackerRepository();
  const entryRepository = new FakeEntryRepository(trackerRepository);
  const presetRepository = new FakePresetRepository(trackerRepository);
  const settingsRepository = new FakeSettingsRepository();
  const calendarRepository = new FakeCalendarRepository();
  const maintenancePort = new FakeMaintenancePort(
    trackerRepository,
    entryRepository,
    presetRepository,
    settingsRepository,
    calendarRepository,
  );

  TestBed.configureTestingModule({
    providers: [
      { provide: TRACKER_REPOSITORY, useValue: trackerRepository },
      { provide: ENTRY_REPOSITORY, useValue: entryRepository },
      { provide: PRESET_REPOSITORY, useValue: presetRepository },
      { provide: SETTINGS_REPOSITORY, useValue: settingsRepository },
      { provide: MAINTENANCE_PORT, useValue: maintenancePort },
      SettingsFacadeService,
    ],
  });

  return {
    trackerRepository,
    entryRepository,
    presetRepository,
    calendarRepository,
    facade: TestBed.inject(SettingsFacadeService),
  };
}

async function createCommittedTracker(trackerRepository: FakeTrackerRepository, name: string) {
  const tracker = await trackerRepository.create({ name, defaultTimeMode: 'point' });
  await trackerRepository.saveDraft(tracker.id, [satisfaction]);
  return trackerRepository.commitDraft(tracker.id);
}

describe('SettingsFacadeService', () => {
  it('returns the documented fallback values before anything has been saved', async () => {
    const { facade } = setup();
    expect(await facade.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects a patch that makes the merged Settings invalid, without saving it', async () => {
    const { facade } = setup();

    await expect(facade.saveSettings({ expansionDepthCap: 0 })).rejects.toMatchObject({ code: 'invalid-input' });

    expect((await facade.getSettings()).expansionDepthCap).toBe(DEFAULT_SETTINGS.expansionDepthCap);
  });

  it('rejects a patch that only sets lagRangeMin above the existing lagRangeMax', async () => {
    const { facade } = setup();
    await facade.saveSettings({ correlationDefaults: { lagRangeMax: 2 } });

    await expect(
      facade.saveSettings({ correlationDefaults: { lagRangeMin: 5 } }),
    ).rejects.toMatchObject({ code: 'invalid-input' });
  });

  it('persists a valid partial patch merged with the current Settings', async () => {
    const { facade } = setup();

    const updated = await facade.saveSettings({ expansionDepthCap: 3 });

    expect(updated.expansionDepthCap).toBe(3);
    expect(updated.correlationDefaults).toEqual(DEFAULT_SETTINGS.correlationDefaults);
  });

  it('reports record counts across Trackers, Entries, and Presets', async () => {
    const { facade, trackerRepository, entryRepository, presetRepository } = setup();
    const tracker = await createCommittedTracker(trackerRepository, 'Sleep');
    await entryRepository.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T10:00:00.000Z'),
      snapshot: [],
      tags: [],
    });
    await presetRepository.create({ trackerId: tracker.id, name: 'Great night', values: [], children: [] });

    const counts = await facade.recordCounts();

    expect(counts).toEqual({ trackers: 1, entries: 1, presets: 1 });
  });

  it('clearAllData empties every store and leaves exactly one Calendar record', async () => {
    const { facade, trackerRepository, calendarRepository } = setup();
    await createCommittedTracker(trackerRepository, 'Sleep');
    await calendarRepository.ensureExists();

    await facade.clearAllData();

    expect(await trackerRepository.list()).toEqual([]);
    expect(await calendarRepository.get()).not.toBeNull();
  });
});
