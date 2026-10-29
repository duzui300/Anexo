import { browser } from 'wxt/browser';
import type { RuntimeRequest, RuntimeResult, SenderInfo } from '@/types/messages';

const REQUEST_TYPES = new Set<RuntimeRequest['type']>([
  'db:snapshot',
  'db:command',
  'ui:openCommandCenter',
  'ui:openOptions',
  'ai:test',
]);

export function isRuntimeRequest(value: unknown): value is RuntimeRequest {
  if (value === null || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && REQUEST_TYPES.has(type as RuntimeRequest['type']);
}

export function isTrustedSender(sender: SenderInfo): boolean {
  if (sender.id !== browser.runtime.id) return false;
  const url = sender.url ?? sender.tab?.url ?? '';
  if (url.startsWith('https://chatgpt.com/') || url.startsWith('https://chat.openai.com/')) {
    return true;
  }
  return url.startsWith(browser.runtime.getURL(''));
}

export async function request<T>(message: RuntimeRequest): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as RuntimeResult<T> | undefined;
  if (!response) throw new Error('Anexo background did not respond');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

type Handler = (message: RuntimeRequest, sender: SenderInfo) => Promise<unknown>;

export function registerRequestHandler(handler: Handler): void {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isRuntimeRequest(message)) return false;

    const senderInfo = sender as SenderInfo;
    if (!isTrustedSender(senderInfo)) {
      sendResponse({ ok: false, error: 'Untrusted sender' } satisfies RuntimeResult<never>);
      return false;
    }

    handler(message, senderInfo).then(
      (data) => sendResponse({ ok: true, data } satisfies RuntimeResult<unknown>),
      (error: unknown) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies RuntimeResult<never>),
    );
    return true;
  });
}
