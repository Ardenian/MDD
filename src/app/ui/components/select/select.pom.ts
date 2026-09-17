import type { Locator } from '@playwright/test';

/**
 * An option's `data-testid` is its own value, which is unique inside this select's
 * scope — collisions across selects are resolved by nesting, never by namespacing
 * the id (ADR 0012).
 */
export class SelectObject {
  constructor(private readonly root: Locator) {}

  static within(scope: Locator, testId = 'select'): SelectObject {
    return new SelectObject(scope.getByTestId(testId));
  }

  get self(): Locator {
    return this.root;
  }

  /**
   * Assert selection through this Locator with a web-first assertion —
   * `await expect(select.option('week')).toHaveAttribute('aria-selected', 'true')`.
   * A one-shot boolean read cannot retry, so it races anything that renders a default
   * first and the persisted value a moment later.
   */
  option(value: string): Locator {
    return this.root.getByTestId(value);
  }

  async choose(value: string): Promise<void> {
    await this.option(value).click();
  }
}
