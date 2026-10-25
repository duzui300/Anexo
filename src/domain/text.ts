/** Collapse runs of whitespace and trim. Keeps newlines out of one-line labels. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Deterministic 32-bit FNV-1a hash, returned as an 8-character hex string. */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Clip to a maximum length, appending a marker only when something was removed. */
export function clipText(value: string, max: number, marker = '…'): string {
  if (max <= 0) return '';
  if (value.length <= max) return value;
  if (marker.length >= max) return marker.slice(0, max);
  return `${value.slice(0, max - marker.length)}${marker}`;
}

/** Approximate UTF-8 byte size without allocating an encoder for short strings. */
export function approximateBytes(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/** A stable key for message content: normalized text plus its hash. */
export function contentFingerprint(value: string): string {
  const normalized = normalizeWhitespace(value);
  return `${hashString(normalized)}:${normalized.length}`;
}

/** Return the last N code points without splitting surrogate pairs. */
export function tailText(value: string, maxCodePoints: number): string {
  if (maxCodePoints <= 0) return '';
  return Array.from(value).slice(-maxCodePoints).join('');
}
