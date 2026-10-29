import { describe, expect, it } from 'vitest';
import { applyCommand } from '../../src/data/commands';
import { createDefaultDb } from '../../src/data/defaults';
import type { Bookmark, Folder, Note, Prompt } from '../../src/data/schema';

function folder(id: string, parentId: string | null = null, order = 100): Folder {
  return { id, name: id, color: null, parentId, order, createdAt: 1, updatedAt: 1 };
}

describe('folder commands', () => {
  it('creates nested folders and moves conversations', () => {
    let db = createDefaultDb(1000);
    db = applyCommand(db, { kind: 'folder/create', folder: folder('a') });
    db = applyCommand(db, { kind: 'folder/create', folder: folder('b', 'a') });
    db = applyCommand(db, { kind: 'conversation/move', conversationId: 'conv', folderId: 'b' });

    expect(db.folders.a?.name).toBe('a');
    expect(db.folders.b?.parentId).toBe('a');
    expect(db.conversationFolders.conv).toBe('b');
  });

  it('removes local metadata for a deleted conversation', () => {
    let db = createDefaultDb(1000);
    db = applyCommand(db, { kind: 'folder/create', folder: folder('a') });
    db = applyCommand(db, { kind: 'conversation/move', conversationId: 'conv', folderId: 'a' });
    db = applyCommand(db, {
      kind: 'bookmark/add',
      bookmark: {
        id: 'bm',
        conversationId: 'conv',
        messageId: 'msg',
        messageIndex: 0,
        role: 'assistant',
        preview: 'preview',
        conversationTitle: 'Title',
        createdAt: 1,
      },
    });
    db = applyCommand(db, {
      kind: 'note/add',
      note: {
        id: 'note',
        conversationId: 'conv',
        messageId: 'msg',
        messageIndex: 0,
        role: 'assistant',
        anchorText: 'anchor',
        text: 'note text',
        conversationTitle: 'Title',
        createdAt: 1,
        updatedAt: 1,
        orphaned: false,
      },
    });

    const next = applyCommand(db, { kind: 'conversation/delete', conversationId: 'conv' });
    expect(next.conversationFolders.conv).toBeUndefined();
    expect(next.bookmarks.bm).toBeUndefined();
    expect(next.notes.note).toBeUndefined();
    expect(db.bookmarks.bm).toBeDefined();
  });

  it('rejects moving a folder into a descendant', () => {
    let db = createDefaultDb(1000);
    db = applyCommand(db, { kind: 'folder/create', folder: folder('a') });
    db = applyCommand(db, { kind: 'folder/create', folder: folder('b', 'a') });

    expect(() =>
      applyCommand(db, { kind: 'folder/update', id: 'a', patch: { parentId: 'b' } }),
    ).toThrow(/descendant/);
  });

  it('deletes a folder subtree and reassigns or unfiles conversations', () => {
    let db = createDefaultDb(1000);
    db = applyCommand(db, { kind: 'folder/create', folder: folder('a') });
    db = applyCommand(db, { kind: 'folder/create', folder: folder('b', 'a') });
    db = applyCommand(db, { kind: 'folder/create', folder: folder('keep') });
    db = applyCommand(db, { kind: 'conversation/move', conversationId: 'c1', folderId: 'b' });
    db = applyCommand(db, { kind: 'conversation/move', conversationId: 'c2', folderId: 'keep' });

    const afterReassign = applyCommand(db, { kind: 'folder/delete', id: 'a', reassignTo: 'keep' });
    expect(afterReassign.folders.a).toBeUndefined();
    expect(afterReassign.folders.b).toBeUndefined();
    expect(afterReassign.conversationFolders.c1).toBe('keep');
    expect(afterReassign.conversationFolders.c2).toBe('keep');

    const afterUnfile = applyCommand(db, { kind: 'folder/delete', id: 'a', reassignTo: null });
    expect(afterUnfile.conversationFolders.c1).toBeUndefined();
    expect(afterUnfile.conversationFolders.c2).toBe('keep');
  });

  it('does not mutate the input document', () => {
    const db = createDefaultDb(1000);
    const next = applyCommand(db, { kind: 'folder/create', folder: folder('a') });
    expect(db.folders.a).toBeUndefined();
    expect(next.folders.a).toBeDefined();
  });
});

describe('library commands', () => {
  it('adds and removes bookmarks, notes and prompts', () => {
    let db = createDefaultDb(1000);
    const bookmark: Bookmark = {
      id: 'bm',
      conversationId: 'conv',
      messageId: 'msg',
      messageIndex: 2,
      role: 'assistant',
      preview: 'preview',
      conversationTitle: 'Title',
      createdAt: 1,
    };
    const note: Note = {
      id: 'note',
      conversationId: 'conv',
      messageId: 'msg',
      messageIndex: 2,
      role: 'assistant',
      anchorText: 'anchor',
      text: 'note text',
      conversationTitle: 'Title',
      createdAt: 1,
      updatedAt: 1,
      orphaned: false,
    };
    const prompt: Prompt = {
      id: 'prompt',
      label: 'Label',
      content: 'Content',
      source: 'user',
      sourceMessageId: null,
      createdAt: 1,
      updatedAt: 1,
    };

    db = applyCommand(db, { kind: 'bookmark/add', bookmark });
    db = applyCommand(db, { kind: 'note/add', note });
    db = applyCommand(db, { kind: 'prompt/add', prompt });
    expect(db.bookmarks.bm?.preview).toBe('preview');
    expect(db.notes.note?.text).toBe('note text');
    expect(db.prompts.prompt?.label).toBe('Label');

    db = applyCommand(db, { kind: 'note/update', id: 'note', patch: { text: 'updated' } });
    expect(db.notes.note?.text).toBe('updated');
    expect(db.notes.note?.updatedAt).toBeGreaterThanOrEqual(1);

    db = applyCommand(db, { kind: 'bookmark/remove', id: 'bm' });
    db = applyCommand(db, { kind: 'note/remove', id: 'note' });
    db = applyCommand(db, { kind: 'prompt/remove', id: 'prompt' });
    expect(db.bookmarks.bm).toBeUndefined();
    expect(db.notes.note).toBeUndefined();
    expect(db.prompts.prompt).toBeUndefined();
  });
});

describe('settings commands', () => {
  it('deep-merges settings without dropping siblings', () => {
    const db = createDefaultDb(1000);
    const next = applyCommand(db, {
      kind: 'settings/patch',
      patch: { features: { sidebar: false }, ui: { railWidth: 360 } },
    });

    expect(next.settings.features.sidebar).toBe(false);
    expect(next.settings.features.timestamps).toBe(true);
    expect(next.settings.ui.railWidth).toBe(360);
    expect(next.settings.ui.railTab).toBe('minimap');
    expect(db.settings.features.sidebar).toBe(true);
  });

  it('replaces arrays instead of merging them', () => {
    const db = createDefaultDb(1000);
    const next = applyCommand(db, {
      kind: 'settings/patch',
      patch: { ui: { collapsedFolderIds: ['a', 'b'] } },
    });
    expect(next.settings.ui.collapsedFolderIds).toEqual(['a', 'b']);
  });
});
