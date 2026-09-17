import type { Page } from '@playwright/test';
import { EntryFormDialogObject } from '../../src/app/features/entries/entry-form-dialog.pom';

export type EntryValueSpec =
  | { readonly field: string; readonly fill: string }
  | { readonly field: string; readonly choose: string }
  | { readonly field: string; readonly check: boolean };

export interface LogEntryOptions {
  readonly trackerId: string;
  readonly at?: string;
  readonly values?: readonly EntryValueSpec[];
  readonly tags?: readonly string[];
}

/** Logs one Entry through the Entry form and waits for the form to close (ADR 0013). */
export async function logEntry(page: Page, options: LogEntryOptions): Promise<void> {
  const form = new EntryFormDialogObject(page);
  await form.openNew({ trackerId: options.trackerId, at: options.at });

  for (const value of options.values ?? []) {
    const field = form.entry.field(value.field);
    if ('fill' in value) await field.fill(value.fill);
    if ('choose' in value) await field.select.choose(value.choose);
    if ('check' in value) await field.check(value.check);
  }
  for (const tag of options.tags ?? []) {
    await form.entry.tags.add(tag);
  }

  await form.save();
}
