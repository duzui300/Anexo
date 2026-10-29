const PREFIX = '[Anexo]';

/**
 * Metadata-only logging. Never log prompt text, conversation content, API keys, or
 * Authorization headers. Debug logs are stripped from production builds.
 */
export const log = {
  debug(...args: unknown[]): void {
    if (import.meta.env.DEV) console.debug(PREFIX, ...args);
  },
  info(...args: unknown[]): void {
    console.info(PREFIX, ...args);
  },
  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  },
};
