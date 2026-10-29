import type { DbCommand } from '@/data/commands';

export type RuntimeRequest =
  | { type: 'db:snapshot' }
  | { type: 'db:command'; command: DbCommand }
  | { type: 'ui:openCommandCenter' }
  | { type: 'ui:openOptions' }
  | { type: 'ai:test' };

export type RuntimeResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SenderInfo {
  id?: string;
  url?: string;
  tab?: { url?: string };
}
