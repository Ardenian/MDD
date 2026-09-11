import { TestBed } from '@angular/core/testing';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { PRESET_REPOSITORY } from '../../data/ports/preset-repository';
import { TAG_REPOSITORY } from '../../data/ports/tag-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { FakeEntryRepository } from '../../data/testing/entry-repository.fake';
import { FakePresetRepository } from '../../data/testing/preset-repository.fake';
import { FakeTagRepository } from '../../data/testing/tag-repository.fake';
import { FakeTrackerRepository } from '../../data/testing/tracker-repository.fake';
import type { FieldDef } from '../../data/model/tracker';
import type { Placement } from '../../data/model/entry';
import { EntriesFacadeService } from './entries.facade';

const satisfaction: FieldDef = { name: 'Satisfaction', required: true, dataType: 'integer' };
const notes: FieldDef = { name: 'Notes', required: false, dataType: 'text' };

function pointAt(iso: string): Placement {
  return { kind: 'point', at: iso, fadeout: null };
}

function setup() {
  const trackerRepository = new FakeTrackerRepository();
  const entryRepository = new FakeEntryRepository(trackerRepository);
  const presetRepository = new FakePresetRepository(trackerRepository);
  const tagRepository = new FakeTagRepository(entryRepository);

  TestBed.configureTestingModule({
    providers: [
      { provide: TRACKER_REPOSITORY, useValue: trackerRepository },
      { provide: ENTRY_REPOSITORY, useValue: entryRepository },
      { provide: PRESET_REPOSITORY, useValue: presetRepository },
      { provide: TAG_REPOSITORY, useValue: tagRepository },
      EntriesFacadeService,
    ],
  });

  return {
    trackerRepository,
    entryRepository,
    presetRepository,
    facade: TestBed.inject(EntriesFacadeService),
  };
}

async function createCommittedTracker(trackerRepository: FakeTrackerRepository, fields: readonly FieldDef[]) {
  const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });
  await trackerRepository.saveDraft(tracker.id, fields);
  return trackerRepository.commitDraft(tracker.id);
}

describe('EntriesFacadeService', () => {
  it('rejects loading a form for a Tracker with no committed Version', async () => {
    const { facade, trackerRepository } = setup();
    const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });

    await expect(facade.loadFormForNewEntry(tracker.id)).rejects.toMatchObject({ code: 'invalid-input' });
  });

  it('builds a new-Entry form from the current Version, pre-filled from a Preset', async () => {
    const { facade, trackerRepository, presetRepository } = setup();
    const tracker = await createCommittedTracker(trackerRepository, [satisfaction, notes]);
    const preset = await presetRepository.create({
      trackerId: tracker.id,
      name: 'Great night',
      values: [{ fieldName: 'Satisfaction', value: 9 }],
      children: [],
    });

    const context = await facade.loadFormForNewEntry(tracker.id, preset.id);

    expect(context.trackerVersion).toBe(1);
    expect(context.model).toEqual([
      { field: satisfaction, value: 9 },
      { field: notes, value: '' },
    ]);
  });

  it('create() rejects an invalid form without creating an Entry', async () => {
    const { facade, trackerRepository, entryRepository } = setup();
    const tracker = await createCommittedTracker(trackerRepository, [satisfaction]);
    const { model } = await facade.loadFormForNewEntry(tracker.id);

    await expect(
      facade.create({
        trackerId: tracker.id,
        parentEntryId: null,
        placement: pointAt('2026-01-01T10:00:00.000Z'),
        model,
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'invalid-input' });

    expect(await entryRepository.listByTracker(tracker.id)).toHaveLength(0);
  });

  it('create() persists a valid form as a Snapshot', async () => {
    const { facade, trackerRepository } = setup();
    const tracker = await createCommittedTracker(trackerRepository, [satisfaction]);
    const context = await facade.loadFormForNewEntry(tracker.id);
    const filledModel = context.model.map((entry) => ({ ...entry, value: 8 }));

    const entry = await facade.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T10:00:00.000Z'),
      model: filledModel,
      tags: ['great-night'],
    });

    expect(entry.snapshot).toEqual([{ fieldName: 'Satisfaction', value: 8 }]);
    expect(entry.trackerVersion).toBe(1);
  });

  it('loadFormForExistingEntry renders against the Entry pinned Version, not the current one', async () => {
    const { facade, trackerRepository } = setup();
    const tracker = await createCommittedTracker(trackerRepository, [satisfaction]);
    const context = await facade.loadFormForNewEntry(tracker.id);
    const entry = await facade.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T10:00:00.000Z'),
      model: context.model.map((item) => ({ ...item, value: 6 })),
      tags: [],
    });

    // Tracker moves on to Version 2 after the Entry was created.
    await trackerRepository.saveDraft(tracker.id, [satisfaction, notes]);
    await trackerRepository.commitDraft(tracker.id);

    const rendered = await facade.loadFormForExistingEntry(entry.id);

    expect(rendered?.trackerVersion).toBe(1);
    expect(rendered?.model).toEqual([{ field: satisfaction, value: 6 }]);
  });

  it('returns null from loadFormForExistingEntry for an unknown Entry', async () => {
    const { facade } = setup();
    expect(await facade.loadFormForExistingEntry('missing')).toBeNull();
  });

  it('softDelete removes the Entry from range listings', async () => {
    const { facade, trackerRepository } = setup();
    const tracker = await createCommittedTracker(trackerRepository, [satisfaction]);
    const context = await facade.loadFormForNewEntry(tracker.id);
    const entry = await facade.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T10:00:00.000Z'),
      model: context.model.map((item) => ({ ...item, value: 3 })),
      tags: [],
    });

    await facade.softDelete(entry.id);

    const results = await facade.listByRange('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    expect(results).toHaveLength(0);
  });
});
