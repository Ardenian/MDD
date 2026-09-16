import { test as base, type Page } from '@playwright/test';

/** Must match `BrowserIdbEngine`'s database name. */
const DATABASE_NAME = 'diary-calendar';
const BLANK_URL = '/__test-blank';

/**
 * Gives every test an empty IndexedDB. The database is dropped from a blank same-origin
 * page *before* the app ever boots — deleting it while the app holds an open connection
 * would block until the tab closed.
 *
 * This is the one sanctioned place for raw Playwright calls: specs and Flows go through
 * Page Object Models only (ADR 0012).
 */
async function resetLocalDatabase(page: Page): Promise<void> {
  await page.route(BLANK_URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>blank</title>' }),
  );
  await page.goto(BLANK_URL);
  await page.evaluate(
    (name) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      }),
    DATABASE_NAME,
  );
  await page.unroute(BLANK_URL);
}

export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await resetLocalDatabase(page);
    await page.goto('/');
    await use(page);
  },
});

export { expect } from '@playwright/test';
