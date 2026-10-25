import { normalizeDb } from './migrations';
import type { AnexoDb } from './schema';

export function serializeDb(db: AnexoDb): string {
  return JSON.stringify(
    {
      app: 'anexo',
      exportedAt: new Date().toISOString(),
      schemaVersion: db.schemaVersion,
      db,
    },
    null,
    2,
  );
}

export function parseDbFile(text: string): AnexoDb {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON');
  }

  const candidate =
    parsed !== null && typeof parsed === 'object' && 'db' in parsed
      ? (parsed as { db: unknown }).db
      : parsed;

  const db = normalizeDb(candidate);
  if (!db) throw new Error('The selected file contains no Anexo data');
  return db;
}

export function exportFileName(prefix = 'anexo-backup'): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${date}.json`;
}

export function downloadBlob(filename: string, data: string | Uint8Array, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  downloadBlob(filename, text, mime);
}
