import { afterEach, describe, expect, it } from 'vitest';
import {
  getConversationId,
  getMessageId,
  getMessageRole,
  getSidebarMount,
  getTurnIndex,
} from '../../src/chatgpt/selectors';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getConversationId', () => {
  it('reads the path id', () => {
    expect(getConversationId('https://chatgpt.com/c/abc-123')).toBe('abc-123');
  });

  it('falls back to the hash', () => {
    expect(getConversationId('https://chatgpt.com/?conversation=conv-9')).toBe('conv-9');
  });

  it('returns null for a new chat', () => {
    expect(getConversationId('https://chatgpt.com/')).toBeNull();
  });

  it('ignores the temporary local chat id used before the first message', () => {
    expect(
      getConversationId(
        'https://chatgpt.com/c/local-chatgpt%3Ae74d477d-0c25-49d6-9809-4907a11171a4',
      ),
    ).toBeNull();
    expect(getConversationId('https://chatgpt.com/c/local-chatgpt')).toBeNull();
  });

  it('decodes ids with escaped characters', () => {
    expect(getConversationId('https://chatgpt.com/c/a%3Ab')).toBe('a:b');
  });
});

describe('getSidebarMount', () => {
  it('prefers the legacy #history list', () => {
    document.body.innerHTML = '<nav id="history"></nav>';
    const mount = getSidebarMount();
    expect(mount?.dock).toBe('history');
    expect(mount?.parent.id).toBe('history');
    expect(mount?.after).toBeNull();
  });

  it('mounts at the top of the history list inside #ds-sidebar', () => {
    document.body.innerHTML = `
      <aside id="ds-sidebar" aria-label="侧边栏">
        <div>
          <div data-testid="header"></div>
          <nav aria-label="Chat history"></nav>
        </div>
      </aside>
    `;
    const mount = getSidebarMount();
    expect(mount?.dock).toBe('history');
    expect(mount?.parent).toBe(document.querySelector('nav[aria-label="Chat history"]'));
    expect(mount?.after).toBeNull();
  });

  it('falls back to a localized chat history nav', () => {
    document.body.innerHTML = '<div id="wrap"><nav aria-label="聊天记录"></nav></div>';
    const mount = getSidebarMount();
    expect(mount?.dock).toBe('nav');
    expect(mount?.parent).toBe(document.querySelector('nav'));
    expect(mount?.after).toBeNull();
  });

  it('returns null when no sidebar exists', () => {
    document.body.innerHTML = '<main></main>';
    expect(getSidebarMount()).toBeNull();
  });
});

describe('message helpers', () => {
  it('reads stable ids and roles', () => {
    document.body.innerHTML = `
      <div data-testid="conversation-turn-3">
        <div data-message-author-role="assistant" data-message-id="msg-1"></div>
      </div>
    `;
    const node = document.querySelector('[data-message-id]')!;
    expect(getMessageId(node)).toBe('msg-1');
    expect(getMessageRole(node)).toBe('assistant');
    expect(getTurnIndex(node)).toBe(2);
  });

  it('supports data-message-uuid', () => {
    document.body.innerHTML =
      '<div data-message-author-role="user" data-message-uuid="uuid-1"></div>';
    const node = document.querySelector('[data-message-uuid]')!;
    expect(getMessageId(node)).toBe('uuid-1');
  });
});
