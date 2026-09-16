import type { Locator } from '@playwright/test';

export class MultiselectObject {
  constructor(private readonly root: Locator) {}

  static within(scope: Locator, testId = 'multiselect'): MultiselectObject {
    return new MultiselectObject(scope.getByTestId(testId));
  }

  get self(): Locator {
    return this.root;
  }

  option(value: string): Locator {
    return this.root.getByTestId(value);
  }

  async toggle(value: string): Promise<void> {
    await this.option(value).click();
  }

  async isSelected(value: string): Promise<boolean> {
    return (await this.option(value).getAttribute('aria-selected')) === 'true';
  }
}
