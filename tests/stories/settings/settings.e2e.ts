import { EntryFormDialogObject } from '../../../src/app/features/entries/entry-form-dialog.pom';
import { SettingsPageObject } from '../../../src/app/features/settings/settings-page.pom';
import { TrackersPageObject } from '../../../src/app/features/trackers/trackers-page.pom';
import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { createTracker } from '../../flows/create-tracker.flow';

test.describe('Settings', () => {
  test('Correlation defaults survive a reload', async ({ appPage }) => {
    const settings = new SettingsPageObject(appPage);
    await settings.open();

    await settings.correlation.bucketSize.choose('week');
    await settings.correlation.lagMin.fill('-7');
    await settings.correlation.lagMax.fill('7');
    await settings.correlation.minSampleSize.fill('25');
    await settings.save();
    await settings.waitForSavedBucketSize('week');

    await settings.reload();

    expect(await settings.correlation.bucketSize.isSelected('week')).toBe(true);
    await expect(settings.correlation.lagMin).toHaveValue('-7');
    await expect(settings.correlation.lagMax).toHaveValue('7');
    await expect(settings.correlation.minSampleSize).toHaveValue('25');
  });

  test('@integration-candidate an inverted Lag range blocks saving until it is fixed', async ({
    appPage,
  }) => {
    const settings = new SettingsPageObject(appPage);
    await settings.open();

    await settings.correlation.lagMin.fill('4');
    await settings.correlation.lagMax.fill('1');

    await expect(settings.correlation.lagRangeError).toBeVisible();
    await expect(settings.saveButton).toBeDisabled();
    await expect(settings.blocked).toBeVisible();

    await settings.correlation.lagMax.fill('4');

    // A zero-width range is legitimate: it scans Lag 0 only.
    await expect(settings.correlation.lagRangeError).toHaveCount(0);
    await expect(settings.saveButton).toBeEnabled();
  });

  test('@integration-candidate an expansion-depth cap below 1 is rejected', async ({ appPage }) => {
    const settings = new SettingsPageObject(appPage);
    await settings.open();

    await settings.expansionDepthCap.fill('0');

    await expect(settings.expansionDepthCapError).toBeVisible();
    await expect(settings.saveButton).toBeDisabled();
  });

  test('lowering the expansion-depth cap stops the Entry form nesting deeper', async ({
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

    const settings = new SettingsPageObject(appPage);
    await settings.open();
    await settings.expansionDepthCap.fill('1');
    await settings.save();
    await settings.waitForSavedCap(1);

    // The cap is read afresh every time a form opens, so no reload is needed.
    const form = new EntryFormDialogObject(appPage);
    await form.openNew({ trackerId: mealId });

    await expect(form.entry.reference('Ingredients').capReached).toBeVisible();
    await expect(form.entry.reference('Ingredients').addButton).toBeDisabled();
  });

  test('the Storage Profile section names Offline as the active Profile', async ({ appPage }) => {
    const settings = new SettingsPageObject(appPage);
    await settings.open();

    expect(await settings.storageProfile.isSelected('offline')).toBe(true);
  });

  test('clearing local data empties the app after a confirmation', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });

    const settings = new SettingsPageObject(appPage);
    await settings.open();
    const dialog = await settings.clearLocalData();

    await expect(dialog.count('trackers')).toHaveText('1');
    await expect(dialog.count('trackerVersions')).toHaveText('1');
    // The phrase has to be typed out before the button does anything.
    await expect(dialog.confirmButton).toBeDisabled();

    await dialog.type('clear');
    await expect(dialog.confirmButton).toBeEnabled();
    await dialog.confirm();

    const trackers = new TrackersPageObject(appPage);
    await trackers.open();
    await expect(trackers.emptyMessage).toBeVisible();
  });

  test('cancelling the confirmation leaves the data alone', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'text' }],
    });

    const settings = new SettingsPageObject(appPage);
    await settings.open();
    const dialog = await settings.clearLocalData();
    await dialog.cancel();

    const trackers = new TrackersPageObject(appPage);
    await trackers.open();
    await expect(trackers.list.row(trackerId).name).toHaveText('Sleep');
  });
});
