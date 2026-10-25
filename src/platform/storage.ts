import { browser } from 'wxt/browser';

export async function getLocal<T>(key: string): Promise<T | undefined> {
  const result = await browser.storage.local.get(key);
  return result[key] as T | undefined;
}

export async function setLocal(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function removeLocal(keys: string | string[]): Promise<void> {
  await browser.storage.local.remove(keys);
}

export async function getLocalBytesInUse(): Promise<number> {
  return browser.storage.local.getBytesInUse(null);
}

export const STORAGE_PREFIX = 'anexo:';
