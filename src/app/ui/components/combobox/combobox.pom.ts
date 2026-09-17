import type { Locator } from '@playwright/test';

export class ComboboxObject {
  constructor(private readonly root: Locator) {}

  get input(): Locator {
    return this.root.getByTestId('input');
  }

  chip(value: string): Locator {
    return this.root.getByTestId('chips').getByTestId(value);
  }

  suggestion(value: string): Locator {
    return this.root.getByTestId('suggestions').getByTestId(value);
  }

  async add(value: string): Promise<void> {
    await this.input.fill(value);
    await this.input.press('Enter');
  }

  async pickSuggestion(typed: string, value: string): Promise<void> {
    await this.input.fill(typed);
    await this.suggestion(value).click();
  }

  async remove(value: string): Promise<void> {
    await this.chip(value).getByTestId('remove').click();
  }
}
