const COMPOSER_SELECTORS = [
  '#prompt-textarea',
  '[data-testid="composer-text-input"]',
  'div[contenteditable="true"][data-virtualkeyboard="true"]',
  '[contenteditable="true"][data-testid*="input"]',
  'textarea[placeholder*="Message"]',
  'textarea[data-id="root"]',
];

const SEND_SELECTORS = [
  '[data-testid="send-button"]',
  'form[data-chatgpt-composer] button[type="submit"]',
  'button#composer-submit-button',
  'button[aria-label*="Send"]',
];

const STOP_SELECTORS = [
  '[data-testid="stop-button"]',
  'form[data-chatgpt-composer] button[aria-label="Stop"]',
  '[data-testid*="stop"]',
];

const ASSISTANT_SELECTORS = [
  '[data-message-author-role="assistant"]',
  '[data-chatgpt-search-unit-key$=":assistant"]',
];

const CONTENT_SELECTORS = [
  '.markdown',
  '.prose',
  '[data-markdown-text-style="assistant-message"]',
  '[data-message-content]',
];

export function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function getVisibleMain(): HTMLElement | null {
  const mains = Array.from(document.querySelectorAll<HTMLElement>('main'));
  return mains.find(isVisible) ?? mains[0] ?? null;
}

const CHAT_HISTORY_NAV_SELECTORS = [
  'nav[aria-label="Chat history" i]',
  'nav[aria-label*="chat history" i]',
  'nav[aria-label*="聊天记录"]',
  'nav[aria-label*="聊天歷史"]',
  'nav[aria-label*="历史记录"]',
];

function findChatHistoryNav(): HTMLElement | null {
  for (const selector of CHAT_HISTORY_NAV_SELECTORS) {
    const nav = document.querySelector<HTMLElement>(selector);
    if (nav) return nav;
  }
  return null;
}

function findHistoryList(ds: HTMLElement): HTMLElement | null {
  const labeled = ds.querySelector<HTMLElement>(
    'nav[aria-label="Chat history" i], nav[aria-label*="chat history" i], nav[aria-label*="聊天"]',
  );
  if (labeled) return labeled;

  // Fall back to the prominent scrollable region inside the sidebar shell.
  return (
    Array.from(ds.querySelectorAll<HTMLElement>('div, section, nav')).find((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        rect.width >= 150 &&
        rect.height >= 160
      );
    }) ?? null
  );
}

export type SidebarDock = 'history' | 'nav';

export interface SidebarMount {
  parent: HTMLElement;
  /** Insert immediately after this element; null means prepend. */
  after: Element | null;
  dock: SidebarDock;
}

/**
 * ChatGPT has used several sidebar shapes: a `#history` nav (older) and an
 * `#ds-sidebar` shell with a nested `nav[aria-label="Chat history"]` (current).
 * Anexo belongs at the top of the history list, below the native shortcuts.
 */
export function getSidebarMount(): SidebarMount | null {
  const legacy = document.querySelector<HTMLElement>('#history');
  if (legacy) {
    return { parent: legacy, after: null, dock: 'history' };
  }

  const ds =
    document.querySelector<HTMLElement>('#ds-sidebar') ??
    document.querySelector<HTMLElement>(
      'aside[aria-label="侧边栏"], aside[aria-label="Sidebar" i]',
    );
  if (ds) {
    const list = findHistoryList(ds);
    if (list) return { parent: list, after: null, dock: 'history' };
    return null;
  }

  const nav = findChatHistoryNav();
  if (nav) {
    return { parent: nav, after: null, dock: 'nav' };
  }

  return null;
}

export function getHistoryRoot(): HTMLElement | null {
  return getSidebarMount()?.parent ?? null;
}

function realConversationId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // Keep the raw value when it is not valid percent-encoding.
  }
  // A brand-new chat gets a temporary local id (local-chatgpt:<uuid>). It is
  // replaced by the real conversation id after the first message.
  return /^local-chatgpt(?::|$)/i.test(id) ? null : id;
}

export function getConversationId(url: string = location.href): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/c\/([^/]+)/i);
    if (pathMatch?.[1]) return realConversationId(pathMatch[1]);

    const queryId =
      parsed.searchParams.get('conversation') ??
      parsed.searchParams.get('conversationId') ??
      parsed.searchParams.get('c');
    if (queryId) return realConversationId(queryId);

    const hashMatch = parsed.hash.match(/(?:conversation|conversationId|c)=([^&]+)/i);
    return realConversationId(hashMatch?.[1]);
  } catch {
    return null;
  }
}

function firstVisible(selectors: string[], root: ParentNode = document): HTMLElement | null {
  for (const selector of selectors) {
    const elements = root.querySelectorAll<HTMLElement>(selector);
    for (const element of elements) {
      if (isVisible(element)) return element;
    }
  }
  return null;
}

export function getComposer(): HTMLElement | null {
  return firstVisible(COMPOSER_SELECTORS);
}

export function getSendButton(): HTMLElement | null {
  return firstVisible(SEND_SELECTORS);
}

export function getStopButton(): HTMLElement | null {
  return firstVisible(STOP_SELECTORS);
}

export function getAssistantNodes(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ASSISTANT_SELECTORS.join(',')));
}

export function getAssistantContent(node: Element): HTMLElement | null {
  for (const selector of CONTENT_SELECTORS) {
    const content = node.querySelector<HTMLElement>(selector);
    if (content) return content;
  }
  return null;
}

export function getMessageId(element: Element): string | null {
  const dataset = (element as HTMLElement).dataset;
  const candidate =
    dataset.messageId ??
    dataset.messageUuid ??
    (element.id && /^[a-z0-9_-]{16,}$/i.test(element.id) ? element.id : null);
  return candidate ?? null;
}

export function getTurnIndex(element: Element): number | null {
  const turn = element.closest<HTMLElement>('[data-testid^="conversation-turn-"]');
  const value = turn?.dataset.testid ?? turn?.getAttribute('data-testid');
  const match = value?.match(/conversation-turn-(\d+)/);
  return match?.[1] ? Math.max(0, Number.parseInt(match[1], 10) - 1) : null;
}

export function getMessageRole(element: Element): string | null {
  const dataset = (element as HTMLElement).dataset;
  return (
    dataset.messageAuthorRole ??
    dataset.authorRole ??
    dataset.turn ??
    element.getAttribute('data-message-author-role') ??
    null
  );
}

export function getMessageNodes(root: ParentNode = document): HTMLElement[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-message-author-role], [data-chatgpt-search-unit-key$=":assistant"]',
    ),
  );
  return nodes.filter((node, index) => nodes.indexOf(node) === index);
}

export interface Capabilities {
  sidebar: boolean;
  composer: boolean;
  messageIds: boolean;
  toolbar: boolean;
  streaming: boolean;
  historyApi: boolean;
  assistantContent: boolean;
}

export function probeCapabilities(): Capabilities {
  const messageNodes = getMessageNodes();
  return {
    sidebar: getHistoryRoot() !== null,
    composer: getComposer() !== null,
    messageIds: messageNodes.some((node) => getMessageId(node) !== null),
    toolbar:
      document.querySelector(
        '[data-testid*="copy-turn"], .turn-actions, [class*="turn-actions"]',
      ) !== null,
    streaming:
      document.querySelector('.result-streaming, [data-message-streaming], .cursor-blink') !==
        null || getStopButton() !== null,
    historyApi: getConversationId() !== null,
    assistantContent: messageNodes.some((node) => getAssistantContent(node) !== null),
  };
}
