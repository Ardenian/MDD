import type { Locator } from '@playwright/test';
import { ValueNodeEditorObject } from '../../ui/components/value-node-editor/value-node-editor.pom';

export class PresetEditorObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  async setName(name: string): Promise<void> {
    await this.root.getByTestId('preset-name-input').fill(name);
  }

  get nameError(): Locator {
    return this.root.getByTestId('name-error');
  }

  get preset(): ValueNodeEditorObject {
    return new ValueNodeEditorObject(this.root.getByTestId('preset-root'));
  }

  /** Filled children in document order: each child comes before its own children. */
  child(index: number): ValueNodeEditorObject {
    return new ValueNodeEditorObject(
      this.root.getByTestId('children').getByTestId('preset-node').nth(index),
    );
  }

  get problems(): Locator {
    return this.root.getByTestId('preset-problems');
  }

  get saveButton(): Locator {
    return this.root.getByTestId('save-preset');
  }

  /** The editor closes only once the Preset is persisted, so this waits for the write. */
  async save(): Promise<void> {
    await this.saveButton.click();
    await this.root.waitFor({ state: 'detached' });
  }

  async cancel(): Promise<void> {
    await this.root.getByTestId('cancel-preset').click();
    await this.root.waitFor({ state: 'detached' });
  }
}
