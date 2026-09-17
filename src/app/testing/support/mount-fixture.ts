import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Mounts one component in the ADR 0014 gallery, in place of booting the whole app. */
export interface MountHarness {
  /**
   * `scenarioId` is `<file>#<export>`, e.g. `results-table.scenario.ts#ranked`. Inputs
   * given here are merged over the scenario's own.
   */
  mount(scenarioId: string, inputs?: Readonly<Record<string, unknown>>): Promise<void>;
  unmount(): Promise<void>;
}

/**
 * The integration-test fixture: a page serving the gallery, and a harness to mount
 * scenarios into it. `page.evaluate` lives here and only here — specs and Flows drive
 * through Page Object Models (ADR 0012).
 */
export const test = base.extend<{ mountPage: Page; harness: MountHarness }>({
  mountPage: async ({ page }, use) => {
    await page.goto('/');
    // The harness announces itself once `window.mount` is installed.
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
    await use(page);
  },

  harness: async ({ mountPage }, use) => {
    await use({
      mount: (scenarioId, inputs) =>
        mountPage.evaluate(
          ([id, values]) =>
            window.mount({
              scenario: id as string,
              inputs: values as Record<string, unknown> | undefined,
            }),
          [scenarioId, inputs] as const,
        ),
      unmount: () => mountPage.evaluate(() => window.unmount()),
    });
    await mountPage.evaluate(() => window.unmount());
  },
});

export { expect } from '@playwright/test';
