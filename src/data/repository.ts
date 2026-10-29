import { browser } from 'wxt/browser';
import type { RuntimeResult } from '@/types/messages';
import type { DbCommand } from './commands';
import { DB_KEY } from './keys';
import type { AnexoDb } from './schema';

export async function fetchDbSnapshot(): Promise<AnexoDb> {
  const response = (await browser.runtime.sendMessage({ type: 'db:snapshot' })) as
    | RuntimeResult<AnexoDb>
    | undefined;
  if (!response?.ok) throw new Error(response?.error ?? 'Anexo background did not respond');
  return response.data;
}

export async function dispatchDbCommand(command: DbCommand): Promise<AnexoDb> {
  const response = (await browser.runtime.sendMessage({ type: 'db:command', command })) as
    | RuntimeResult<AnexoDb>
    | undefined;
  if (!response?.ok) throw new Error(response?.error ?? 'Anexo command failed');
  return response.data;
}

export function watchDb(listener: (db: AnexoDb) => void): () => void {
  const handler = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    areaName: string,
  ) => {
    if (areaName !== 'local') return;
    const change = changes[DB_KEY];
    if (!change?.newValue) return;
    listener(change.newValue as AnexoDb);
  };

  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}
