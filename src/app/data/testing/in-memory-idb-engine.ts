import type { IdbEngine, StoreName } from '../adapters/indexeddb/idb-engine';

/**
 * Stands in for `BrowserIdbEngine` so the real repositories can be exercised without a
 * database. Values are structurally cloned on the way in and out, matching IndexedDB's
 * copy semantics — a test that mutates what it stored must not see that mutation come
 * back out.
 */
export class InMemoryIdbEngine implements IdbEngine {
  private readonly stores = new Map<StoreName, Map<string, unknown>>();

  async getAll<T>(store: StoreName): Promise<readonly T[]> {
    return [...this.storeOf(store).values()].map((value) => structuredClone(value) as T);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const value = this.storeOf(store).get(key);
    return value === undefined ? undefined : (structuredClone(value) as T);
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    this.storeOf(store).set(key, structuredClone(value));
  }

  async putAll<T>(
    store: StoreName,
    records: readonly (readonly [key: string, value: T])[],
  ): Promise<void> {
    for (const [key, value] of records) {
      this.storeOf(store).set(key, structuredClone(value));
    }
  }

  async delete(store: StoreName, key: string): Promise<void> {
    this.storeOf(store).delete(key);
  }

  async clear(store: StoreName): Promise<void> {
    this.storeOf(store).clear();
  }

  private storeOf(store: StoreName): Map<string, unknown> {
    let existing = this.stores.get(store);
    if (!existing) {
      existing = new Map<string, unknown>();
      this.stores.set(store, existing);
    }
    return existing;
  }
}
