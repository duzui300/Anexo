import type { ChatMessage } from '../types';

const MAX_CONTEXT = 2_000;

const SYSTEM = `Suggest exactly three short follow-up questions the user could ask next.
Use the user's voice, keep each item under 90 characters, and return JSON only:
{"items":["...","...","..."]}`;

export function buildFollowupMessages(context: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Conversation context:\n<context>\n${context.slice(-MAX_CONTEXT)}\n</context>`,
    },
  ];
}

export function parseFollowups(text: string): string[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return [];

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}
