import type { MessageRole } from '@/data/schema';
import type {
  BackendStatus,
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  ProjectSummary,
} from '@/types/chatgpt';
import { ChatGptApiError, chatGptFetch, chatGptJson } from './client';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** ChatGPT mixes seconds, milliseconds and ISO strings across endpoints. Normalize to ms. */
export function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function asRole(value: unknown): MessageRole {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'tool'
    ? value
    : 'unknown';
}

export function normalizeConversationSummary(raw: unknown): ConversationSummary | null {
  const value = asRecord(raw);
  const id = asString(value.id) ?? asString(value.conversation_id);
  if (!id) return null;

  return {
    id,
    title: asString(value.title) ?? 'Untitled',
    createTime: toTimestamp(value.create_time),
    updateTime: toTimestamp(value.update_time),
    isArchived: asBoolean(value.is_archived),
    isStarred: asBoolean(value.is_starred),
    gizmoId: asString(value.gizmo_id),
  };
}

function normalizeMessage(raw: unknown): ConversationMessage | null {
  const value = asRecord(raw);
  const id = asString(value.id) ?? asString(value.message_id);
  if (!id) return null;

  const author = asRecord(value.author);
  const content = asRecord(value.content);
  const parts = asArray(content.parts)
    .map((part) => (typeof part === 'string' ? part : ''))
    .filter((part) => part.trim().length > 0);
  const text = parts.join('\n').trim();
  if (!text) return null;

  return {
    id,
    role: asRole(author.role),
    text,
    createTime: toTimestamp(value.create_time),
  };
}

export function normalizeConversationDetail(raw: unknown): ConversationDetail | null {
  const value = asRecord(raw);
  const id = asString(value.id) ?? asString(value.conversation_id);
  if (!id) return null;

  const mapping = asRecord(value.mapping);
  const messages: ConversationMessage[] = [];
  const currentNode = asString(value.current_node);

  if (currentNode && mapping[currentNode]) {
    const chain: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let node = asRecord(mapping[currentNode]);

    while (node && !seen.has(asString(node.id) ?? '')) {
      chain.push(node);
      seen.add(asString(node.id) ?? '');
      const parentId = asString(node.parent);
      if (!parentId) break;
      node = asRecord(mapping[parentId]);
    }

    chain.reverse();
    for (const item of chain) {
      const message = normalizeMessage(item.message);
      if (message) messages.push(message);
    }
  } else {
    const nodes = Object.values(mapping).map(asRecord);
    const roots = nodes.filter((node) => !asString(node.parent));
    const seen = new Set<unknown>();

    const walk = (node: Record<string, unknown>) => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      const message = normalizeMessage(node.message);
      if (message) messages.push(message);
      for (const childId of asArray(node.children)) {
        const child = mapping[asString(childId) ?? ''];
        if (child) walk(asRecord(child));
      }
    };

    for (const root of roots) walk(root);
  }

  return {
    id,
    title: asString(value.title) ?? 'Untitled',
    messages,
    createTime: toTimestamp(value.create_time),
    updateTime: toTimestamp(value.update_time),
  };
}

export interface ConversationPage {
  items: ConversationSummary[];
  total: number | null;
  offset: number;
  limit: number;
  cursor: string | null;
}

export interface ConversationListOptions {
  limit?: number;
  offset?: number;
  archived?: boolean;
}

export async function listConversationPage(
  options: ConversationListOptions = {},
): Promise<ConversationPage> {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 20;
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    is_archived: String(options.archived ?? false),
    order: 'updated',
  });

  const data = asRecord(await chatGptJson<unknown>(`/conversations?${params.toString()}`));
  return {
    items: asArray(data.items)
      .map(normalizeConversationSummary)
      .filter((item): item is ConversationSummary => item !== null),
    total: asNumber(data.total) ?? asNumber(data.total_count),
    offset: asNumber(data.offset) ?? offset,
    limit: asNumber(data.limit) ?? limit,
    cursor: asString(data.cursor),
  };
}

export async function listConversations(
  options: ConversationListOptions = {},
): Promise<ConversationSummary[]> {
  return (await listConversationPage(options)).items;
}

export async function searchConversationPage(
  query: string,
  cursor?: string | null,
): Promise<ConversationPage> {
  const params = new URLSearchParams({ query });
  if (cursor) params.set('cursor', cursor);

  const data = asRecord(await chatGptJson<unknown>(`/conversations/search?${params.toString()}`));
  const items = asArray(data.items)
    .map(normalizeConversationSummary)
    .filter((item): item is ConversationSummary => item !== null);
  return {
    items,
    total: asNumber(data.total) ?? asNumber(data.total_count),
    offset: 0,
    limit: items.length,
    cursor: asString(data.cursor),
  };
}

export async function searchConversations(
  query: string,
  cursor?: string | null,
): Promise<ConversationSummary[]> {
  return (await searchConversationPage(query, cursor)).items;
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  const data = await chatGptJson<unknown>(`/conversation/${encodeURIComponent(id)}`);
  return normalizeConversationDetail(data);
}

/** Permanently delete a conversation from the user's ChatGPT account. */
export async function deleteConversation(id: string): Promise<void> {
  try {
    // ChatGPT's web client uses /conversation/id/{id}; the shorter path answers 405.
    await chatGptFetch(`/conversation/id/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (error) {
    // A 404 means the conversation is already gone, which is the desired state.
    if (error instanceof ChatGptApiError && error.status === 404) return;
    throw error;
  }
}

export interface ConversationPatch {
  title?: string;
  isArchived?: boolean;
  isVisible?: boolean;
  isStarred?: boolean;
  gizmoId?: string | null;
}

export async function patchConversation(id: string, patch: ConversationPatch): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.isArchived !== undefined) body.is_archived = patch.isArchived;
  if (patch.isVisible !== undefined) body.is_visible = patch.isVisible;
  if (patch.isStarred !== undefined) body.is_starred = patch.isStarred;
  if (patch.gizmoId !== undefined) body.gizmo_id = patch.gizmoId;

  await chatGptJson<unknown>(`/conversation/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const params = new URLSearchParams({
    conversations_per_gizmo: '0',
    owned_only: 'true',
    limit: '50',
  });
  const data = await chatGptJson<unknown>(`/gizmos/snorlax/sidebar?${params.toString()}`);
  const items = asArray(asRecord(data).items);
  return items
    .map(asRecord)
    .map((item) => {
      const id = asString(item.id) ?? asString(asRecord(item.gizmo).id);
      const name =
        asString(item.name) ??
        asString(asRecord(asRecord(item.display).name).text) ??
        asString(asRecord(item.display).name);
      return id && name ? { id, name } : null;
    })
    .filter((item): item is ProjectSummary => item !== null);
}

export async function checkBackend(): Promise<BackendStatus> {
  const data = await chatGptJson<unknown>('/accounts/check/v4-2023-04-27');
  const accounts = asRecord(asRecord(data).accounts);
  const preferred = asRecord(accounts.default ?? Object.values(accounts)[0]);
  const plan = asString(asRecord(preferred.account).plan_type);
  return { ok: true, plan };
}
