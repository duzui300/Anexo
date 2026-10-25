import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildConversationZip } from '@/domain/export-bulk';
import type { ConversationDetail } from '@/types/chatgpt';

const first: ConversationDetail = {
  id: 'conv-1',
  title: 'Alpha',
  createTime: null,
  updateTime: null,
  messages: [{ id: 'm1', role: 'user', text: 'First question', createTime: null }],
};

const second: ConversationDetail = {
  id: 'conv-2',
  title: 'Beta',
  createTime: null,
  updateTime: null,
  messages: [{ id: 'm2', role: 'assistant', text: 'Second answer', createTime: null }],
};

describe('buildConversationZip', () => {
  it('includes Markdown, HTML, and a manifest for each conversation', () => {
    const result = buildConversationZip([first, second], new Date('2026-10-24T00:00:00Z'));
    expect(result.conversations).toBe(2);
    expect(result.files).toBe(5);

    const files = unzipSync(result.bytes);
    const names = Object.keys(files);
    expect(names.filter((name) => name.endsWith('.md'))).toHaveLength(2);
    expect(names.filter((name) => name.endsWith('.html'))).toHaveLength(2);
    expect(names).toContain('README.txt');

    const markdownName = names.find((name) => name.startsWith('chatgpt-alpha-'));
    expect(markdownName).toBeDefined();
    expect(strFromU8(files[markdownName!]!)).toContain('First question');
    expect(strFromU8(files['README.txt']!)).toContain('Conversations: 2');
  });

  it('produces a valid empty archive with a manifest', () => {
    const result = buildConversationZip([], new Date('2026-10-24T00:00:00Z'));
    expect(result.conversations).toBe(0);
    const files = unzipSync(result.bytes);
    expect(Object.keys(files)).toEqual(['README.txt']);
  });
});
