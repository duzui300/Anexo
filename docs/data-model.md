# Data model

## Storage keys

| Key | Contents |
| --- | --- |
| `anexo:db` | Single user database document |
| `anexo:cache:index` | Conversation index cache envelope |
| `anexo:cache:snapshots` | Bounded conversation snapshot metadata |
| `anexo:cache:minimap` | Bounded outline cache |
| `anexo:cache:followups` | Bounded suggestion cache |
| `anexo:bulkJob` | Resumable bulk job state |
| `anexo:secrets` | AI secrets in extension-origin IndexedDB (not chrome.storage) |

No user data or secrets in `chrome.storage.sync`.

## Database document

```ts
type AnexoDb = {
  schemaVersion: number;
  revision: number;
  updatedAt: number;
  folders: Record<FolderId, Folder>;
  conversationFolders: Record<ConversationId, FolderId>;
  bookmarks: Record<BookmarkId, Bookmark>;
  notes: Record<NoteId, Note>;
  prompts: Record<PromptId, Prompt>;
  installedPacks: Record<PackId, InstalledPack>;
  settings: Settings;
  flags: LocalFlags;
};
```

- `Folder`: `{ id, name, color, parentId, order, createdAt, updatedAt }`
- `Bookmark`: `{ id, conversationId, messageId?, messageIndex, role, preview, conversationTitle?, createdAt }`
- `Note`: `{ id, conversationId, messageId?, messageIndex, role, anchorText?, text, conversationTitle?, createdAt, updatedAt, orphaned? }`
- `Prompt`: `{ id, label, content, source, sourceMessageId?, createdAt, updatedAt }`
- `InstalledPack`: `{ id, name, slug, version, installedAt }`
- `BulkJob`: `{ id, action, conversationIds, status, processed, failed[], startedAt, updatedAt }`

There are no tier, plan, quota, or usage-counter fields anywhere.

## Folder tree

- Orders are spaced by 100; insertion uses midpoints and rebalances siblings when exhausted.
- A folder cannot move into itself or a descendant.
- Deleting a folder is recursive; its conversations move to the chosen target or to the virtual
  Unfiled root.
- Collapsed state is UI state stored in settings, not on folder records.
- The UI exposes a virtual Unfiled root; no default folder is auto-created.

## Concurrency

- Background owns a serialized command queue and is the only writer of `anexo:db`.
- Content sends semantic commands (`folder/rename`, `bookmark/add`, ...), not whole documents.
- Background applies the command, increments `revision`, persists, and broadcasts.
- Content updates optimistically and reconciles against the new snapshot.
- Text edits commit on blur/save; navigation flushes pending edits.

## Migrations and recovery

- Pure migration map keyed by `schemaVersion`.
- Strict validation for our own DB; tolerant parsing for external ChatGPT responses.
- Unreadable payloads are preserved in `anexo:backup:<timestamp>` (max 3) before defaults are used.
- Import validates `schemaVersion` and supports replace or merge with duplicate handling.

## Caches

- Envelopes `{ version, savedAt, data }`.
- Snapshot cache stores conversation metadata, not full bodies.
- LRU by count and approximate bytes; prune automatically under quota pressure.
- When storage is full: prune caches, warn with a specific message, offer export/cleanup. The
  extension does not request `unlimitedStorage`.
