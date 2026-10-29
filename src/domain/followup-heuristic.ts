const DEFAULT_FOLLOWUPS = [
  'Can you give a concrete example?',
  'What are the trade-offs?',
  'What should I do next?',
];

const CODE_FOLLOWUP = 'Can you walk me through the code step by step?';
const SOURCE_FOLLOWUP = 'Can you point me to the relevant documentation?';

/**
 * Local, zero-cost follow-up suggestions. They are intentionally generic:
 * they should be useful without pretending to understand the answer.
 */
export function heuristicFollowups(text: string, limit = 3): string[] {
  const source = text.trim();
  if (!source) return [];

  const lower = source.toLowerCase();
  const suggestions: string[] = [];

  if (/```|\bcode\b|function\s|class\s|const\s|=>/.test(lower)) {
    suggestions.push(CODE_FOLLOWUP);
  }
  if (/https?:\/\/|documentation|docs\b|source\b|reference\b/.test(lower)) {
    suggestions.push(SOURCE_FOLLOWUP);
  }
  if (/\d+\.\s|\bfirst\b|\bsecond\b|\bstep\b|\bthen\b/.test(lower)) {
    suggestions.push('Can you summarize this as a checklist?');
  }

  for (const fallback of DEFAULT_FOLLOWUPS) {
    if (suggestions.length >= limit) break;
    if (!suggestions.includes(fallback)) suggestions.push(fallback);
  }

  return suggestions.slice(0, Math.max(0, limit));
}
