import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingFolderForNewChat,
  rememberFolderForNewChat,
  takePendingFolderAssignment,
} from '../../src/app/sidebar/pending-folder';

describe('pending folder assignment', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('assigns the first new conversation and clears the pending value', () => {
    rememberFolderForNewChat('folder-a', ['existing-1', 'existing-2'], null);
    const now = Date.now();

    expect(takePendingFolderAssignment('new-conversation', now)).toBe('folder-a');
    expect(takePendingFolderAssignment('another-conversation', now)).toBeNull();
  });

  it('skips the source conversation, then assigns the new one', () => {
    rememberFolderForNewChat('folder-a', ['existing-1'], 'existing-1');
    const now = Date.now();

    expect(takePendingFolderAssignment('existing-1', now)).toBeNull();
    expect(takePendingFolderAssignment('new-conversation', now)).toBe('folder-a');
  });

  it('does not consume the pending value for a known conversation', () => {
    rememberFolderForNewChat('folder-a', ['existing-1'], 'source-conversation');

    expect(takePendingFolderAssignment('existing-1', Date.now())).toBeNull();
    expect(takePendingFolderAssignment('new-conversation', Date.now())).toBe('folder-a');
  });

  it('drops stale and malformed pending values', () => {
    rememberFolderForNewChat('folder-a', [], null);
    expect(takePendingFolderAssignment('new-conversation', Date.now() + 11 * 60_000)).toBeNull();

    sessionStorage.setItem('anexo:pendingFolderAssignment', '{not-json');
    expect(takePendingFolderAssignment('new-conversation', Date.now())).toBeNull();
  });

  it('can be cleared when opening a new chat from a non-folder view', () => {
    rememberFolderForNewChat('folder-a', [], null);
    clearPendingFolderForNewChat();
    expect(takePendingFolderAssignment('new-conversation', Date.now())).toBeNull();
  });
});
