import { expect, test } from '../../testing/support/mount-fixture';
import { DataTransferPageObject } from './data-transfer-page.pom';

/**
 * Refusing an unusable file happens at selection time, before any data is touched, so it
 * needs neither a database nor an app boot (ADR 0011, ADR 0014).
 */
test.describe('Import file rejection', () => {
  test.beforeEach(async ({ harness }) => {
    await harness.mount('data-transfer-page.scenario.ts#empty');
  });

  test('a file that is not an export at all is refused', async ({ mountPage }) => {
    const transfer = new DataTransferPageObject(mountPage);

    await transfer.chooseFile('notes.json', 'this is not JSON');

    await expect(transfer.importError).toBeVisible();
    await expect(transfer.importButton).toBeDisabled();
  });

  test('a file from another format version names the version it found', async ({ mountPage }) => {
    const transfer = new DataTransferPageObject(mountPage);

    await transfer.chooseFile(
      'old-export.json',
      JSON.stringify({
        formatVersion: 0,
        exportedAt: '2026-01-01T00:00:00.000Z',
        trackers: [],
        trackerVersions: [],
        entries: [],
        presets: [],
        tags: [],
        settings: {},
      }),
    );

    await expect(transfer.importError).toContainText('0');
    // Nothing is selected, so the confirmation cannot be reached at all.
    await expect(transfer.selectedFile).toHaveCount(0);
    await expect(transfer.importButton).toBeDisabled();
  });
});
