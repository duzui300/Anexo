import { describe, expect, it } from 'vitest';
import { createDefaultDb, DEFAULT_SETTINGS } from '../../src/data/defaults';
import { DbTooNewError, normalizeDb } from '../../src/data/migrations';

describe('normalizeDb', () => {
  it('returns null when nothing is stored', () => {
    expect(normalizeDb(undefined)).toBeNull();
    expect(normalizeDb(null)).toBeNull();
  });

  it('migrates a partial v1 document and fills defaults', () => {
    const db = normalizeDb({
      schemaVersion: 1,
      revision: 4,
      folders: {},
      settings: { features: { sidebar: false } },
    });

    expect(db).not.toBeNull();
    expect(db?.revision).toBe(4);
    expect(db?.settings.features.sidebar).toBe(false);
    expect(db?.settings.features.timestamps).toBe(DEFAULT_SETTINGS.features.timestamps);
    expect(db?.settings.ui.railWidth).toBe(DEFAULT_SETTINGS.ui.railWidth);
    expect(db?.flags.welcomeSeen).toBe(false);
  });

  it('round-trips a default document', () => {
    const original = createDefaultDb(1234);
    const parsed = normalizeDb(original);
    expect(parsed).toEqual(original);
  });

  it('rejects documents from a newer schema', () => {
    expect(() => normalizeDb({ schemaVersion: 99 })).toThrow(DbTooNewError);
  });

  it('rejects non-object payloads', () => {
    expect(() => normalizeDb('nope')).toThrow(/not an object/);
  });

  it('rejects invalid folder data', () => {
    expect(() =>
      normalizeDb({
        schemaVersion: 1,
        folders: { x: { id: 'x', name: '', color: null, parentId: null, order: 0, createdAt: 1, updatedAt: 1 } },
      }),
    ).toThrow();
  });
});
