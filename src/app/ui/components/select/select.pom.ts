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

  option(value: string): Locator {
    return this.root.getByTestId(value);
  }

  async choose(value: string): Promise<void> {
    await this.option(value).click();
  }

  /** Reads the option's own ARIA state — the locator stays `data-testid`-only. */
  async isSelected(value: string): Promise<boolean> {
    return (await this.option(value).getAttribute('aria-selected')) === 'true';
  }
}
