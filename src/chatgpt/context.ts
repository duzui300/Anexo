import type { ConversationMessage } from '@/types/chatgpt';
import { getConversation } from './conversations';
import {
  getAssistantContent,
  getConversationId,
  getMessageNodes,
  getMessageRole,
} from './selectors';

export interface PageContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

function nodeText(node: Element, role: string): string {
  if (role === 'assistant') {
    const content = getAssistantContent(node);
    return (content?.textContent ?? '').trim();
  }

  const clone = node.cloneNode(true) as HTMLElement;
  for (const element of clone.querySelectorAll('button, [role="button"], svg, time')) {
    element.remove();
  }
  return (clone.innerText ?? clone.textContent ?? '').trim();
}

function clipMessages(messages: PageContextMessage[], maxChars: number): PageContextMessage[] {
  const clipped: PageContextMessage[] = [];
  let used = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (used + message.content.length > maxChars) break;
    clipped.unshift(message);
    used += message.content.length;
  }
  return clipped;
}

export function getConversationContext(maxChars = 24_000): PageContextMessage[] {
  const messages: PageContextMessage[] = [];

  for (const node of getMessageNodes()) {
    const role = getMessageRole(node);
    if (role !== 'user' && role !== 'assistant') continue;
    const content = nodeText(node, role).slice(0, 8_000);
    if (!content) continue;
    messages.push({ role, content });
  }

  return clipMessages(messages, maxChars);
}

function apiMessagesToContext(messages: ConversationMessage[]): PageContextMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.text.slice(0, 8_000),
    }))
    .filter((message) => message.content.trim().length > 0);
}

/**
 * Prefer the backend conversation detail. ChatGPT's current DOM no longer exposes
 * `data-message-author-role` reliably, while the backend mapping is stable and includes
 * messages that are virtualized out of the page. Fall back to DOM extraction for unsaved
 * chats or when the backend is unavailable.
 */
export async function getConversationContextForChat(
  maxChars = 24_000,
): Promise<PageContextMessage[]> {
  const id = getConversationId();
  if (id) {
    try {
      const detail = await getConversation(id);
      if (detail && detail.messages.length > 0) {
        const messages = apiMessagesToContext(detail.messages);
        if (messages.length > 0) return clipMessages(messages, maxChars);
      }
    } catch {
      // Fall through to the DOM.
    }
  }

  return getConversationContext(maxChars);
}

export function contextToText(messages: PageContextMessage[]): string {
  return messages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n\n');
}

export function getSelectedText(): string {
  return (window.getSelection()?.toString() ?? '').trim();
}

export function getLastAssistantText(): string {
  const messages = getConversationContext();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') return message.content;
  }
  return '';
}

export async function getLastAssistantTextForChat(): Promise<string> {
  const messages = await getConversationContextForChat();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') return message.content;
  }
  return '';
}
