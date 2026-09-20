import { EXPORT_FORMAT_VERSION } from '../../../src/app/data/model/export-bundle';
import { DataTransferPageObject } from '../../../src/app/features/data-transfer/data-transfer-page.pom';
import { SettingsPageObject } from '../../../src/app/features/settings/settings-page.pom';
import { TrackersPageObject } from '../../../src/app/features/trackers/trackers-page.pom';
import { expect, test } from '../../../src/app/testing/support/app-fixture';
import { createTracker } from '../../flows/create-tracker.flow';

test.describe('Data Transfer', () => {
  test('exports the whole dataset as one file named after today', async ({ appPage }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });

    const transfer = new DataTransferPageObject(appPage);
    await transfer.open();
    const download = await transfer.export();

    expect(download.suggestedFilename()).toMatch(/^diary-calendar-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test('an exported file carries every aggregate and the Settings, but not the Profile', async ({
    appPage,
  }) => {
    await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });

    const transfer = new DataTransferPageObject(appPage);
    await transfer.open();
    const bundle = await transfer.exportBundle();

    expect(bundle['formatVersion']).toBe(EXPORT_FORMAT_VERSION);
    expect(bundle['trackers']).toHaveLength(1);
    expect(bundle['trackerVersions']).toHaveLength(1);
    // The Storage Profile is device-local and never leaves it (ADR 0009).
    expect(bundle['settings']).not.toHaveProperty('activeProfileId');
  });

  test('exported data comes back after the local data is cleared', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'singleSelect', options: ['low', 'high'] }],
    });

    const transfer = new DataTransferPageObject(appPage);
    await transfer.open();
    const bundle = await transfer.exportBundle();

    const settings = new SettingsPageObject(appPage);
    await settings.open();
    await settings.clearLocalDataAndConfirm('clear');

    const trackers = new TrackersPageObject(appPage);
    await trackers.open();
    await expect(trackers.emptyMessage).toBeVisible();

    await transfer.open();
    await transfer.chooseFile('backup.json', JSON.stringify(bundle));
    await transfer.completeImport('replace');

    await trackers.open();
    await expect(trackers.list.row(trackerId).name).toHaveText('Sleep');
  });

  test('the confirmation shows what is about to be discarded', async ({ appPage }) => {
    await createTracker(appPage, { name: 'Sleep', fields: [{ name: 'Energy', dataType: 'text' }] });

    const transfer = new DataTransferPageObject(appPage);
    await transfer.open();
    const bundle = await transfer.exportBundle();

    await transfer.chooseFile('backup.json', JSON.stringify(bundle));
    const dialog = await transfer.startImport();

    await expect(dialog.detail('trackers')).toHaveText('1');
    await expect(dialog.detail('trackerVersions')).toHaveText('1');
    // Nothing happens until the phrase is typed out.
    await expect(dialog.confirmButton).toBeDisabled();
    await dialog.cancel();
  });

  test('a file from another format version is refused at selection time', async ({ appPage }) => {
    const trackerId = await createTracker(appPage, {
      name: 'Sleep',
      fields: [{ name: 'Energy', dataType: 'text' }],
    });

    const transfer = new DataTransferPageObject(appPage);
    await transfer.open();
    const older = JSON.stringify({
      formatVersion: 0,
      exportedAt: '2026-01-01T00:00:00.000Z',
      trackers: [],
      trackerVersions: [],
      entries: [],
      presets: [],
      tags: [],
      settings: {},
    });

    await transfer.chooseFile('old-export.json', older);

    await expect(transfer.importError).toBeVisible();
    await expect(transfer.selectedFile).toHaveCount(0);
    // The confirmation is never reachable, so nothing can be touched.
    await expect(transfer.importButton).toBeDisabled();

    const trackers = new TrackersPageObject(appPage);
    await trackers.open();
    await expect(trackers.list.row(trackerId).name).toHaveText('Sleep');
  });
});
