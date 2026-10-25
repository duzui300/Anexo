import { createDefaultDb, DEFAULT_FLAGS, DEFAULT_SETTINGS } from './defaults';
import { DbSchema, SCHEMA_VERSION, type AnexoDb } from './schema';

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  return value !== null && typeof value === 'object' ? (value as RawRecord) : {};
}

function normalizeSettings(raw: unknown): RawRecord {
  const value = asRecord(raw);
  const features = asRecord(value.features);
  const ui = asRecord(value.ui);
  const ai = asRecord(value.ai);
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    features: { ...DEFAULT_SETTINGS.features, ...features },
    ui: { ...DEFAULT_SETTINGS.ui, ...ui },
    ai: { ...DEFAULT_SETTINGS.ai, ...ai },
  };
}

function normalizeFlags(raw: unknown): RawRecord {
  return { ...DEFAULT_FLAGS, ...asRecord(raw) };
}

/**
 * Pure migration map. Each entry upgrades from its key version to the next.
 * Version 0 covers an absent/unknown document: merge over defaults and adopt v1.
 */
const migrations: Record<number, (input: RawRecord) => RawRecord> = {
  0: (input) => {
    const base = createDefaultDb() as unknown as RawRecord;
    return {
      ...base,
      ...input,
      schemaVersion: 1,
      settings: normalizeSettings(input.settings),
      flags: normalizeFlags(input.flags),
    };
  },
};

export class DbTooNewError extends Error {
  constructor(version: number) {
    super(`Anexo data was created by a newer version (schema ${version})`);
    this.name = 'DbTooNewError';
  }
}

/** Validate and migrate an unknown stored payload. Returns null when nothing is stored. */
export function normalizeDb(raw: unknown): AnexoDb | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') throw new Error('Stored Anexo data is not an object');

  let document = asRecord(raw);
  let version =
    typeof document.schemaVersion === 'number' && Number.isFinite(document.schemaVersion)
      ? document.schemaVersion
      : 0;

  if (version > SCHEMA_VERSION) throw new DbTooNewError(version);

  while (version < SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`Missing migration from schema ${version}`);
    document = migrate(document);
    version += 1;
  }

  // Fill any fields missing from an older-but-known document before strict validation.
  const base = createDefaultDb() as unknown as RawRecord;
  document = {
    ...base,
    ...document,
    schemaVersion: SCHEMA_VERSION,
    settings: normalizeSettings(document.settings),
    flags: normalizeFlags(document.flags),
  };

  return DbSchema.parse(document);
}
