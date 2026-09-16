import { InjectionToken } from '@angular/core';
import { DataError } from '../../model/data-error';

export type StoreName =
  | 'trackers'
  | 'trackerVersions'
  | 'entries'
  | 'presets'
  | 'tags'
  | 'settings'
  | 'calendars';

export const STORE_NAMES: readonly StoreName[] = [
  'trackers',
  'trackerVersions',
  'entries',
  'presets',
  'tags',
  'settings',
  'calendars',
];

/**
 * The one seam between the repositories and physical storage. Every repository talks
 * only to this; `BrowserIdbEngine` is the sole code in the app that touches the
 * `indexedDB` global, so tests run the real repositories against an in-memory engine
 * instead of a database (see `data/testing/`).
 *
 * Deliberately key-value only: filtering and range math live in the repositories, in one
 * implementation, rather than being split between an index definition here and a
 * predicate there.
 */
export interface IdbEngine {
  getAll<T>(store: StoreName): Promise<readonly T[]>;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  putAll<T>(store: StoreName, records: readonly (readonly [key: string, value: T])[]): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
}

export const IDB_ENGINE = new InjectionToken<IdbEngine>('IdbEngine');

const DATABASE_NAME = 'diary-calendar';
/** Bumped only when the object-store set changes — unrelated to a Tracker Version. */
const DATABASE_VERSION = 1;

export class BrowserIdbEngine implements IdbEngine {
  private connection?: Promise<IDBDatabase>;

  async getAll<T>(store: StoreName): Promise<readonly T[]> {
    return this.run(store, 'readonly', (objectStore) => objectStore.getAll() as IDBRequest<T[]>);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.run(store, 'readonly', (objectStore) => objectStore.get(key) as IDBRequest<T | undefined>);
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    await this.run(store, 'readwrite', (objectStore) => objectStore.put(value, key));
  }

  async putAll<T>(
    store: StoreName,
    records: readonly (readonly [key: string, value: T])[],
  ): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      for (const [key, value] of records) {
        objectStore.put(value, key);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(toDataError(transaction.error));
      transaction.onabort = () => reject(toDataError(transaction.error));
    });
  }

  async delete(store: StoreName, key: string): Promise<void> {
    await this.run(store, 'readwrite', (objectStore) => objectStore.delete(key));
  }

  async clear(store: StoreName): Promise<void> {
    await this.run(store, 'readwrite', (objectStore) => objectStore.clear());
  }

  private async run<T>(
    store: StoreName,
    mode: IDBTransactionMode,
    operation: (objectStore: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(store, mode);
      const request = operation(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(toDataError(request.error));
      transaction.onabort = () => reject(toDataError(transaction.error));
    });
  }

  private open(): Promise<IDBDatabase> {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const store of STORE_NAMES) {
          if (!database.objectStoreNames.contains(store)) {
            database.createObjectStore(store);
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(toDataError(request.error));
      request.onblocked = () =>
        reject(new DataError('unavailable', 'The local database is blocked by another open tab'));
    });
    return this.connection;
  }
}

function toDataError(cause: DOMException | null): DataError {
  return new DataError('unavailable', cause?.message ?? 'The local database is unavailable', { cause });
}
