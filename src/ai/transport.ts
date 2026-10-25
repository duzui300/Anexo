import { browser } from 'wxt/browser';
import type { AiServerMessage, AiSemanticRequest } from './types';

export interface AiStreamHandlers {
  onDelta: (text: string) => void;
  onDone: (text: string) => void;
  onError: (code: string, message: string) => void;
}

export interface AiStreamHandle {
  cancel: () => void;
}

/** Content scripts send only semantic requests. Provider config and keys stay in the background. */
export function startAiRequest(
  request: AiSemanticRequest,
  handlers: AiStreamHandlers,
): AiStreamHandle {
  const port = browser.runtime.connect({ name: 'anexo-ai' });
  const requestId = crypto.randomUUID();
  let settled = false;
  let cancelled = false;

  const finish = (fn: () => void) => {
    if (settled) return;
    settled = true;
    fn();
    try {
      port.disconnect();
    } catch {
      // Already disconnected.
    }
  };

  port.onMessage.addListener((message: AiServerMessage) => {
    if (message.requestId !== requestId) return;

    if (message.type === 'delta') {
      handlers.onDelta(message.text);
      return;
    }
    if (message.type === 'done') {
      finish(() => handlers.onDone(message.text));
      return;
    }
    if (message.type === 'error') {
      finish(() => handlers.onError(message.code, message.message));
    }
  });

  port.onDisconnect.addListener(() => {
    if (settled || cancelled) return;
    settled = true;
    handlers.onError('network', 'The AI connection closed unexpectedly.');
  });

  try {
    port.postMessage({ type: 'start', requestId, request });
  } catch (error) {
    finish(() =>
      handlers.onError(
        'network',
        error instanceof Error ? error.message : 'Could not reach the Anexo background.',
      ),
    );
  }

  return {
    cancel: () => {
      if (settled) return;
      cancelled = true;
      settled = true;
      try {
        port.postMessage({ type: 'cancel', requestId });
      } catch {
        // Ignore.
      }
      try {
        port.disconnect();
      } catch {
        // Ignore.
      }
    },
  };
}
