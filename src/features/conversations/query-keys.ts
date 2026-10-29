export const conversationKeys = {
  all: ['conversations'] as const,
  index: ['conversations', 'index'] as const,
  detail: (id: string) => ['conversations', 'detail', id] as const,
  search: (query: string) => ['conversations', 'search', query] as const,
};
