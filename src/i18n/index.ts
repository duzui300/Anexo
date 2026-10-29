import { en, type MessageKey } from './en';
import { zhCN } from './zh-CN';

export type Locale = 'en' | 'zh-CN';

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en,
  'zh-CN': zhCN,
};

let activeLocale: Locale = 'en';

export function resolveLocale(preference: string): Locale {
  if (preference === 'zh-CN') return 'zh-CN';
  if (preference === 'en') return 'en';
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

export function setLocale(preference: string): Locale {
  activeLocale = resolveLocale(preference);
  return activeLocale;
}

export function getLocale(): Locale {
  return activeLocale;
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = catalogs[activeLocale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export type { MessageKey };
