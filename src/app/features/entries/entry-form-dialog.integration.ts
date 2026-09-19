import { expect, test } from '../../testing/support/mount-fixture';
import { EntryFormDialogObject } from './entry-form-dialog.pom';

/**
 * Form validation needs the form on screen and nothing else — no Calendar, no database,
 * no app boot (ADR 0011, ADR 0014).
 */
test.describe('Entry form validation', () => {
  test('a required Field blocks saving, with its error linked to the control', async ({
    harness,
    mountPage,
  }) => {
    await harness.mount('entry-form-dialog.scenario.ts#requiredField');
    const form = new EntryFormDialogObject(mountPage);

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

  test('a whole number is required for an integer Field', async ({ harness, mountPage }) => {
    await harness.mount('entry-form-dialog.scenario.ts#optionalFields');
    const form = new EntryFormDialogObject(mountPage);

    await form.entry.field('Satisfaction').fill('2.5');

    await expect(form.entry.field('Satisfaction').error).toBeVisible();
    await expect(form.saveButton).toBeDisabled();
  });

  test('a negative Fadeout blocks saving', async ({ harness, mountPage }) => {
    await harness.mount('entry-form-dialog.scenario.ts#optionalFields');
    const form = new EntryFormDialogObject(mountPage);

    await form.placement.setFadeout(-5, 0);

    await expect(form.placement.problem).toBeVisible();
    await expect(form.saveButton).toBeDisabled();
  });
});
