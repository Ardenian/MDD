import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { createInMemoryDataLayer, type DataLayer } from '../../data/testing/in-memory-data-layer';
import { TrackersDataAccess } from './trackers-data-access';

describe('TrackersDataAccess', () => {
  let layer: DataLayer;

  beforeEach(() => {
    layer = createInMemoryDataLayer();
    TestBed.configureTestingModule({
      providers: [
        { provide: TRACKER_REPOSITORY, useValue: layer.trackers },
        { provide: PRESET_REPOSITORY, useValue: layer.presets },
        { provide: ENTRY_REPOSITORY, useValue: layer.entries },
      ],
    });
  });

  async function settle(): Promise<void> {
    await TestBed.inject(ApplicationRef).whenStable();
  }

  async function facade(): Promise<TrackersDataAccess> {
    const instance = TestBed.inject(TrackersDataAccess);
    await settle();
    return instance;
  }

  it('summarises each Tracker with its Version, Field, Entry and Preset counts', async () => {
    const tracker = await layer.trackers.create({
      name: 'Sleep',
      defaultTimeMode: 'period',
      fields: [{ name: 'Satisfaction', required: false, dataType: 'integer' }],
    });
    await layer.entries.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
      snapshot: [],
      tags: [],
    });
    await layer.presets.create({ trackerId: tracker.id, name: 'Good night', values: [], children: [] });

    const access = await facade();

    expect(access.active()).toEqual([
      {
        id: tracker.id,
        name: 'Sleep',
        currentVersion: 1,
        fieldCount: 1,
        entryCount: 1,
        presetCount: 1,
        archived: false,
      },
    ]);
  });

  it('separates archived Trackers from the rest', async () => {
    const tracker = await layer.trackers.create({ name: 'Snack', defaultTimeMode: 'point' });
    await layer.trackers.archive(tracker.id);

    const access = await facade();

    expect(access.active()).toEqual([]);
    expect(access.archived().map((row) => row.name)).toEqual(['Snack']);
  });

  it('exposes the committed schema for the selected Tracker, not the Draft', async () => {
    const tracker = await layer.trackers.create({
      name: 'Sleep',
      defaultTimeMode: 'period',
      fields: [{ name: 'Satisfaction', required: false, dataType: 'integer' }],
    });
    await layer.trackers.saveDraft(tracker.id, [
      { name: 'Satisfaction', required: false, dataType: 'integer' },
      { name: 'Energy', required: false, dataType: 'singleSelect', options: ['low'] },
    ]);

    const access = await facade();
    const view = runInInjectionContext(TestBed.inject(Injector), () =>
      access.designerFor(signal(tracker.id)),
    );
    await settle();

    expect(view.committedFields().map((field) => field.name)).toEqual(['Satisfaction']);
    expect(view.tracker()?.draftFields.map((field) => field.name)).toEqual([
      'Satisfaction',
      'Energy',
    ]);
  });

  it('follows the caller selection rather than holding one', async () => {
    const sleep = await layer.trackers.create({ name: 'Sleep', defaultTimeMode: 'period' });
    const workout = await layer.trackers.create({ name: 'Workout', defaultTimeMode: 'period' });
    const selected = signal<string | null>(sleep.id);

    const access = await facade();
    const view = runInInjectionContext(TestBed.inject(Injector), () => access.designerFor(selected));
    await settle();
    expect(view.tracker()?.name).toBe('Sleep');

    selected.set(workout.id);
    await settle();

    expect(view.tracker()?.name).toBe('Workout');
  });

  it('refreshes the overview after a commit', async () => {
    const tracker = await layer.trackers.create({ name: 'Sleep', defaultTimeMode: 'period' });
    const access = await facade();
    expect(access.active()[0]?.currentVersion).toBe(0);

    await access.saveDraft(tracker.id, [{ name: 'Satisfaction', required: false, dataType: 'integer' }]);
    await access.commitDraft(tracker.id);
    await settle();

    expect(access.active()[0]?.currentVersion).toBe(1);
  });
});
