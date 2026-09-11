import { TestBed } from '@angular/core/testing';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { FakePresetRepository } from '../../data/testing/preset-repository.fake';
import { FakeTrackerRepository } from '../../data/testing/tracker-repository.fake';
import type { FieldDef } from '../../data/model/tracker';
import { TrackersFacadeService } from './trackers.facade';

const satisfaction: FieldDef = { name: 'Satisfaction', required: true, dataType: 'integer' };

function setup() {
  const trackerRepository = new FakeTrackerRepository();
  const presetRepository = new FakePresetRepository(trackerRepository);

  TestBed.configureTestingModule({
    providers: [
      { provide: TRACKER_REPOSITORY, useValue: trackerRepository },
      { provide: PRESET_REPOSITORY, useValue: presetRepository },
      TrackersFacadeService,
    ],
  });

  return {
    trackerRepository,
    presetRepository,
    facade: TestBed.inject(TrackersFacadeService),
  };
}

describe('TrackersFacadeService', () => {
  it('rejects saving a Draft with validation errors, without persisting it', async () => {
    const { facade, trackerRepository } = setup();
    const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });

    await expect(
      facade.saveDraft(tracker.id, [{ ...satisfaction, name: '' }]),
    ).rejects.toMatchObject({ code: 'invalid-input' });

    expect((await trackerRepository.get(tracker.id))!.draftFields).toEqual([]);
  });

  it('saves a valid Draft through to the repository', async () => {
    const { facade, trackerRepository } = setup();
    const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });

    await facade.saveDraft(tracker.id, [satisfaction]);

    expect((await trackerRepository.get(tracker.id))!.draftFields).toEqual([satisfaction]);
  });

  it('get() reports isDraftDirty only when the Draft differs from the current Version', async () => {
    const { facade, trackerRepository } = setup();
    const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });
    await facade.saveDraft(tracker.id, [satisfaction]);
    await facade.commitDraft(tracker.id);

    const clean = await facade.get(tracker.id);
    expect(clean?.isDraftDirty).toBe(false);
    expect(clean?.currentFields).toEqual([satisfaction]);

    await facade.saveDraft(tracker.id, [satisfaction, { ...satisfaction, name: 'Notes', dataType: 'text' }]);
    const dirty = await facade.get(tracker.id);
    expect(dirty?.isDraftDirty).toBe(true);
  });

  it('list() reports Field and Preset counts per Tracker', async () => {
    const { facade, trackerRepository, presetRepository } = setup();
    const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });
    await trackerRepository.saveDraft(tracker.id, [satisfaction]);
    await trackerRepository.commitDraft(tracker.id);
    await presetRepository.create({ trackerId: tracker.id, name: 'Great night', values: [], children: [] });

    const [summary] = await facade.list();

    expect(summary).toMatchObject({ fieldCount: 1, presetCount: 1, currentVersion: 1 });
  });

  it('flags a Preset as stale once the Tracker moves past its pinned Version', async () => {
    const { facade, trackerRepository, presetRepository } = setup();
    const tracker = await trackerRepository.create({ name: 'Meal', defaultTimeMode: 'point' });
    await trackerRepository.saveDraft(tracker.id, [satisfaction]);
    await trackerRepository.commitDraft(tracker.id);
    await presetRepository.create({ trackerId: tracker.id, name: 'Full English', values: [], children: [] });

    await trackerRepository.saveDraft(tracker.id, [satisfaction, { ...satisfaction, name: 'Notes', dataType: 'text' }]);
    await trackerRepository.commitDraft(tracker.id);

    const detail = await facade.get(tracker.id);
    expect(detail?.presets[0].stale).toBe(true);
  });

  it('analyzeDraftExpansion detects a cycle across committed Trackers', async () => {
    const { facade, trackerRepository } = setup();
    const meal = await trackerRepository.create({ name: 'Meal', defaultTimeMode: 'point' });
    const ingredient = await trackerRepository.create({ name: 'Ingredient', defaultTimeMode: 'point' });

    const backToMeal: FieldDef = {
      name: 'UsedIn',
      required: false,
      dataType: 'reference',
      targetTrackerId: meal.id,
      cardinality: 'many',
    };
    await trackerRepository.saveDraft(ingredient.id, [backToMeal]);
    await trackerRepository.commitDraft(ingredient.id);

    const toIngredient: FieldDef = {
      name: 'Ingredients',
      required: false,
      dataType: 'reference',
      targetTrackerId: ingredient.id,
      cardinality: 'many',
    };

    const analysis = await facade.analyzeDraftExpansion(meal.id, [toIngredient], 5);
    expect(analysis.hasCycle).toBe(true);
  });
});
