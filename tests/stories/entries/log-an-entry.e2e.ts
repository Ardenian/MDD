import { EntryFormDialogObject } from '../../../src/app/features/entries/entry-form-dialog.pom';
import { TrackerDesignerPageObject } from '../../../src/app/features/trackers/tracker-designer-page.pom';
import { TrackersPageObject } from '../../../src/app/features/trackers/trackers-page.pom';
import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { readEntries, readLiveEntries } from '../../../src/app/testing/support/local-database';
import { createTracker, type TrackerFieldSpec } from '../../flows/create-tracker.flow';
import { logEntry } from '../../flows/log-entry.flow';

const SLEEP_FIELDS: readonly TrackerFieldSpec[] = [
  { name: 'Satisfaction', dataType: 'integer' },
  { name: 'Energy', dataType: 'singleSelect', options: ['low', 'medium', 'high'] },
];

test.describe('Logging an Entry', () => {
  test('the form renders one input per Field of the current Version and pins the Entry to it', async ({
    appPage,
  }) => {
    const sleepId = await createTracker(appPage, { name: 'Sleep', fields: SLEEP_FIELDS });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: sleepId });
    await expect(form.versionLabel).toContainText('1');
    await form.entry.field('Satisfaction').fill('4');
    await form.entry.field('Energy').select.choose('high');
    await form.save();

    await expect
      .poll(() => readLiveEntries(appPage))
      .toEqual([
        expect.objectContaining({
          trackerId: sleepId,
          trackerVersion: 1,
          parentEntryId: null,
          snapshot: [
            { fieldName: 'Satisfaction', value: 4 },
            { fieldName: 'Energy', value: 'high' },
          ],
        }),
      ]);
  });

  test('an optional select the user never touches is saved empty, not as its first option', async ({
    appPage,
  }) => {
    const sleepId = await createTracker(appPage, { name: 'Sleep', fields: SLEEP_FIELDS });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: sleepId });
    await expect(form.entry.field('Energy').select.option('low')).not.toHaveAttribute(
      'aria-selected',
      'true',
    );
    await form.entry.field('Satisfaction').fill('4');
    await form.save();

    await expect
      .poll(async () => (await readLiveEntries(appPage))[0]?.snapshot)
      .toContainEqual({ fieldName: 'Energy', value: null });
  });

  test('placement starts in the Tracker’s default Time mode and can be overridden with a Fadeout', async ({
    appPage,
  }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: SLEEP_FIELDS,
      defaultTimeMode: 'period',
    });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: sleepId, at: '2026-03-01T10:01:00.000Z' });
    await expect(form.placement.mode.option('period')).toHaveAttribute('aria-selected', 'true');
    await form.placement.mode.choose('point');
    await form.placement.setFadeout(0, 60);
    await form.save();

    await expect
      .poll(async () => (await readLiveEntries(appPage))[0]?.placement)
      .toEqual({
        kind: 'point',
        at: '2026-03-01T10:01:00.000Z',
        fadeout: { beforeMinutes: 0, afterMinutes: 60 },
      });
  });

  test('an old Entry still renders against the Version it was logged under', async ({
    appPage,
  }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });
    await logEntry(appPage, { trackerId: sleepId, values: [{ field: 'Energy', choose: 'high' }] });
    const [entry] = await readLiveEntries(appPage);

    const list = new TrackersPageObject(appPage);
    await list.open();
    await list.list.row(sleepId).open();
    const designer = new TrackerDesignerPageObject(appPage);
    await designer.field(0).setName('EnergyLevel');
    await designer.commit();
    await designer.waitForCommittedVersion(2);

    const form = new EntryFormDialogObject(appPage);
    await form.openSaved(entry!.id);

    await expect(form.entry.field('Energy').select.option('high')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(form.entry.field('EnergyLevel').self).toHaveCount(0);
    await expect(form.versionExplanation).toBeVisible();
  });

  test('embedded children are saved with their own Tags, and removing one deletes it', async ({
    appPage,
  }) => {
    const ingredientId = await createTracker(appPage, {
      name: 'Ingredient',
      fields: [{ name: 'grams', dataType: 'decimal' }],
    });
    const mealId = await createTracker(appPage, {
      name: 'Meal',
      fields: [
        {
          name: 'Ingredients',
          dataType: 'reference',
          targetTrackerId: ingredientId,
          cardinality: 'many',
        },
      ],
    });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: mealId });
    await form.entry.reference('Ingredients').addChild();
    await form.entry.reference('Ingredients').addChild();
    await expect(form.children).toHaveCount(2);
    await form.child(0).field('grams').fill('120');
    await form.child(0).tags.add('dairy');
    await form.child(1).field('grams').fill('30');
    await form.save();

    await expect.poll(async () => (await readLiveEntries(appPage)).length).toBe(3);
    const saved = await readLiveEntries(appPage);
    const meal = saved.find((entry) => entry.parentEntryId === null)!;
    const butter = saved.find((entry) => entry.snapshot[0]?.value === 120)!;
    const toast = saved.find((entry) => entry.snapshot[0]?.value === 30)!;
    expect(meal.tags).toEqual([]);
    expect(butter).toMatchObject({
      parentEntryId: meal.id,
      tags: ['dairy'],
      placement: meal.placement,
    });

    await form.openSaved(meal.id);
    await expect(form.children).toHaveCount(2);
    await form.child(1).remove();
    await form.save();

    await expect
      .poll(
        async () => (await readEntries(appPage)).find((entry) => entry.id === toast.id)?.deletedAt,
      )
      .not.toBeNull();
    await expect.poll(async () => (await readLiveEntries(appPage)).length).toBe(2);
  });

  test('a required self-reference cannot be satisfied past the expansion-depth cap', async ({
    appPage,
  }) => {
    const mealId = await createTracker(appPage, {
      name: 'Meal',
      fields: [
        {
          name: 'Component',
          dataType: 'reference',
          required: true,
          targetTrackerId: 'self',
          cardinality: 'one',
        },
      ],
    });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: mealId });
    await form.entry.reference('Component').addChild();
    for (let index = 0; index < 3; index++) {
      await form.child(index).reference('Component').addChild();
    }

    const deepest = form.child(3);
    await expect(form.children).toHaveCount(4);
    await expect(deepest.level).toContainText('5');
    await expect(deepest.reference('Component').addButton).toBeDisabled();
    await expect(deepest.reference('Component').capReached).toBeVisible();
    await expect(deepest.reference('Component').error).toBeVisible();
    await expect(form.saveButton).toBeDisabled();
  });

  test('Tags autocomplete from Tags already in use', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, { name: 'Sleep', fields: SLEEP_FIELDS });
    await logEntry(appPage, { trackerId: sleepId, tags: ['dairy'] });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: sleepId });
    await form.entry.tags.pickSuggestion('da', 'dairy');

    await expect(form.entry.tags.chip('dairy')).toBeVisible();
  });

  test('a saved Entry can be deleted', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, { name: 'Sleep', fields: SLEEP_FIELDS });
    await logEntry(appPage, { trackerId: sleepId, values: [{ field: 'Satisfaction', fill: '3' }] });
    const [entry] = await readLiveEntries(appPage);
    const form = new EntryFormDialogObject(appPage);

    await form.openSaved(entry!.id);
    await form.delete();

    await expect.poll(() => readLiveEntries(appPage)).toEqual([]);
  });
});

test.describe('Entry form validation', { tag: '@integration-candidate' }, () => {
  test('a required Field blocks saving, with its error linked to the control', async ({
    appPage,
  }) => {
    const journalId = await createTracker(appPage, {
      name: 'Journal',
      fields: [{ name: 'Notes', dataType: 'text', required: true }],
    });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: journalId });
    const notes = form.entry.field('Notes');
    await expect(notes.error).toBeVisible();
    await expect(notes.control).toHaveAttribute(
      'aria-describedby',
      (await notes.error.getAttribute('id')) ?? '',
    );
    await expect(form.saveButton).toBeDisabled();

    await notes.fill('Slept well');

    await expect(notes.error).toHaveCount(0);
    await expect(form.saveButton).toBeEnabled();
  });

  test('a whole number is required for an integer Field', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, { name: 'Sleep', fields: SLEEP_FIELDS });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: sleepId });
    await form.entry.field('Satisfaction').fill('2.5');

    await expect(form.entry.field('Satisfaction').error).toBeVisible();
    await expect(form.saveButton).toBeDisabled();
  });

  test('a negative Fadeout blocks saving', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, { name: 'Sleep', fields: SLEEP_FIELDS });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: sleepId });
    await form.placement.setFadeout(-5, 0);

    await expect(form.placement.problem).toBeVisible();
    await expect(form.saveButton).toBeDisabled();
  });

  test('cancelling leaves nothing behind', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, { name: 'Sleep', fields: SLEEP_FIELDS });
    const form = new EntryFormDialogObject(appPage);

    await form.openNew({ trackerId: sleepId });
    await form.entry.field('Satisfaction').fill('4');
    await form.cancel();

    expect(await readEntries(appPage)).toEqual([]);
  });
});
