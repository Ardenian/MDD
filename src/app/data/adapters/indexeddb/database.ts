const DATABASE_NAME = 'diary-calendar';
const DATABASE_VERSION = 1;

/**
 * Object store names. Not to be confused with **Tracker Version** — that's an
 * application-level concept stored as ordinary rows in `trackerVersions`, unrelated to
 * this database's own internal `DATABASE_VERSION`.
 */
export const STORE = {
  trackers: 'trackers',
  trackerVersions: 'trackerVersions',
  entries: 'entries',
  presets: 'presets',
  tags: 'tags',
  settings: 'settings',
  calendar: 'calendar',
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

let databasePromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE.trackers)) {
        db.createObjectStore(STORE.trackers, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE.trackerVersions)) {
        const store = db.createObjectStore(STORE.trackerVersions, { keyPath: 'id' });
        store.createIndex('byTrackerAndVersion', ['trackerId', 'version'], { unique: true });
      }

      if (!db.objectStoreNames.contains(STORE.entries)) {
        const store = db.createObjectStore(STORE.entries, { keyPath: 'id' });
        store.createIndex('byTracker', 'trackerId');
        store.createIndex('byParent', 'parentEntryId');
      }

      if (!db.objectStoreNames.contains(STORE.presets)) {
        const store = db.createObjectStore(STORE.presets, { keyPath: 'id' });
        store.createIndex('byTracker', 'trackerId');
      }

      if (!db.objectStoreNames.contains(STORE.tags)) {
        db.createObjectStore(STORE.tags, { keyPath: 'text' });
      }

      if (!db.objectStoreNames.contains(STORE.settings)) {
        db.createObjectStore(STORE.settings, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE.calendar)) {
        db.createObjectStore(STORE.calendar, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function runTransaction<T>(
  db: IDBDatabase,
  stores: readonly StoreName[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const transaction = db.transaction(stores, mode);

  return new Promise((resolve, reject) => {
    let result: T;

    work(transaction)
      .then((value) => {
        result = value;
      })
      .catch((error: unknown) => {
        transaction.abort();
        reject(error as Error);
      });

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'));
  });
}

/** Only ever called by `MaintenancePort`'s adapter and test teardown. */
export async function deleteDatabase(): Promise<void> {
  databasePromise = null;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
