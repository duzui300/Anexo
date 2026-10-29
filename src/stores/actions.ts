import type { DbCommand } from '@/data/commands';
import { dispatchDbCommand } from '@/data/repository';
import type { AnexoDb, DeepPartial, LocalFlags, Settings } from '@/data/schema';
import { useDbStore } from './db-store';

export async function dispatchAndCommit(command: DbCommand): Promise<AnexoDb> {
  const next = await dispatchDbCommand(command);
  useDbStore.getState().setDb(next);
  return next;
}

async function commit(next: Awaited<ReturnType<typeof dispatchDbCommand>>): Promise<void> {
  useDbStore.getState().setDb(next);
}

export async function updateSettings(patch: DeepPartial<Settings>): Promise<void> {
  const next = await dispatchDbCommand({ kind: 'settings/patch', patch });
  await commit(next);
}

export async function updateFlags(patch: Partial<LocalFlags>): Promise<void> {
  const next = await dispatchDbCommand({ kind: 'flags/patch', patch });
  await commit(next);
}

export async function resetData(): Promise<void> {
  const next = await dispatchDbCommand({ kind: 'db/reset' });
  await commit(next);
}
