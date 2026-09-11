import { FakeTrackerRepository } from './tracker-repository.fake';
import type { FieldDef } from '../model/tracker';

const satisfaction: FieldDef = { name: 'Satisfaction', required: true, dataType: 'integer' };
const notes: FieldDef = { name: 'Notes', required: false, dataType: 'text' };

describe('FakeTrackerRepository', () => {
  it('creates a Tracker with no committed Version yet', async () => {
    const repository = new FakeTrackerRepository();
    const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });

    expect(tracker.currentVersion).toBe(0);
    expect(tracker.archived).toBe(false);
    expect(tracker.draftFields).toEqual([]);
  });

  it('mints Version 1 the first time a non-empty Draft is committed', async () => {
    const repository = new FakeTrackerRepository();
    const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });

    await repository.saveDraft(tracker.id, [satisfaction]);
    const committed = await repository.commitDraft(tracker.id);

    expect(committed.currentVersion).toBe(1);
    expect(committed.draftFields).toBeNull();

    const version = await repository.getVersion(tracker.id, 1);
    expect(version?.fields).toEqual([satisfaction]);
  });

  it('mints nothing when the committed Draft is unchanged from the current Version', async () => {
    const repository = new FakeTrackerRepository();
    const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });
    await repository.saveDraft(tracker.id, [satisfaction]);
    await repository.commitDraft(tracker.id);

    await repository.saveDraft(tracker.id, [satisfaction]);
    const secondCommit = await repository.commitDraft(tracker.id);

    expect(secondCommit.currentVersion).toBe(1);
    expect(await repository.getVersion(tracker.id, 2)).toBeNull();
  });

  it('mints Version 2 when the committed Draft actually changes the Fields', async () => {
    const repository = new FakeTrackerRepository();
    const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });
    await repository.saveDraft(tracker.id, [satisfaction]);
    await repository.commitDraft(tracker.id);

    await repository.saveDraft(tracker.id, [satisfaction, notes]);
    const secondCommit = await repository.commitDraft(tracker.id);

    expect(secondCommit.currentVersion).toBe(2);
    expect((await repository.getVersion(tracker.id, 1))?.fields).toEqual([satisfaction]);
    expect((await repository.getVersion(tracker.id, 2))?.fields).toEqual([satisfaction, notes]);
  });

  it('commitDraft is a true no-op when there is no pending Draft', async () => {
    const repository = new FakeTrackerRepository();
    const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });
    await repository.saveDraft(tracker.id, [satisfaction]);
    await repository.commitDraft(tracker.id);

    const beforeRevision = (await repository.get(tracker.id))!.revision;
    const result = await repository.commitDraft(tracker.id);

    expect(result.revision).toBe(beforeRevision);
  });

  it('renaming or archiving never mints a Tracker Version', async () => {
    const repository = new FakeTrackerRepository();
    const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });
    await repository.saveDraft(tracker.id, [satisfaction]);
    await repository.commitDraft(tracker.id);

    await repository.updateMeta(tracker.id, { name: 'Sleep log', defaultTimeMode: 'point' });
    const archived = await repository.archive(tracker.id);

    expect(archived.currentVersion).toBe(1);
    expect(archived.archived).toBe(true);
    expect(await repository.getVersion(tracker.id, 2)).toBeNull();
  });

  describe('discardDraft', () => {
    it('clears a pending Draft without touching the current Version', async () => {
      const repository = new FakeTrackerRepository();
      const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });
      await repository.saveDraft(tracker.id, [satisfaction]);
      await repository.commitDraft(tracker.id);

      await repository.saveDraft(tracker.id, [satisfaction, notes]);
      const discarded = await repository.discardDraft(tracker.id);

      expect(discarded.draftFields).toBeNull();
      expect(discarded.currentVersion).toBe(1);
      expect(await repository.getVersion(tracker.id, 2)).toBeNull();
    });

    it('is a no-op when there is no pending Draft', async () => {
      const repository = new FakeTrackerRepository();
      const tracker = await repository.create({ name: 'Sleep', defaultTimeMode: 'period' });
      await repository.saveDraft(tracker.id, [satisfaction]);
      await repository.commitDraft(tracker.id);

      const beforeRevision = (await repository.get(tracker.id))!.revision;
      const result = await repository.discardDraft(tracker.id);

      expect(result.revision).toBe(beforeRevision);
    });
  });
});
