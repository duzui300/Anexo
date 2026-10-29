import type { Theme } from '@/data/schema';

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'light' || theme === 'dark') return theme;

  if (typeof document === 'undefined') return 'light';
  const root = document.documentElement;
  if (
    root.classList.contains('dark') ||
    root.dataset.theme === 'dark' ||
    root.getAttribute('data-theme') === 'dark'
  ) {
    return 'dark';
  }

  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function observeTheme(theme: Theme, onChange: (resolved: ResolvedTheme) => void): () => void {
  let last = resolveTheme(theme);
  const emit = () => {
    const next = resolveTheme(theme);
    if (next === last) return;
    last = next;
    onChange(next);
  };

  if (typeof document === 'undefined') return () => {};

  const observer = new MutationObserver(emit);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme'],
  });

  const media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  media?.addEventListener('change', emit);

  return () => {
    observer.disconnect();
    media?.removeEventListener('change', emit);
  };
}
