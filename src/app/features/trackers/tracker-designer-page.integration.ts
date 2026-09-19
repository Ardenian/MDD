import { expect, test } from '../../testing/support/mount-fixture';
import { TrackerDesignerPageObject } from './tracker-designer-page.pom';

/**
 * Draft validation and keyboard reordering are UI-only concerns: they need the designer
 * on screen with a Tracker to edit, not an app boot (ADR 0011, ADR 0014).
 */
test.describe('Draft validation', () => {
  test.beforeEach(async ({ harness }) => {
    await harness.mount('tracker-designer-page.scenario.ts#emptyDraft');
  });

  test('a Field with no name blocks the commit', async ({ mountPage }) => {
    const designer = new TrackerDesignerPageObject(mountPage);

    await designer.addField();

    await expect(designer.problems).toBeVisible();
    await expect(designer.commitButton).toBeDisabled();
  });

  test('two Fields with the same name block the commit', async ({ mountPage }) => {
    const designer = new TrackerDesignerPageObject(mountPage);

    await designer.addField();
    await designer.field(0).setName('Satisfaction');
    await designer.addField();
    await designer.field(1).setName('satisfaction');

    await expect(designer.problems).toContainText('already used');
    await expect(designer.commitButton).toBeDisabled();
  });

  test('a select Field with no options blocks the commit', async ({ mountPage }) => {
    const designer = new TrackerDesignerPageObject(mountPage);

    await designer.addField();
    const row = designer.field(0);
    await row.setName('Energy');
    await row.dataType.choose('singleSelect');

    await expect(designer.problems).toContainText('at least one option');
    await expect(designer.commitButton).toBeDisabled();
  });
});

test.describe('Draft reordering', () => {
  test('Fields are reorderable without a pointer', async ({ harness, mountPage }) => {
    await harness.mount('tracker-designer-page.scenario.ts#twoFields');
    const designer = new TrackerDesignerPageObject(mountPage);

    await designer.fields.row('1').moveUp();

    await expect(designer.field(0).nameInput).toHaveValue('Energy');
    await expect(designer.field(1).nameInput).toHaveValue('Satisfaction');
  });
});
