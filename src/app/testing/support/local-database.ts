import type { Page } from '@playwright/test';
import type { Entry } from '../../data/model/entry';

/** Must match `BrowserIdbEngine`'s database name. */
const DATABASE_NAME = 'diary-calendar';

/**
 * Reads what the app actually persisted, to assert on it — never to set anything up.
 * Needed while no screen lists saved Entries (the Calendar arrives in a later phase).
 * Raw `page.evaluate` is allowed here and only here: specs and Flows go through Page
 * Object Models (ADR 0012).
 */
export async function readEntries(page: Page): Promise<readonly Entry[]> {
  return page.evaluate(
    (name) =>
      new Promise<Entry[]>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const request = database
            .transaction('entries', 'readonly')
            .objectStore('entries')
            .getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            database.close();
            resolve(request.result as Entry[]);
          };
        };
      }),
    DATABASE_NAME,
  );
}

export async function readLiveEntries(page: Page): Promise<readonly Entry[]> {
  return (await readEntries(page)).filter((entry) => entry.deletedAt === null);
}
