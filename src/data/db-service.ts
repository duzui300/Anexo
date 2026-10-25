import { browser } from 'wxt/browser';
import { log } from '@/platform/logger';
import { applyCommand, type DbCommand } from './commands';
import { createDefaultDb } from './defaults';
import { BACKUP_PREFIX, DB_KEY, MAX_BACKUPS } from './keys';
import { normalizeDb } from './migrations';
import type { AnexoDb } from './schema';

let cached: AnexoDb | null = null;
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readStored(): Promise<AnexoDb> {
  const stored = await browser.storage.local.get(DB_KEY);
  const raw = stored[DB_KEY];
  try {
    return normalizeDb(raw) ?? createDefaultDb();
  } catch (error) {
    log.error('Stored Anexo data could not be read; preserving a backup and starting clean', error);
    await backupRaw(raw);
    return createDefaultDb();
  }
}

async function backupRaw(raw: unknown): Promise<void> {
  if (raw === undefined) return;
  try {
    await browser.storage.local.set({ [`${BACKUP_PREFIX}${Date.now()}`]: raw });
    await pruneBackups();
  } catch (error) {
    log.error('Failed to write Anexo backup', error);
  }
}

async function pruneBackups(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all)
    .filter((key) => key.startsWith(BACKUP_PREFIX))
    .sort();
  const excess = keys.slice(0, Math.max(0, keys.length - MAX_BACKUPS));
  if (excess.length > 0) await browser.storage.local.remove(excess);
}

export async function initDb(): Promise<AnexoDb> {
  return enqueue(async () => {
    const db = await readStored();
    const stored = await browser.storage.local.get(DB_KEY);
    if (stored[DB_KEY] === undefined) {
      await browser.storage.local.set({ [DB_KEY]: db });
    }
    cached = db;
    return db;
  });
}

export async function getDb(): Promise<AnexoDb> {
  if (cached) return cached;
  return initDb();
}

export async function dispatchCommand(command: DbCommand): Promise<AnexoDb> {
  return enqueue(async () => {
    const current = cached ?? (await readStored());
    const next = applyCommand(current, command);
    next.revision = current.revision + 1;
    next.updatedAt = Date.now();
    await browser.storage.local.set({ [DB_KEY]: next });
    cached = next;
    return next;
  });
}

/** Test-only: reset the in-memory cache so a fresh storage read happens. */
export function resetDbCache(): void {
  cached = null;
}
