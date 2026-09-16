import { DEFAULT_SETTINGS } from '../model/settings';
import { EXPORT_FORMAT_VERSION, type ExportBundle } from '../model/export-bundle';
import type { FieldDef } from '../model/field-def';
import type { DataLayer } from './in-memory-data-layer';

const SATISFACTION: FieldDef = { name: 'Satisfaction', required: false, dataType: 'integer' };
const ENERGY: FieldDef = {
  name: 'Energy',
  required: false,
  dataType: 'singleSelect',
  options: ['low', 'medium', 'high'],
};

/**
 * The behaviour every implementation of the `data/` ports must exhibit, independent of
 * how it stores anything. Run against the in-memory engine today; an HTTP adapter runs
 * through the same suite when it lands (data/SPEC.md).
 */
export function describeDataPortContract(name: string, createLayer: () => DataLayer): void {
  describe(name, () => {
    let layer: DataLayer;

    beforeEach(() => {
      layer = createLayer();
    });

    async function createSleepTracker(fields: readonly FieldDef[] = [SATISFACTION]) {
      return layer.trackers.create({ name: 'Sleep', defaultTimeMode: 'period', fields });
    }

    describe('TrackerRepository', () => {
      it('commits the initial fields as Version 1', async () => {
        const tracker = await createSleepTracker();

        expect(tracker.currentVersion).toBe(1);
        expect(tracker.draftFields).toEqual([SATISFACTION]);
        await expect(layer.trackers.getVersion(tracker.id, 1)).resolves.toMatchObject({
          version: 1,
          fields: [SATISFACTION],
        });
      });

      it('starts at Version 0 with an empty Draft when created without fields', async () => {
        const tracker = await layer.trackers.create({ name: 'Snack', defaultTimeMode: 'point' });

        expect(tracker.currentVersion).toBe(0);
        expect(tracker.draftFields).toEqual([]);
        await expect(layer.trackers.getVersion(tracker.id, 1)).resolves.toBeUndefined();
      });

      it('writes Tracker Versions as write-once rows', async () => {
        const tracker = await createSleepTracker();
        const version = await layer.trackers.getVersion(tracker.id, 1);

        expect(version).toMatchObject({ revision: 1, deletedAt: null, trackerId: tracker.id });
      });

      it('keeps a Draft invisible to the committed schema until it is committed', async () => {
        const tracker = await createSleepTracker();

        const drafted = await layer.trackers.saveDraft(tracker.id, [SATISFACTION, ENERGY]);

        expect(drafted.draftFields).toEqual([SATISFACTION, ENERGY]);
        expect(drafted.currentVersion).toBe(1);
        await expect(layer.trackers.getVersion(tracker.id, 1)).resolves.toMatchObject({
          fields: [SATISFACTION],
        });
      });

      it('mints the next Version when the Draft differs', async () => {
        const tracker = await createSleepTracker();
        await layer.trackers.saveDraft(tracker.id, [SATISFACTION, ENERGY]);

        const committed = await layer.trackers.commitDraft(tracker.id);

        expect(committed.currentVersion).toBe(2);
        await expect(layer.trackers.getVersion(tracker.id, 2)).resolves.toMatchObject({
          fields: [SATISFACTION, ENERGY],
        });
      });

      it('mints nothing when the Draft is unchanged from the current Version', async () => {
        const tracker = await createSleepTracker();
        await layer.trackers.saveDraft(tracker.id, [SATISFACTION]);

        const committed = await layer.trackers.commitDraft(tracker.id);

        expect(committed.currentVersion).toBe(1);
        await expect(layer.trackers.getVersion(tracker.id, 2)).resolves.toBeUndefined();
      });

      it('leaves the previous Version untouched when a new one is minted', async () => {
        const tracker = await createSleepTracker();
        await layer.trackers.saveDraft(tracker.id, [{ ...SATISFACTION, dataType: 'decimal' }]);
        await layer.trackers.commitDraft(tracker.id);

        await expect(layer.trackers.getVersion(tracker.id, 1)).resolves.toMatchObject({
          fields: [SATISFACTION],
        });
      });

      it('treats a reordering of the same Fields as a change worth versioning', async () => {
        const tracker = await createSleepTracker([SATISFACTION, ENERGY]);
        await layer.trackers.saveDraft(tracker.id, [ENERGY, SATISFACTION]);

        const committed = await layer.trackers.commitDraft(tracker.id);

        expect(committed.currentVersion).toBe(2);
      });

      it('applies a rename and Time-mode change without versioning', async () => {
        const tracker = await createSleepTracker();

        const updated = await layer.trackers.updateMeta(tracker.id, {
          name: 'Sleep & Rest',
          defaultTimeMode: 'point',
        });

        expect(updated).toMatchObject({
          name: 'Sleep & Rest',
          defaultTimeMode: 'point',
          currentVersion: 1,
        });
        expect(updated.revision).toBe(tracker.revision + 1);
      });

      it('archives and unarchives without touching Versions or Entries', async () => {
        const tracker = await createSleepTracker();
        const entry = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });

        const archived = await layer.trackers.archive(tracker.id);
        expect(archived.archived).toBe(true);

        await expect(layer.trackers.getVersion(tracker.id, 1)).resolves.toMatchObject({ revision: 1 });
        await expect(layer.entries.get(entry.id)).resolves.toMatchObject({ revision: entry.revision });

        const unarchived = await layer.trackers.unarchive(tracker.id);
        expect(unarchived.archived).toBe(false);
      });

      it('lists archived Trackers alongside the rest', async () => {
        const tracker = await createSleepTracker();
        await layer.trackers.archive(tracker.id);

        await expect(layer.trackers.list()).resolves.toHaveLength(1);
      });

      it('rejects work against a Tracker that does not exist', async () => {
        await expect(layer.trackers.commitDraft('missing')).rejects.toMatchObject({
          name: 'DataError',
          code: 'not-found',
        });
      });
    });

    describe('EntryRepository', () => {
      it('pins an Entry to the Tracker Version current at creation', async () => {
        const tracker = await createSleepTracker();
        const first = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [{ fieldName: 'Satisfaction', value: 4 }],
          tags: [],
        });

        await layer.trackers.saveDraft(tracker.id, [SATISFACTION, ENERGY]);
        await layer.trackers.commitDraft(tracker.id);

        const second = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-02T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });

        expect(first.trackerVersion).toBe(1);
        expect(second.trackerVersion).toBe(2);
        await expect(layer.entries.get(first.id)).resolves.toMatchObject({ trackerVersion: 1 });
      });

      it('includes an Entry that only touches the range boundary', async () => {
        const tracker = await createSleepTracker();
        await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'period', start: '2026-03-01T08:00:00.000Z', end: '2026-03-01T09:00:00.000Z' },
          snapshot: [],
          tags: [],
        });

        const touching = await layer.entries.listByRange(
          '2026-03-01T09:00:00.000Z',
          '2026-03-01T12:00:00.000Z',
        );
        const beyond = await layer.entries.listByRange(
          '2026-03-01T09:00:00.001Z',
          '2026-03-01T12:00:00.000Z',
        );

        expect(touching).toHaveLength(1);
        expect(beyond).toHaveLength(0);
      });

      it('includes an Entry whose Fadeout reaches into the range', async () => {
        const tracker = await createSleepTracker();
        await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: {
            kind: 'point',
            at: '2026-03-01T10:01:00.000Z',
            fadeout: { beforeMinutes: 0, afterMinutes: 60 },
          },
          snapshot: [],
          tags: [],
        });

        await expect(
          layer.entries.listByRange('2026-03-01T10:30:00.000Z', '2026-03-01T23:00:00.000Z'),
        ).resolves.toHaveLength(1);
      });

      it('returns children only when they are asked for', async () => {
        const tracker = await createSleepTracker();
        const parent = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });
        await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });

        const range = ['2026-03-01T00:00:00.000Z', '2026-03-01T23:59:59.999Z'] as const;
        await expect(layer.entries.listByRange(...range)).resolves.toHaveLength(1);
        await expect(
          layer.entries.listByRange(...range, { includeChildren: true }),
        ).resolves.toHaveLength(2);
      });

      it('locks a child Entry to its parent placement', async () => {
        const tracker = await createSleepTracker();
        const parent = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'period', start: '2026-03-01T08:00:00.000Z', end: '2026-03-01T09:00:00.000Z' },
          snapshot: [],
          tags: [],
        });

        const child = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-04-09T23:00:00.000Z' },
          snapshot: [],
          tags: [],
        });

        expect(child.placement).toEqual(parent.placement);
      });

      it('keeps a child Entry Tags independent of its parent', async () => {
        const tracker = await createSleepTracker();
        const parent = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: ['parent-tag'],
        });
        const child = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: ['child-tag'],
        });

        expect(child.tags).toEqual(['child-tag']);
        await expect(layer.entries.get(parent.id)).resolves.toMatchObject({ tags: ['parent-tag'] });
      });

      it('lists children in creation order', async () => {
        const tracker = await createSleepTracker();
        const parent = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });
        const first = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [{ fieldName: 'Satisfaction', value: 1 }],
          tags: [],
        });
        const second = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [{ fieldName: 'Satisfaction', value: 2 }],
          tags: [],
        });

        const children = await layer.entries.listChildren(parent.id);
        expect(children.map((entry) => entry.id)).toEqual([first.id, second.id]);
      });

      it('refuses to re-parent an Entry', async () => {
        const tracker = await createSleepTracker();
        const parent = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });
        const child = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });

        await expect(
          layer.entries.update(child.id, {
            trackerId: tracker.id,
            parentEntryId: null,
            placement: child.placement,
            snapshot: [],
            tags: [],
          }),
        ).rejects.toMatchObject({ name: 'DataError', code: 'invalid' });
      });

      it('bumps revision on update and keeps the pinned Version', async () => {
        const tracker = await createSleepTracker();
        const entry = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [{ fieldName: 'Satisfaction', value: 4 }],
          tags: [],
        });
        await layer.trackers.saveDraft(tracker.id, [SATISFACTION, ENERGY]);
        await layer.trackers.commitDraft(tracker.id);

        const updated = await layer.entries.update(entry.id, {
          trackerId: tracker.id,
          parentEntryId: null,
          placement: entry.placement,
          snapshot: [{ fieldName: 'Satisfaction', value: 5 }],
          tags: [],
        });

        expect(updated.revision).toBe(entry.revision + 1);
        expect(updated.trackerVersion).toBe(1);
        expect(updated.createdAt).toBe(entry.createdAt);
      });

      it('soft-deletes an Entry, its children, and hides them from range reads', async () => {
        const tracker = await createSleepTracker();
        const parent = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });
        const child = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });

        await layer.entries.softDelete(parent.id);

        const range = ['2026-03-01T00:00:00.000Z', '2026-03-01T23:59:59.999Z'] as const;
        await expect(layer.entries.listByRange(...range, { includeChildren: true })).resolves.toEqual([]);
        await expect(layer.entries.listChildren(parent.id)).resolves.toEqual([]);
        await expect(layer.entries.get(parent.id)).resolves.toMatchObject({ deletedAt: expect.any(String) });
        await expect(layer.entries.get(child.id)).resolves.toMatchObject({ deletedAt: expect.any(String) });
      });

      it('rejects an Entry against a Tracker that does not exist', async () => {
        await expect(
          layer.entries.create({
            trackerId: 'missing',
            parentEntryId: null,
            placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
            snapshot: [],
            tags: [],
          }),
        ).rejects.toMatchObject({ name: 'DataError', code: 'not-found' });
      });

      it('rejects an Entry against a Tracker with no committed Version to pin to', async () => {
        const tracker = await layer.trackers.create({ name: 'Snack', defaultTimeMode: 'point' });

        await expect(
          layer.entries.create({
            trackerId: tracker.id,
            parentEntryId: null,
            placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
            snapshot: [],
            tags: [],
          }),
        ).rejects.toMatchObject({ name: 'DataError', code: 'invalid' });
      });

      it('counts live Entries per Tracker in one read', async () => {
        const sleep = await createSleepTracker();
        const workout = await layer.trackers.create({
          name: 'Workout',
          defaultTimeMode: 'period',
          fields: [SATISFACTION],
        });
        const placement = { kind: 'point', at: '2026-03-01T10:01:00.000Z' } as const;
        const doomed = await layer.entries.create({
          trackerId: sleep.id,
          parentEntryId: null,
          placement,
          snapshot: [],
          tags: [],
        });
        await layer.entries.create({
          trackerId: sleep.id,
          parentEntryId: null,
          placement,
          snapshot: [],
          tags: [],
        });
        await layer.entries.create({
          trackerId: workout.id,
          parentEntryId: null,
          placement,
          snapshot: [],
          tags: [],
        });
        await layer.entries.softDelete(doomed.id);

        const counts = await layer.entries.countsByTracker();

        expect(counts.get(sleep.id)).toBe(1);
        expect(counts.get(workout.id)).toBe(1);
      });

      it('refuses to move an Entry to another Tracker', async () => {
        const tracker = await createSleepTracker();
        const other = await layer.trackers.create({
          name: 'Workout',
          defaultTimeMode: 'period',
          fields: [SATISFACTION],
        });
        const entry = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });

        await expect(
          layer.entries.update(entry.id, {
            trackerId: other.id,
            parentEntryId: null,
            placement: entry.placement,
            snapshot: [],
            tags: [],
          }),
        ).rejects.toMatchObject({ name: 'DataError', code: 'invalid' });
      });
    });

    describe('PresetRepository', () => {
      it('pins a new Preset to the Tracker current Version', async () => {
        const tracker = await createSleepTracker();
        await layer.trackers.saveDraft(tracker.id, [SATISFACTION, ENERGY]);
        await layer.trackers.commitDraft(tracker.id);

        const preset = await layer.presets.create({
          trackerId: tracker.id,
          name: 'Good night',
          values: [{ fieldName: 'Satisfaction', value: 5 }],
          children: [],
        });

        expect(preset.trackerVersion).toBe(2);
      });

      it('re-pins a stale Preset when it is saved again', async () => {
        const tracker = await createSleepTracker();
        const preset = await layer.presets.create({
          trackerId: tracker.id,
          name: 'Good night',
          values: [],
          children: [],
        });
        await layer.trackers.saveDraft(tracker.id, [SATISFACTION, ENERGY]);
        await layer.trackers.commitDraft(tracker.id);

        const resaved = await layer.presets.update(preset.id, {
          trackerId: tracker.id,
          name: 'Good night',
          values: [],
          children: [],
        });

        expect(preset.trackerVersion).toBe(1);
        expect(resaved.trackerVersion).toBe(2);
      });

      it('stores a Preset value tree independent of the caller object', async () => {
        const tracker = await createSleepTracker();
        const values = [{ fieldName: 'Satisfaction', value: 5 }];

        const preset = await layer.presets.create({
          trackerId: tracker.id,
          name: 'Good night',
          values,
          children: [],
        });
        values[0] = { fieldName: 'Satisfaction', value: 1 };

        await expect(layer.presets.get(preset.id)).resolves.toMatchObject({
          values: [{ fieldName: 'Satisfaction', value: 5 }],
        });
      });

      it('counts live Presets per Tracker in one read', async () => {
        const tracker = await createSleepTracker();
        const doomed = await layer.presets.create({
          trackerId: tracker.id,
          name: 'Bad night',
          values: [],
          children: [],
        });
        await layer.presets.create({
          trackerId: tracker.id,
          name: 'Good night',
          values: [],
          children: [],
        });
        await layer.presets.delete(doomed.id);

        await expect(layer.presets.countsByTracker()).resolves.toEqual(
          new Map([[tracker.id, 1]]),
        );
      });

      it('soft-deletes a Preset out of its Tracker listing', async () => {
        const tracker = await createSleepTracker();
        const preset = await layer.presets.create({
          trackerId: tracker.id,
          name: 'Good night',
          values: [],
          children: [],
        });

        await layer.presets.delete(preset.id);

        await expect(layer.presets.listByTracker(tracker.id)).resolves.toEqual([]);
        await expect(layer.presets.get(preset.id)).resolves.toMatchObject({
          deletedAt: expect.any(String),
        });
      });
    });

    describe('TagRepository', () => {
      async function tagEntries(tags: readonly (readonly string[])[]): Promise<void> {
        const tracker = await createSleepTracker();
        for (const entryTags of tags) {
          await layer.entries.create({
            trackerId: tracker.id,
            parentEntryId: null,
            placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
            snapshot: [],
            tags: entryTags,
          });
        }
      }

      it('registers every Tag an Entry introduces, exactly once', async () => {
        await tagEntries([['dairy', 'lunch'], ['dairy']]);

        const all = await layer.tags.listAll();
        expect(all.map((tag) => tag.name).sort()).toEqual(['dairy', 'lunch']);
      });

      it('suggests by case-insensitive prefix, ranked by usage then alphabetically', async () => {
        await tagEntries([
          ['dairy', 'dessert'],
          ['dairy'],
          ['dairy'],
          ['dessert'],
          ['daily'],
          ['lunch'],
        ]);

        const suggestions = await layer.tags.suggest('DA');

        expect(suggestions).toEqual([
          { name: 'dairy', usageCount: 3 },
          { name: 'daily', usageCount: 1 },
        ]);
      });

      it('does not count Tags carried only by soft-deleted Entries', async () => {
        const tracker = await createSleepTracker();
        const entry = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: ['dairy'],
        });
        await layer.entries.softDelete(entry.id);

        await expect(layer.tags.suggest('dai')).resolves.toEqual([{ name: 'dairy', usageCount: 0 }]);
      });
    });

    describe('SettingsRepository', () => {
      it('returns the documented fallbacks before anything is saved', async () => {
        await expect(layer.settings.get()).resolves.toMatchObject(DEFAULT_SETTINGS);
      });

      it('merges a patch and leaves the rest alone', async () => {
        await layer.settings.save({ expansionDepthCap: 3 });
        const saved = await layer.settings.save({ defaultBucketSize: 'week' });

        expect(saved).toMatchObject({
          expansionDepthCap: 3,
          defaultBucketSize: 'week',
          guardrails: DEFAULT_SETTINGS.guardrails,
        });
        expect(saved.revision).toBeGreaterThan(1);
      });

      it('persists across reads', async () => {
        await layer.settings.save({ activeProfileId: 'offline', expansionDepthCap: 7 });

        await expect(layer.settings.get()).resolves.toMatchObject({ expansionDepthCap: 7 });
      });
    });

    describe('CorrelationDataSource', () => {
      it('returns in-range Entries with the exact Versions they pin to', async () => {
        const tracker = await createSleepTracker();
        await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });
        await layer.trackers.saveDraft(tracker.id, [SATISFACTION, ENERGY]);
        await layer.trackers.commitDraft(tracker.id);

        const dataset = await layer.correlation.loadEntriesForScope(
          { start: '2026-03-01T00:00:00.000Z', end: '2026-03-02T00:00:00.000Z' },
          {},
        );

        expect(dataset.entries).toHaveLength(1);
        expect(dataset.trackerVersions.map((version) => version.version)).toEqual([1]);
        expect(dataset.trackers.map((entry) => entry.id)).toEqual([tracker.id]);
      });

      it('limits the dataset to the scoped Trackers', async () => {
        const sleep = await createSleepTracker();
        const workout = await layer.trackers.create({
          name: 'Workout',
          defaultTimeMode: 'period',
          fields: [SATISFACTION],
        });
        for (const trackerId of [sleep.id, workout.id]) {
          await layer.entries.create({
            trackerId,
            parentEntryId: null,
            placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
            snapshot: [],
            tags: [],
          });
        }

        const dataset = await layer.correlation.loadEntriesForScope(
          { start: '2026-03-01T00:00:00.000Z', end: '2026-03-02T00:00:00.000Z' },
          { trackerIds: [workout.id] },
        );

        expect(dataset.entries).toHaveLength(1);
        expect(dataset.entries[0]?.trackerId).toBe(workout.id);
      });

      it('includes child Entries, which carry their own Tags', async () => {
        const tracker = await createSleepTracker();
        const parent = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: [],
        });
        await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: parent.id,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [],
          tags: ['dairy'],
        });

        const dataset = await layer.correlation.loadEntriesForScope(
          { start: '2026-03-01T00:00:00.000Z', end: '2026-03-02T00:00:00.000Z' },
          {},
        );

        expect(dataset.entries).toHaveLength(2);
      });
    });

    describe('MaintenancePort', () => {
      async function seed() {
        const tracker = await createSleepTracker();
        const entry = await layer.entries.create({
          trackerId: tracker.id,
          parentEntryId: null,
          placement: { kind: 'point', at: '2026-03-01T10:01:00.000Z' },
          snapshot: [{ fieldName: 'Satisfaction', value: 4 }],
          tags: ['dairy'],
        });
        const preset = await layer.presets.create({
          trackerId: tracker.id,
          name: 'Good night',
          values: [],
          children: [],
        });
        await layer.settings.save({ expansionDepthCap: 3 });
        return { tracker, entry, preset };
      }

      it('creates exactly one Calendar, however often it is asked', async () => {
        const first = await layer.maintenance.ensureCalendar();
        const second = await layer.maintenance.ensureCalendar();

        expect(second.id).toBe(first.id);
      });

      it('counts live rows per aggregate', async () => {
        const { entry } = await seed();
        await layer.entries.softDelete(entry.id);

        await expect(layer.maintenance.counts()).resolves.toEqual({
          trackers: 1,
          trackerVersions: 1,
          entries: 0,
          presets: 1,
          tags: 1,
        });
      });

      it('empties every store and re-seeds one Calendar', async () => {
        await seed();
        await layer.maintenance.ensureCalendar();

        await layer.maintenance.clearAll();

        await expect(layer.maintenance.counts()).resolves.toEqual({
          trackers: 0,
          trackerVersions: 0,
          entries: 0,
          presets: 0,
          tags: 0,
        });
        await expect(layer.calendars()).resolves.toHaveLength(1);
      });

      it('exports live rows and portable Settings, never the Storage Profile', async () => {
        const { entry } = await seed();
        await layer.entries.softDelete(entry.id);

        const bundle = await layer.maintenance.exportAll();

        expect(bundle.formatVersion).toBe(EXPORT_FORMAT_VERSION);
        expect(bundle.entries).toEqual([]);
        expect(bundle.trackers).toHaveLength(1);
        expect(bundle.settings).toMatchObject({ expansionDepthCap: 3 });
        expect(bundle.settings).not.toHaveProperty('activeProfileId');
      });

      it('rejects a format-version mismatch without touching anything', async () => {
        await seed();
        const before = await layer.maintenance.counts();

        await expect(
          layer.maintenance.importAll({
            formatVersion: EXPORT_FORMAT_VERSION + 1,
            exportedAt: '2026-03-01T10:01:00.000Z',
            trackers: [],
            trackerVersions: [],
            entries: [],
            presets: [],
            tags: [],
            settings: {},
          }),
        ).rejects.toMatchObject({ name: 'DataError', code: 'unsupported' });

        await expect(layer.maintenance.counts()).resolves.toEqual(before);
      });

      it('replaces everything on import and leaves the Storage Profile alone', async () => {
        await seed();
        await layer.settings.save({ activeProfileId: 'offline' });
        const bundle: ExportBundle = {
          formatVersion: EXPORT_FORMAT_VERSION,
          exportedAt: '2026-03-01T10:01:00.000Z',
          trackers: [],
          trackerVersions: [],
          entries: [],
          presets: [],
          tags: [],
          settings: { expansionDepthCap: 9 },
        };

        await layer.maintenance.importAll(bundle);

        await expect(layer.maintenance.counts()).resolves.toEqual({
          trackers: 0,
          trackerVersions: 0,
          entries: 0,
          presets: 0,
          tags: 0,
        });
        await expect(layer.settings.get()).resolves.toMatchObject({
          expansionDepthCap: 9,
          activeProfileId: 'offline',
        });
        await expect(layer.calendars()).resolves.toHaveLength(1);
      });

      it('round-trips an export back into an unchanged dataset', async () => {
        await seed();
        const bundle = await layer.maintenance.exportAll();
        const before = await layer.maintenance.counts();

        await layer.maintenance.importAll(bundle);

        await expect(layer.maintenance.counts()).resolves.toEqual(before);
        await expect(layer.maintenance.exportAll()).resolves.toMatchObject({
          trackers: bundle.trackers,
          trackerVersions: bundle.trackerVersions,
          entries: bundle.entries,
          presets: bundle.presets,
        });
      });
    });
  });
}
