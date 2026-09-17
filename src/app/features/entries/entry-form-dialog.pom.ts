import type { Locator, Page } from '@playwright/test';
import { ModalObject } from '../../ui/components/modal/modal.pom';
import { SelectObject } from '../../ui/components/select/select.pom';
import { EntryNodeEditorObject } from './entry-node-editor.pom';
import { PlacementEditorObject } from './placement-editor.pom';

export interface NewEntryOptions {
  readonly trackerId: string;
  readonly presetId?: string;
  /** ISO instant the new Entry starts at. */
  readonly at?: string;
  readonly mode?: 'point' | 'period' | 'dayBucketed';
}

export class EntryFormDialogObject {
  private readonly modal: ModalObject;

  constructor(private readonly page: Page) {
    this.modal = new ModalObject(page.getByTestId('modal'));
  }

  /**
   * The form is a URL in the shell's `modal` outlet, so it can be opened directly — the
   * same way the Calendar opens it.
   */
  async openNew(options: NewEntryOptions): Promise<void> {
    const query = new URLSearchParams({ trackerId: options.trackerId });
    if (options.presetId !== undefined) query.set('presetId', options.presetId);
    if (options.at !== undefined) query.set('at', options.at);
    if (options.mode !== undefined) query.set('mode', options.mode);
    await this.page.goto(`/calendar(modal:entry/new)?${query.toString()}`);
    await this.form.waitFor();
  }

  async openSaved(entryId: string): Promise<void> {
    await this.page.goto(`/calendar(modal:entry/${entryId})`);
    await this.form.waitFor();
  }

  get form(): Locator {
    return this.modal.body.getByTestId('entry-form');
  }

  get title(): Locator {
    return this.modal.title;
  }

  get self(): Locator {
    return this.modal.self;
  }

  get versionLabel(): Locator {
    return this.form.getByTestId('version-label');
  }

  get versionExplanation(): Locator {
    return this.form.getByTestId('version-explanation');
  }

  get preset(): SelectObject {
    return new SelectObject(this.form.getByTestId('preset'));
  }

  get placement(): PlacementEditorObject {
    return PlacementEditorObject.within(this.form);
  }

  get entry(): EntryNodeEditorObject {
    return new EntryNodeEditorObject(this.form.getByTestId('entry-root'));
  }

  /** Embedded children in document order: each child comes before its own children. */
  child(index: number): EntryNodeEditorObject {
    return new EntryNodeEditorObject(
      this.form.getByTestId('children').getByTestId('entry-node').nth(index),
    );
  }

  get children(): Locator {
    return this.form.getByTestId('children').getByTestId('entry-node');
  }

  get problemsSummary(): Locator {
    return this.form.getByTestId('form-problems');
  }

  get saveButton(): Locator {
    return this.modal.actions.getByTestId('save');
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.modal.self.waitFor({ state: 'detached' });
  }

  async cancel(): Promise<void> {
    await this.modal.actions.getByTestId('cancel').click();
    await this.modal.self.waitFor({ state: 'detached' });
  }

  async delete(): Promise<void> {
    await this.modal.actions.getByTestId('delete-entry').click();
    await this.modal.self.waitFor({ state: 'detached' });
  }
}
