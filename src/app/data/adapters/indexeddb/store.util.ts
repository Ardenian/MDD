import { openDatabase, promisifyRequest, runTransaction, type StoreName } from './database';

export async function getRecord<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase();
  return runTransaction(db, [store], 'readonly', (tx) =>
    promisifyRequest(tx.objectStore(store).get(key)) as Promise<T | undefined>,
  );
}

export async function getAllRecords<T>(store: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return runTransaction(db, [store], 'readonly', (tx) =>
    promisifyRequest(tx.objectStore(store).getAll()) as Promise<T[]>,
  );
}

export async function putRecord<T>(store: StoreName, record: T): Promise<T> {
  const db = await openDatabase();
  await runTransaction(db, [store], 'readwrite', (tx) => promisifyRequest(tx.objectStore(store).put(record)));
  return record;
}

export async function deleteRecord(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDatabase();
  await runTransaction(db, [store], 'readwrite', (tx) => promisifyRequest(tx.objectStore(store).delete(key)));
}

export async function getAllByIndex<T>(
  store: StoreName,
  index: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const db = await openDatabase();
  return runTransaction(db, [store], 'readonly', (tx) =>
    promisifyRequest(tx.objectStore(store).index(index).getAll(query)) as Promise<T[]>,
  );
}

export async function getByIndex<T>(
  store: StoreName,
  index: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T | undefined> {
  const db = await openDatabase();
  return runTransaction(db, [store], 'readonly', (tx) =>
    promisifyRequest(tx.objectStore(store).index(index).get(query)) as Promise<T | undefined>,
  );
}

export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDatabase();
  await runTransaction(db, [store], 'readwrite', (tx) => promisifyRequest(tx.objectStore(store).clear()));
}
