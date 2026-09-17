import type { Locator } from '@playwright/test';

export class MultiselectObject {
  constructor(private readonly root: Locator) {}

  static within(scope: Locator, testId = 'multiselect'): MultiselectObject {
    return new MultiselectObject(scope.getByTestId(testId));
  }

  get self(): Locator {
    return this.root;
  }

  /**
   * Assert selection through this Locator with a web-first assertion —
   * `await expect(multiselect.option('sleep')).toHaveAttribute('aria-selected', 'true')`.
   * A one-shot boolean read cannot retry, so it races anything that renders a default
   * first and the persisted value a moment later.
   */
  option(value: string): Locator {
    return this.root.getByTestId(value);
  }

  async toggle(value: string): Promise<void> {
    await this.option(value).click();
  }
}
