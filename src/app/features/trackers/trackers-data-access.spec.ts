import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { SETTINGS_REPOSITORY } from '../../data/ports/settings-repository';
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
        { provide: SETTINGS_REPOSITORY, useValue: layer.settings },
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
    await layer.presets.create({
      trackerId: tracker.id,
      name: 'Good night',
      values: [],
      children: [],
    });

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
    const view = runInInjectionContext(TestBed.inject(Injector), () =>
      access.designerFor(selected),
    );
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

    await access.saveDraft(tracker.id, [
      { name: 'Satisfaction', required: false, dataType: 'integer' },
    ]);
    await access.commitDraft(tracker.id);
    await settle();

    expect(access.active()[0]?.currentVersion).toBe(1);
  });

  describe('Presets', () => {
    async function mealWithIngredient() {
      const ingredient = await layer.trackers.create({
        name: 'Ingredient',
        defaultTimeMode: 'point',
        fields: [{ name: 'grams', required: false, dataType: 'decimal' }],
      });
      const meal = await layer.trackers.create({
        name: 'Meal',
        defaultTimeMode: 'period',
        fields: [
          { name: 'Energy', required: false, dataType: 'singleSelect', options: ['low', 'high'] },
          {
            name: 'Ingredients',
            required: false,
            dataType: 'reference',
            targetTrackerId: ingredient.id,
            cardinality: 'many',
          },
        ],
      });
      return { meal, ingredient };
    }

    it('saves a new Preset with a filled child, pinned to the current Versions', async () => {
      const { meal, ingredient } = await mealWithIngredient();
      const access = await facade();
      const draft = await access.openPreset(meal.id, null);
      const referenceField = draft.root.fields[1]!;
      if (referenceField.dataType !== 'reference') throw new Error('fixture');
      const child = await access.newPresetChild(referenceField, 1, draft.expansionDepthCap);

      const saved = await access.savePresetDraft({
        ...draft,
        name: 'Full English',
        root: {
          ...draft.root,
          values: { Energy: 'high' },
          children: [{ ...child, values: { grams: 120 } }],
        },
      });

      expect(saved).toMatchObject({
        trackerVersion: 1,
        name: 'Full English',
        values: [{ fieldName: 'Energy', value: 'high' }],
        children: [
          {
            fieldName: 'Ingredients',
            trackerId: ingredient.id,
            trackerVersion: 1,
            values: [{ fieldName: 'grams', value: 120 }],
          },
        ],
      });
    });

    it('opens a stale Preset against the current Version and re-pins it when saved', async () => {
      const { meal } = await mealWithIngredient();
      const preset = await layer.presets.create({
        trackerId: meal.id,
        name: 'Good night',
        values: [
          { fieldName: 'Energy', value: 'high' },
          { fieldName: 'Retired', value: 'gone' },
        ],
        children: [],
      });
      await layer.trackers.saveDraft(meal.id, [
        { name: 'Energy', required: false, dataType: 'singleSelect', options: ['low', 'high'] },
      ]);
      await layer.trackers.commitDraft(meal.id);
      const access = await facade();

      const draft = await access.openPreset(meal.id, preset.id);
      expect(draft.root).toMatchObject({ trackerVersion: 2, values: { Energy: 'high' } });

      const resaved = await access.savePresetDraft(draft);
      expect(resaved.trackerVersion).toBe(2);
      expect(resaved.values).toEqual([{ fieldName: 'Energy', value: 'high' }]);
    });

    it('will not nest a filled child past the expansion-depth cap', async () => {
      const { meal } = await mealWithIngredient();
      await layer.settings.save({ expansionDepthCap: 1 });
      const access = await facade();
      const draft = await access.openPreset(meal.id, null);
      const referenceField = draft.root.fields[1]!;
      if (referenceField.dataType !== 'reference') throw new Error('fixture');

      expect(draft.expansionDepthCap).toBe(1);
      await expect(
        access.newPresetChild(referenceField, 1, draft.expansionDepthCap),
      ).rejects.toMatchObject({ code: 'invalid' });
    });
  });
});
