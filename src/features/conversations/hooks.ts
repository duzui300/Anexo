import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  deleteConversation,
  getConversation,
  listConversationPage,
  patchConversation,
  searchConversationPage,
  type ConversationPage,
  type ConversationPatch,
} from '@/chatgpt/conversations';
import { dispatchAndCommit } from '@/stores/actions';
import type { ConversationSummary } from '@/types/chatgpt';
import { conversationKeys } from './query-keys';

const PAGE_SIZE = 40;

export function useConversationIndex(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: conversationKeys.index,
    queryFn: ({ pageParam }) => listConversationPage({ offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length === 0) return undefined;
      if (lastPage.total !== null) {
        const loaded = lastPage.offset + lastPage.items.length;
        return loaded < lastPage.total ? loaded : undefined;
      }
      return lastPage.items.length < lastPage.limit
        ? undefined
        : lastPage.offset + lastPage.items.length;
    },
    enabled,
  });
}

export function useConversationDetail(id: string | null) {
  return useQuery({
    queryKey: conversationKeys.detail(id ?? 'none'),
    queryFn: () => getConversation(id!),
    enabled: Boolean(id),
  });
}

export function useConversationSearch(query: string) {
  const trimmed = query.trim();
  return useInfiniteQuery({
    queryKey: conversationKeys.search(trimmed),
    queryFn: ({ pageParam }) => searchConversationPage(trimmed, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: trimmed.length > 0,
  });
}

export function conversationItems(
  data: InfiniteData<ConversationPage> | undefined,
): ConversationSummary[] {
  if (!data) return [];
  const seen = new Set<string>();
  const result: ConversationSummary[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function patchPages(
  data: InfiniteData<ConversationPage> | undefined,
  id: string,
  patch: ConversationPatch,
): InfiniteData<ConversationPage> | undefined {
  if (!data) return data;

  const remove = patch.isArchived === true || patch.isVisible === false;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: remove
        ? page.items.filter((item) => item.id !== id)
        : page.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.isStarred !== undefined ? { isStarred: patch.isStarred } : {}),
                }
              : item,
          ),
    })),
  };
}

function removeFromPages(
  data: InfiniteData<ConversationPage> | undefined,
  id: string,
): InfiniteData<ConversationPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => {
      const found = page.items.some((item) => item.id === id);
      return {
        ...page,
        items: page.items.filter((item) => item.id !== id),
        total: found && page.total !== null ? Math.max(0, page.total - 1) : page.total,
      };
    }),
  };
}

export function useConversationDelete() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteConversation(id);
      await dispatchAndCommit({ kind: 'conversation/delete', conversationId: id });
      return id;
    },
    onSuccess: (id) => {
      client.setQueriesData<InfiniteData<ConversationPage>>(
        { queryKey: conversationKeys.index },
        (data) => removeFromPages(data, id),
      );
      client.setQueriesData<InfiniteData<ConversationPage>>(
        { queryKey: ['conversations', 'search'] },
        (data) => removeFromPages(data, id),
      );
      client.removeQueries({ queryKey: conversationKeys.detail(id) });
      // ChatGPT's list endpoint can lag behind a successful delete. Refetching
      // right away makes the row reappear, so let the next natural fetch reconcile.
    },
  });
}

export function useConversationPatch() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ConversationPatch }) =>
      patchConversation(id, patch),
    onMutate: async ({ id, patch }) => {
      await client.cancelQueries({ queryKey: conversationKeys.all });
      const previous = client.getQueriesData<InfiniteData<ConversationPage>>({
        queryKey: conversationKeys.all,
      });
      client.setQueriesData<InfiniteData<ConversationPage>>(
        { queryKey: conversationKeys.all },
        (data) => patchPages(data, id, patch),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) client.setQueryData(key, data);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
