import { create } from 'zustand';
import { createDefaultDb } from '@/data/defaults';
import type { AnexoDb, Settings } from '@/data/schema';

interface DbState {
  db: AnexoDb;
  hydrated: boolean;
  error: string | null;
  setDb: (db: AnexoDb) => void;
  setError: (error: string | null) => void;
}

export const useDbStore = create<DbState>((set) => ({
  db: createDefaultDb(),
  hydrated: false,
  error: null,
  setDb: (db) => set({ db, hydrated: true, error: null }),
  setError: (error) => set({ error }),
}));

export function useSettings(): Settings {
  return useDbStore((state) => state.db.settings);
}

export function useFeatures() {
  return useDbStore((state) => state.db.settings.features);
}
