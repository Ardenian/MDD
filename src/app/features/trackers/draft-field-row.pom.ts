import type { Locator } from '@playwright/test';
import { SelectObject } from '../../ui/components/select/select.pom';

/** Scoped to one Field row, so `option-0` and friends are unambiguous per row. */
export class DraftFieldRowObject {
  constructor(private readonly root: Locator) {}

  get self(): Locator {
    return this.root;
  }

  async setName(name: string): Promise<void> {
    await this.root.getByTestId('field-name').fill(name);
    await this.root.getByTestId('field-name').blur();
  }

  /** A locator, not a read value, so assertions on it retry until the view settles. */
  get nameInput(): Locator {
    return this.root.getByTestId('field-name');
  }

  get dataType(): SelectObject {
    return SelectObject.within(this.root.getByTestId('field-type'));
  }

  async setRequired(required: boolean): Promise<void> {
    await this.root.getByTestId('field-required').setChecked(required);
  }

  async addOption(value: string): Promise<void> {
    const index = await this.root.getByTestId(/^option-\d+$/).count();
    await this.root.getByTestId('add-option').click();
    await this.setOption(index, value);
  }

  optionInput(index: number): Locator {
    return this.root.getByTestId(`option-${index}`);
  }

  async setOption(index: number, value: string): Promise<void> {
    await this.optionInput(index).fill(value);
    await this.optionInput(index).blur();
  }

  get referenceTarget(): SelectObject {
    return SelectObject.within(this.root.getByTestId('reference-target'));
  }

  get referenceCardinality(): SelectObject {
    return SelectObject.within(this.root.getByTestId('reference-cardinality'));
  }

  async remove(): Promise<void> {
    await this.root.getByTestId('remove-field').click();
  }
}
