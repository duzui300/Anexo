import { browser } from 'wxt/browser';
import { SECRETS_IDB_NAME, SECRETS_IDB_STORE, SESSION_SECRET_KEY } from '@/data/keys';

const API_KEY_ENTRY = 'aiApiKey';

function openSecretsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SECRETS_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SECRETS_IDB_STORE)) {
        db.createObjectStore(SECRETS_IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the secrets store'));
    request.onblocked = () => reject(new Error('The secrets store is blocked by another tab'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openSecretsDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(SECRETS_IDB_STORE, mode);
      const request = run(transaction.objectStore(SECRETS_IDB_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Secrets store request failed'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Secrets transaction failed'));
    });
  } finally {
    db.close();
  }
}

async function readDeviceKey(): Promise<string | null> {
  try {
    const value = await withStore<unknown>('readonly', (store) => store.get(API_KEY_ENTRY));
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

async function writeDeviceKey(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.put(key, API_KEY_ENTRY));
}

async function deleteDeviceKey(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(API_KEY_ENTRY));
}

export type KeyStorage = 'device' | 'session';

export async function saveApiKey(key: string, storage: KeyStorage): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error('API key cannot be empty');

  if (storage === 'session') {
    await browser.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
    await browser.storage.session.set({ [SESSION_SECRET_KEY]: trimmed });
    await deleteDeviceKey().catch(() => {});
    return;
  }

  await writeDeviceKey(trimmed);
  await browser.storage.session.remove(SESSION_SECRET_KEY).catch(() => {});
}

export async function getApiKey(storage: KeyStorage): Promise<string | null> {
  if (storage === 'session') {
    try {
      const result = await browser.storage.session.get(SESSION_SECRET_KEY);
      const value = result[SESSION_SECRET_KEY];
      return typeof value === 'string' && value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }
  return readDeviceKey();
}

export async function hasApiKey(storage: KeyStorage): Promise<boolean> {
  return (await getApiKey(storage)) !== null;
}

export async function clearApiKey(): Promise<void> {
  await deleteDeviceKey().catch(() => {});
  await browser.storage.session.remove(SESSION_SECRET_KEY).catch(() => {});
}

export function apiKeyHint(key: string): string {
  return key.trim().slice(-4);
}
