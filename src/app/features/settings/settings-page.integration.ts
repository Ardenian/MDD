import { expect, test } from '../../testing/support/mount-fixture';
import { SettingsPageObject } from './settings-page.pom';

/**
 * Form validation needs the controls on screen and nothing else, so these run against
 * the mounted page with in-memory ports rather than the whole app (ADR 0011, ADR 0014).
 */
test.describe('Settings validation', () => {
  test.beforeEach(async ({ harness }) => {
    await harness.mount('settings-page.scenario.ts#defaults');
  });

  test('an inverted Lag range blocks saving until it is fixed', async ({ mountPage }) => {
    const settings = new SettingsPageObject(mountPage);

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

  test('an expansion-depth cap below 1 is rejected', async ({ mountPage }) => {
    const settings = new SettingsPageObject(mountPage);

    await settings.expansionDepthCap.fill('0');

    await expect(settings.expansionDepthCapError).toBeVisible();
    await expect(settings.saveButton).toBeDisabled();
  });

  test('a p-value threshold outside 0..1 is rejected', async ({ mountPage }) => {
    const settings = new SettingsPageObject(mountPage);

    await settings.correlation.pThreshold.fill('2');

    await expect(settings.correlation.pThresholdError).toBeVisible();
    await expect(settings.saveButton).toBeDisabled();
  });
});
