import { EntryFormDialogObject } from '../../../src/app/features/entries/entry-form-dialog.pom';
import { TrackerDesignerPageObject } from '../../../src/app/features/trackers/tracker-designer-page.pom';
import { TrackersPageObject } from '../../../src/app/features/trackers/trackers-page.pom';
import { CalendarPageObject } from '../../../src/app/features/calendar/calendar-page.pom';
import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { createTracker } from '../../flows/create-tracker.flow';

test.describe('Presets', () => {
  test('a Preset with a filled child pre-fills a new Entry', async ({ appPage }) => {
    const ingredientId = await createTracker(appPage, {
      name: 'Ingredient',
      fields: [{ name: 'grams', dataType: 'decimal' }],
    });
    const mealId = await createTracker(appPage, {
      name: 'Meal',
      fields: [
        { name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] },
        {
          name: 'Ingredients',
          dataType: 'reference',
          targetTrackerId: ingredientId,
          cardinality: 'many',
        },
      ],
    });
    const presets = new TrackerDesignerPageObject(appPage).presets;

    await presets.newPreset();
    await presets.editor.setName('Full English');
    await presets.editor.preset.field('Energy').select.choose('high');
    await presets.editor.preset.reference('Ingredients').addChild();
    await presets.editor.child(0).field('grams').fill('120');
    await presets.editor.save();

    const row = presets.list.row(0);
    await expect(row.name).toHaveText('Full English');
    await expect(row.pinnedVersion).toContainText('1');
    await expect(row.staleBadge).toHaveCount(0);

    const form = new EntryFormDialogObject(appPage);
    await form.openNew({ trackerId: mealId, presetId: await row.presetId() });

    await expect(form.entry.field('Energy').select.option('high')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(form.children).toHaveCount(1);
    await expect(form.child(0).field('grams').control).toHaveValue('120');
  });

  test('a stale Preset still works, and stays stale until it is re-saved', async ({ appPage }) => {
    const sleepId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });
    const designer = new TrackerDesignerPageObject(appPage);
    await designer.presets.newPreset();
    await designer.presets.editor.setName('Good night');
    await designer.presets.editor.preset.field('Energy').select.choose('high');
    await designer.presets.editor.save();
    const presetId = await designer.presets.list.row(0).presetId();

    await designer.addField();
    await designer.field(1).setName('Notes');
    await designer.commit();
    await designer.waitForCommittedVersion(2);
    await expect(designer.presets.list.row(0).staleBadge).toBeVisible();
    await expect(designer.presets.list.staleSummary).not.toBeEmpty();

    const form = new EntryFormDialogObject(appPage);
    await form.openNew({ trackerId: sleepId });
    await form.preset.choose(presetId);
    await expect(form.entry.field('Energy').select.option('high')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await form.save();

    // The Entry pinned to the Tracker's current Version, not the Preset's stale one.
    const calendar = new CalendarPageObject(appPage);
    await calendar.open();
    await calendar.dayOf(new Date()).openEntry();
    await expect(form.versionLabel).toContainText('2');
    await form.cancel();

    const list = new TrackersPageObject(appPage);
    await list.open();
    await list.list.row(sleepId).open();
    const presets = new TrackerDesignerPageObject(appPage).presets;
    await expect(presets.list.row(0).staleBadge).toBeVisible();

    await presets.list.row(0).edit();
    await presets.editor.save();

    await expect(presets.list.row(0).staleBadge).toHaveCount(0);
    await expect(presets.list.row(0).pinnedVersion).toContainText('2');
  });

  test('a Preset can be deleted', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });
    const presets = new TrackerDesignerPageObject(appPage).presets;
    await presets.newPreset();
    await presets.editor.setName('Good night');
    await presets.editor.save();
    await expect(presets.list.rows).toHaveCount(1);

    await presets.list.row(0).delete();

    await expect(presets.list.rows).toHaveCount(0);
    await expect(presets.list.empty).toBeVisible();
  });

  test('Presets are offered only once the Tracker has a committed Version', async ({ appPage }) => {
    await createTracker(appPage, { name: 'Snack', fields: [], commit: false });

    await expect(new TrackerDesignerPageObject(appPage).presets.unavailable).toBeVisible();
  });
});

test.describe('Preset editor validation', { tag: '@integration-candidate' }, () => {
  test('a Preset needs a name, but no required Field needs a value', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Journal',
      fields: [{ name: 'Notes', dataType: 'text', required: true }],
    });
    const presets = new TrackerDesignerPageObject(appPage).presets;

    await presets.newPreset();
    await expect(presets.editor.nameError).toBeVisible();
    await expect(presets.editor.saveButton).toBeDisabled();

    await presets.editor.setName('Blank page');

    await expect(presets.editor.preset.field('Notes').error).toHaveCount(0);
    await expect(presets.editor.saveButton).toBeEnabled();
  });

  test('a filled value must still have the right shape', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });
    const presets = new TrackerDesignerPageObject(appPage).presets;

    await presets.newPreset();
    await presets.editor.setName('Good night');
    await presets.editor.preset.field('Satisfaction').fill('2.5');

    await expect(presets.editor.preset.field('Satisfaction').error).toBeVisible();
    await expect(presets.editor.saveButton).toBeDisabled();
  });
});
