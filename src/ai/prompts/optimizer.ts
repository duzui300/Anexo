import type { ChatMessage, OptimizerContextMessage } from '../types';

const MAX_INPUT = 4_000;
const MAX_CONTEXT = 4_000;

const SYSTEM = `You are a precise prompt editor.
Rewrite the user's prompt so it is clearer and more effective, but never answer it.

Rules:
- Preserve the user's language, intent, tone, and any code or quoted text.
- If the prompt is already clear, make only minimal improvements.
- If it is a short continuation such as "continue" or "go on", use the conversation context to make it self-contained.
- If it is broad or underspecified, add only the constraints that materially improve the result. Do not invent private facts.
- Do not add commentary, headings, or quotation marks outside the tags.
- Return exactly one block in this form: <enhanced>rewritten prompt</enhanced>`;

export function buildOptimizerMessages(
  input: string,
  context: OptimizerContextMessage[],
): ChatMessage[] {
  const clippedInput = input.slice(0, MAX_INPUT);
  const contextLines: string[] = [];
  let used = 0;

  for (const message of context.slice(-6)) {
    const line = `[${message.role === 'assistant' ? 'Assistant' : 'User'}]: ${message.content}`;
    if (used + line.length > MAX_CONTEXT) break;
    contextLines.push(line);
    used += line.length;
  }

  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        'Conversation context (reference only; do not answer it):',
        contextLines.length > 0 ? contextLines.join('\n') : '(none)',
        '',
        'Prompt to rewrite:',
        '<input>',
        clippedInput,
        '</input>',
      ].join('\n'),
    },
  ];
}

export function extractEnhanced(text: string): string {
  const match = text.match(/<enhanced>([\s\S]*?)<\/enhanced>/i);
  const value = (match?.[1] ?? text).trim();
  return value.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
}
