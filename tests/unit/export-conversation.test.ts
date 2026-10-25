import { describe, expect, it } from 'vitest';
import {
  conversationFileName,
  conversationToHtml,
  conversationToMarkdown,
} from '@/domain/export-conversation';
import type { ConversationDetail } from '@/types/chatgpt';

const detail: ConversationDetail = {
  id: 'conv-1234abcd',
  title: 'Local-first <notes>',
  createTime: Date.UTC(2026, 9, 1, 12, 0, 0),
  updateTime: Date.UTC(2026, 9, 2, 12, 0, 0),
  messages: [
    { id: 'm1', role: 'user', text: 'How should bookmarks work?', createTime: null },
    {
      id: 'm2',
      role: 'assistant',
      text: 'Anchor to stable IDs.\n\nUse the API mapping.',
      createTime: null,
    },
    { id: 'm3', role: 'system', text: 'ignored', createTime: null },
  ],
};

describe('conversation export', () => {
  it('writes a readable Markdown transcript', () => {
    const markdown = conversationToMarkdown(detail);
    expect(markdown).toContain('# Local-first <notes>');
    expect(markdown).toContain('### 🧑 User');
    expect(markdown).toContain('How should bookmarks work?');
    expect(markdown).toContain('### 🤖 Assistant');
    expect(markdown).toContain('Anchor to stable IDs.');
    expect(markdown).not.toContain('ignored');
  });

  it('escapes untrusted text in the HTML export', () => {
    const html = conversationToHtml({
      ...detail,
      messages: [
        { id: 'm1', role: 'user', text: '<script>alert("x")</script>', createTime: null },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Local-first &lt;notes&gt;');
  });

  it('builds a filesystem-safe file name', () => {
    expect(conversationFileName(detail, 'md')).toBe('chatgpt-local-first-notes-conv-123.md');
  });
});
