import { FakeEntryRepository } from './entry-repository.fake';
import { FakeTrackerRepository } from './tracker-repository.fake';
import type { FieldDef } from '../model/tracker';
import type { Placement } from '../model/entry';

async function createCommittedTracker(
  trackerRepository: FakeTrackerRepository,
  name: string,
  fields: readonly FieldDef[] = [],
) {
  const tracker = await trackerRepository.create({ name, defaultTimeMode: 'point' });
  await trackerRepository.saveDraft(tracker.id, fields);
  return trackerRepository.commitDraft(tracker.id);
}

function pointAt(iso: string): Placement {
  return { kind: 'point', at: iso, fadeout: null };
}

describe('FakeEntryRepository', () => {
  it('rejects creating an Entry against a Tracker with no committed Version', async () => {
    const trackerRepository = new FakeTrackerRepository();
    const entryRepository = new FakeEntryRepository(trackerRepository);
    const tracker = await trackerRepository.create({ name: 'Sleep', defaultTimeMode: 'point' });

    await expect(
      entryRepository.create({
        trackerId: tracker.id,
        parentEntryId: null,
        placement: pointAt('2026-01-01T10:00:00.000Z'),
        snapshot: [],
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'invalid-input' });
  });

  it('pins a new Entry to the Tracker current Version at creation time', async () => {
    const trackerRepository = new FakeTrackerRepository();
    const entryRepository = new FakeEntryRepository(trackerRepository);
    const tracker = await createCommittedTracker(trackerRepository, 'Sleep');

    const entry = await entryRepository.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T10:00:00.000Z'),
      snapshot: [],
      tags: ['great-night'],
    });

    expect(entry.trackerVersion).toBe(1);
    expect(entry.revision).toBe(1);
  });

  it('listByRange includes a boundary-touching Entry and excludes soft-deleted ones', async () => {
    const trackerRepository = new FakeTrackerRepository();
    const entryRepository = new FakeEntryRepository(trackerRepository);
    const tracker = await createCommittedTracker(trackerRepository, 'Sleep');

    const boundary = await entryRepository.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-02T00:00:00.000Z'),
      snapshot: [],
      tags: [],
    });
    const deleted = await entryRepository.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T12:00:00.000Z'),
      snapshot: [],
      tags: [],
    });
    await entryRepository.softDelete(deleted.id);

    const results = await entryRepository.listByRange(
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    );

    expect(results.map((entry) => entry.id)).toEqual([boundary.id]);
  });

  it('excludes child Entries by default and includes them with includeChildren', async () => {
    const trackerRepository = new FakeTrackerRepository();
    const entryRepository = new FakeEntryRepository(trackerRepository);
    const parentTracker = await createCommittedTracker(trackerRepository, 'Meal');
    const childTracker = await createCommittedTracker(trackerRepository, 'Ingredient');

    const parent = await entryRepository.create({
      trackerId: parentTracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T12:00:00.000Z'),
      snapshot: [],
      tags: [],
    });
    await entryRepository.create({
      trackerId: childTracker.id,
      parentEntryId: parent.id,
      placement: pointAt('2026-01-01T12:00:00.000Z'),
      snapshot: [],
      tags: [],
    });

    const withoutChildren = await entryRepository.listByRange(
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
    );
    const withChildren = await entryRepository.listByRange(
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      { includeChildren: true },
    );

    expect(withoutChildren).toHaveLength(1);
    expect(withChildren).toHaveLength(2);
  });

  it('tracks tag counts across create, update, and soft delete', async () => {
    const trackerRepository = new FakeTrackerRepository();
    const entryRepository = new FakeEntryRepository(trackerRepository);
    const tracker = await createCommittedTracker(trackerRepository, 'Sleep');

    const entry = await entryRepository.create({
      trackerId: tracker.id,
      parentEntryId: null,
      placement: pointAt('2026-01-01T10:00:00.000Z'),
      snapshot: [],
      tags: ['insomnia'],
    });
    expect(entryRepository.tagCountsSnapshot().get('insomnia')).toBe(1);

    await entryRepository.update(entry.id, { tags: ['insomnia', 'travel'] });
    expect(entryRepository.tagCountsSnapshot().get('travel')).toBe(1);

    await entryRepository.softDelete(entry.id);
    expect(entryRepository.tagCountsSnapshot().get('insomnia')).toBe(0);
    expect(entryRepository.tagCountsSnapshot().get('travel')).toBe(0);
  });
});
