import { mergeDeep } from '@/domain/deep-merge';
import { createDefaultDb } from './defaults';
import type {
  AnexoDb,
  Bookmark,
  DeepPartial,
  Folder,
  InstalledPack,
  LocalFlags,
  Note,
  Prompt,
  Settings,
} from './schema';

export type DbCommand =
  | { kind: 'folder/create'; folder: Folder }
  | {
      kind: 'folder/update';
      id: string;
      patch: Partial<Pick<Folder, 'name' | 'color' | 'parentId' | 'order'>>;
    }
  | { kind: 'folder/delete'; id: string; reassignTo: string | null }
  | { kind: 'conversation/move'; conversationId: string; folderId: string | null }
  | { kind: 'conversation/delete'; conversationId: string }
  | { kind: 'bookmark/add'; bookmark: Bookmark }
  | { kind: 'bookmark/remove'; id: string }
  | { kind: 'note/add'; note: Note }
  | {
      kind: 'note/update';
      id: string;
      patch: Partial<Pick<Note, 'text' | 'anchorText' | 'orphaned' | 'conversationTitle'>>;
    }
  | { kind: 'note/remove'; id: string }
  | { kind: 'prompt/add'; prompt: Prompt }
  | { kind: 'prompt/update'; id: string; patch: Partial<Pick<Prompt, 'label' | 'content'>> }
  | { kind: 'prompt/remove'; id: string }
  | { kind: 'pack/install'; pack: InstalledPack }
  | { kind: 'pack/remove'; id: string }
  | { kind: 'settings/patch'; patch: DeepPartial<Settings> }
  | { kind: 'flags/patch'; patch: Partial<LocalFlags> }
  | { kind: 'db/replace'; db: AnexoDb }
  | { kind: 'db/reset' };

function assertFolder(db: AnexoDb, id: string): Folder {
  const folder = db.folders[id];
  if (!folder) throw new Error(`Folder not found: ${id}`);
  return folder;
}

function assertParent(db: AnexoDb, parentId: string | null): void {
  if (parentId !== null && !db.folders[parentId]) {
    throw new Error(`Parent folder not found: ${parentId}`);
  }
}

function descendantIds(db: AnexoDb, rootId: string): Set<string> {
  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const folder of Object.values(db.folders)) {
      if (folder.parentId === current && !result.has(folder.id)) {
        result.add(folder.id);
        queue.push(folder.id);
      }
    }
  }
  return result;
}

function wouldCreateCycle(db: AnexoDb, folderId: string, nextParentId: string | null): boolean {
  if (nextParentId === null) return false;
  if (nextParentId === folderId) return true;
  return descendantIds(db, folderId).has(nextParentId);
}

/**
 * Pure reducer. Does not bump revision or updatedAt; the background writer owns those.
 * Throws on invalid references so the caller can surface a real error instead of corrupting state.
 */
export function applyCommand(current: AnexoDb, command: DbCommand): AnexoDb {
  const db = structuredClone(current);

  switch (command.kind) {
    case 'folder/create': {
      if (db.folders[command.folder.id]) {
        throw new Error(`Folder already exists: ${command.folder.id}`);
      }
      assertParent(db, command.folder.parentId);
      db.folders[command.folder.id] = command.folder;
      return db;
    }

    case 'folder/update': {
      const folder = assertFolder(db, command.id);
      if (command.patch.parentId !== undefined) {
        assertParent(db, command.patch.parentId);
        if (wouldCreateCycle(db, command.id, command.patch.parentId)) {
          throw new Error('Cannot move a folder into itself or a descendant');
        }
      }
      db.folders[command.id] = {
        ...folder,
        ...command.patch,
        updatedAt: Date.now(),
      };
      return db;
    }

    case 'folder/delete': {
      assertFolder(db, command.id);
      const removed = descendantIds(db, command.id);
      const reassignTo =
        command.reassignTo && !removed.has(command.reassignTo) && db.folders[command.reassignTo]
          ? command.reassignTo
          : null;

      for (const folderId of removed) delete db.folders[folderId];

      for (const [conversationId, folderId] of Object.entries(db.conversationFolders)) {
        if (!removed.has(folderId)) continue;
        if (reassignTo) db.conversationFolders[conversationId] = reassignTo;
        else delete db.conversationFolders[conversationId];
      }
      return db;
    }

    case 'conversation/move': {
      if (command.folderId === null) {
        delete db.conversationFolders[command.conversationId];
      } else {
        assertFolder(db, command.folderId);
        db.conversationFolders[command.conversationId] = command.folderId;
      }
      return db;
    }

    case 'conversation/delete': {
      delete db.conversationFolders[command.conversationId];
      for (const [id, bookmark] of Object.entries(db.bookmarks)) {
        if (bookmark.conversationId === command.conversationId) delete db.bookmarks[id];
      }
      for (const [id, note] of Object.entries(db.notes)) {
        if (note.conversationId === command.conversationId) delete db.notes[id];
      }
      return db;
    }

    case 'bookmark/add': {
      if (db.bookmarks[command.bookmark.id]) {
        throw new Error(`Bookmark already exists: ${command.bookmark.id}`);
      }
      db.bookmarks[command.bookmark.id] = command.bookmark;
      return db;
    }

    case 'bookmark/remove': {
      delete db.bookmarks[command.id];
      return db;
    }

    case 'note/add': {
      if (db.notes[command.note.id]) throw new Error(`Note already exists: ${command.note.id}`);
      db.notes[command.note.id] = command.note;
      return db;
    }

    case 'note/update': {
      const note = db.notes[command.id];
      if (!note) throw new Error(`Note not found: ${command.id}`);
      db.notes[command.id] = { ...note, ...command.patch, updatedAt: Date.now() };
      return db;
    }

    case 'note/remove': {
      delete db.notes[command.id];
      return db;
    }

    case 'prompt/add': {
      if (db.prompts[command.prompt.id]) {
        throw new Error(`Prompt already exists: ${command.prompt.id}`);
      }
      db.prompts[command.prompt.id] = command.prompt;
      return db;
    }

    case 'prompt/update': {
      const prompt = db.prompts[command.id];
      if (!prompt) throw new Error(`Prompt not found: ${command.id}`);
      db.prompts[command.id] = { ...prompt, ...command.patch, updatedAt: Date.now() };
      return db;
    }

    case 'prompt/remove': {
      delete db.prompts[command.id];
      return db;
    }

    case 'pack/install': {
      db.installedPacks[command.pack.id] = command.pack;
      return db;
    }

    case 'pack/remove': {
      delete db.installedPacks[command.id];
      return db;
    }

    case 'settings/patch': {
      db.settings = mergeDeep<Settings>(db.settings, command.patch);
      return db;
    }

    case 'flags/patch': {
      db.flags = { ...db.flags, ...command.patch };
      return db;
    }

    case 'db/replace': {
      return structuredClone(command.db);
    }

    case 'db/reset': {
      return createDefaultDb();
    }

    default: {
      const exhaustive: never = command;
      throw new Error(`Unknown command: ${JSON.stringify(exhaustive)}`);
    }
  }
}
