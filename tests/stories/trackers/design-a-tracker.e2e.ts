import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { TrackerDesignerPageObject } from '../../../src/app/features/trackers/tracker-designer-page.pom';
import { TrackersPageObject } from '../../../src/app/features/trackers/trackers-page.pom';
import { createTracker } from '../../flows/create-tracker.flow';

test.describe('Designing a Tracker', () => {
  test('committing a Draft with Fields mints Version 1', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [
        { name: 'Satisfaction', dataType: 'integer' },
        { name: 'Energy', dataType: 'singleSelect', options: ['low', 'medium', 'high'] },
      ],
    });

    const list = new TrackersPageObject(appPage);
    await list.open();

    await expect(list.list.row(trackerId).version).toHaveText(/1/);
  });

  test('a Draft is invisible to the committed Version until it is committed', async ({
    appPage,
  }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.addField();
    await designer.field(1).setName('Energy');

    await expect(designer.draftStatus).toContainText('differs');

    await designer.commit();

    await expect(designer.draftStatus).not.toContainText('differs');
  });

  test('renaming a Field mints the next Version', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.field(0).setName('EnergyLevel');
    await designer.commit();

    const list = new TrackersPageObject(appPage);
    await list.open();

    await expect(list.list.row(trackerId).version).toHaveText(/2/);
  });

  test('a Draft equal to the committed Version cannot be committed again', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });

    const designer = new TrackerDesignerPageObject(appPage);

    await expect(designer.commitButton).toBeDisabled();
  });

  test('renaming the Tracker and changing its Time mode never versions', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.rename('Sleep & Rest');
    await designer.defaultTimeMode.choose('point');

    const list = new TrackersPageObject(appPage);
    await list.open();

    await expect(list.list.row(trackerId).name).toHaveText('Sleep & Rest');
    await expect(list.list.row(trackerId).version).toHaveText(/1/);
  });

  test('a self-referencing Field commits without any depth warning', async ({ appPage }) => {
    const mealId = await createTracker(appPage, { name: 'Meal', fields: [], commit: false });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.addField();
    const row = designer.field(0);
    await row.setName('Component');
    await row.dataType.choose('reference');
    await row.referenceTarget.choose(mealId);
    await designer.commit();

    await expect(designer.problems).toHaveCount(0);
    await expect(designer.draftStatus).toContainText('1');
  });

  test('an archived Tracker leaves the main list and its history intact', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Snack',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.toggleArchived();

    const list = new TrackersPageObject(appPage);
    await list.open();

    await expect(list.list.row(trackerId).self).toHaveCount(0);
    await list.expandArchived();
    await expect(list.archivedList.row(trackerId).archivedBadge).toBeVisible();
    await expect(list.archivedList.row(trackerId).version).toHaveText(/1/);
  });

  test('an archived Tracker can be brought back', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Snack',
      fields: [{ name: 'Satisfaction', dataType: 'integer' }],
    });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.toggleArchived();
    await designer.toggleArchived();

    const list = new TrackersPageObject(appPage);
    await list.open();

    await expect(list.list.row(trackerId).self).toBeVisible();
  });
});

test.describe('Draft validation', { tag: '@integration-candidate' }, () => {
  test('a Field with no name blocks the commit', async ({ appPage }) => {
    await createTracker(appPage, { name: 'Sleep', fields: [], commit: false });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.addField();

    await expect(designer.problems).toBeVisible();
    await expect(designer.commitButton).toBeDisabled();
  });

  test('two Fields with the same name block the commit', async ({ appPage }) => {
    await createTracker(appPage, { name: 'Sleep', fields: [], commit: false });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.addField();
    await designer.field(0).setName('Satisfaction');
    await designer.addField();
    await designer.field(1).setName('satisfaction');

    await expect(designer.problems).toContainText('already used');
    await expect(designer.commitButton).toBeDisabled();
  });

  test('a select Field with no options blocks the commit', async ({ appPage }) => {
    await createTracker(appPage, { name: 'Sleep', fields: [], commit: false });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.addField();
    const row = designer.field(0);
    await row.setName('Energy');
    await row.dataType.choose('singleSelect');

    await expect(designer.problems).toContainText('at least one option');
    await expect(designer.commitButton).toBeDisabled();
  });

  test('Fields are reorderable without a pointer', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [
        { name: 'Satisfaction', dataType: 'integer' },
        { name: 'Energy', dataType: 'text' },
      ],
    });

    const designer = new TrackerDesignerPageObject(appPage);
    await designer.fields.row('1').moveUp();

    await expect(designer.field(0).nameInput).toHaveValue('Energy');
    await expect(designer.field(1).nameInput).toHaveValue('Satisfaction');
  });
});
