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

    await expect(settings.correlation.bucketSize.option('week')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(settings.correlation.lagMin).toHaveValue('-7');
    await expect(settings.correlation.lagMax).toHaveValue('7');
    await expect(settings.correlation.minSampleSize).toHaveValue('25');
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

    await expect(settings.storageProfile.option('offline')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('clearing local data empties the app after a confirmation', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });

    const settings = new SettingsPageObject(appPage);
    await settings.open();
    const dialog = await settings.clearLocalData();

    await expect(dialog.detail('trackers')).toHaveText('1');
    await expect(dialog.detail('trackerVersions')).toHaveText('1');
    // The phrase has to be typed out before the button does anything.
    await expect(dialog.confirmButton).toBeDisabled();

    await dialog.type('clear');
    await expect(dialog.confirmButton).toBeEnabled();
    // Clearing reloads the app; the next navigation must not race it.
    await Promise.all([appPage.waitForEvent('load'), dialog.confirm()]);

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
