import { observeTheme, resolveTheme } from '@/app/theme';
import type { Theme } from '@/data/schema';

export function applyPageTheme(theme: Theme = 'system'): void {
  document.documentElement.dataset.axTheme = resolveTheme(theme);
}

export function watchPageTheme(theme: Theme = 'system'): () => void {
  applyPageTheme(theme);
  return observeTheme(theme, (resolved) => {
    document.documentElement.dataset.axTheme = resolved;
  });
}
