import { expect, test } from '../../testing/support/mount-fixture';
import { TrackerDesignerPageObject } from './tracker-designer-page.pom';

/**
 * The Preset editor lives inside the Tracker designer, so the scenario mounts the
 * designer and the test opens the editor from it — the same route the user takes.
 */
test.describe('Preset editor validation', () => {
  test('a Preset needs a name, but no required Field needs a value', async ({
    harness,
    mountPage,
  }) => {
    await harness.mount('tracker-designer-page.scenario.ts#requiredTextField');
    const presets = new TrackerDesignerPageObject(mountPage).presets;

    await presets.newPreset();
    await expect(presets.editor.nameError).toBeVisible();
    await expect(presets.editor.saveButton).toBeDisabled();

    await presets.editor.setName('Blank page');

    // A Preset is a partial pre-fill, so a required Field may be left empty.
    await expect(presets.editor.preset.field('Notes').error).toHaveCount(0);
    await expect(presets.editor.saveButton).toBeEnabled();
  });

  test('a filled value must still have the right shape', async ({ harness, mountPage }) => {
    await harness.mount('tracker-designer-page.scenario.ts#integerField');
    const presets = new TrackerDesignerPageObject(mountPage).presets;

    await presets.newPreset();
    await presets.editor.setName('Good night');
    await presets.editor.preset.field('Satisfaction').fill('2.5');

    await expect(presets.editor.preset.field('Satisfaction').error).toBeVisible();
    await expect(presets.editor.saveButton).toBeDisabled();
  });
});
