const STORAGE_KEY = 'anexo:pendingFolderAssignment';
const MAX_AGE_MS = 10 * 60_000;

interface PendingFolderAssignment {
  folderId: string;
  knownIds: string[];
  fromId: string | null;
  at: number;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberFolderForNewChat(
  folderId: string,
  knownIds: Iterable<string>,
  fromId: string | null,
): void {
  const target = storage();
  if (!target) return;
  const value: PendingFolderAssignment = {
    folderId,
    knownIds: Array.from(new Set(knownIds)).slice(0, 2_000),
    fromId,
    at: Date.now(),
  };
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in restricted tabs; the chat still opens.
  }
}

export function clearPendingFolderForNewChat(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Consume the pending folder for a conversation URL. The pending record survives the
 * current conversation and other DB updates: it is only consumed by a different
 * conversation that was not already in the list when the new-chat link was clicked.
 */
export function takePendingFolderAssignment(
  conversationId: string,
  now = Date.now(),
): string | null {
  const target = storage();
  if (!target) return null;

  let raw: string | null;
  try {
    raw = target.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<PendingFolderAssignment> | null;
    if (
      !value ||
      typeof value.folderId !== 'string' ||
      !Array.isArray(value.knownIds) ||
      (value.fromId !== null && typeof value.fromId !== 'string') ||
      typeof value.at !== 'number'
    ) {
      target.removeItem(STORAGE_KEY);
      return null;
    }

    const age = now - value.at;
    if (age > MAX_AGE_MS || age < -60_000) {
      target.removeItem(STORAGE_KEY);
      return null;
    }

    // Folder creation or a settings update can fire this effect while the user is
    // still on the conversation they started from. Keep the pending marker.
    if (conversationId === value.fromId) return null;
    if (value.knownIds.includes(conversationId)) return null;

    target.removeItem(STORAGE_KEY);
    return value.folderId;
  } catch {
    try {
      target.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
    return null;
  }
}
