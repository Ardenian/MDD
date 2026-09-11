import { TestBed } from '@angular/core/testing';
import { ENTRY_REPOSITORY } from '../../data/ports/entry-repository';
import { TRACKER_REPOSITORY } from '../../data/ports/tracker-repository';
import { FakeEntryRepository } from '../../data/testing/entry-repository.fake';
import { FakeTrackerRepository } from '../../data/testing/tracker-repository.fake';
import type { FieldDef } from '../../data/model/tracker';
import type { Entry, Placement } from '../../data/model/entry';
import { CalendarFacadeService, splitEntriesForDisplay } from './calendar.facade';

const satisfaction: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };

function pointAt(iso: string): Placement {
  return { kind: 'point', at: iso, fadeout: null };
}

function dayBucketed(day: string): Placement {
  return { kind: 'dayBucketed', day };
}

function stubEntry(placement: Placement): Entry {
  return {
    id: 'stub',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 1,
    ownerId: 'dev',
    userId: 'dev',
    trackerId: 'tracker',
    trackerVersion: 1,
    parentEntryId: null,
    placement,
    snapshot: [],
    tags: [],
  };
}

function setup() {
  const trackerRepository = new FakeTrackerRepository();
  const entryRepository = new FakeEntryRepository(trackerRepository);

  TestBed.configureTestingModule({
    providers: [
      { provide: TRACKER_REPOSITORY, useValue: trackerRepository },
      { provide: ENTRY_REPOSITORY, useValue: entryRepository },
      CalendarFacadeService,
    ],
  });

  return { trackerRepository, entryRepository, facade: TestBed.inject(CalendarFacadeService) };
}

async function createCommittedTracker(trackerRepository: FakeTrackerRepository) {
  const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });
  await trackerRepository.saveDraft(tracker.id, [satisfaction]);
  return trackerRepository.commitDraft(tracker.id);
}

describe('splitEntriesForDisplay', () => {
  it('routes Day-bucketed Entries to the strip and everything else to the grid', () => {
    const grid = stubEntry(pointAt('2026-01-01T10:00:00.000Z'));
    const strip = stubEntry(dayBucketed('2026-01-01'));

    expect(splitEntriesForDisplay([grid, strip])).toEqual({
      gridEntries: [grid],
      stripEntries: [strip],
    });
  });
});

describe('CalendarFacadeService', () => {
  it('loads a range and splits grid vs strip Entries', async () => {
    const { facade, trackerRepository, entryRepository } = setup();
    const tracker = await createCommittedTracker(trackerRepository);

    await entryRepository.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T09:00:00.000Z'),
      snapshot: [],
      tags: [],
    });
    await entryRepository.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: dayBucketed('2026-01-01'),
      snapshot: [],
      tags: [],
    });

    const view = await facade.loadRange('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');

    expect(view.gridEntries).toHaveLength(1);
    expect(view.stripEntries).toHaveLength(1);
  });

  it('excludes child Entries unless includeChildren is requested', async () => {
    const { facade, trackerRepository, entryRepository } = setup();
    const parentTracker = await createCommittedTracker(trackerRepository);
    const childTracker = await createCommittedTracker(trackerRepository);

    const parent = await entryRepository.create({
      trackerId: parentTracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T09:00:00.000Z'),
      snapshot: [],
      tags: [],
    });
    await entryRepository.create({
      trackerId: childTracker.id,
      parentEntryId: parent.id,
      placement: pointAt('2026-01-01T09:00:00.000Z'),
      snapshot: [],
      tags: [],
    });

    const withoutChildren = await facade.loadRange(
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    );
    const withChildren = await facade.loadRange(
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      { includeChildren: true },
    );

    expect(withoutChildren.gridEntries).toHaveLength(1);
    expect(withChildren.gridEntries).toHaveLength(2);
  });
});
