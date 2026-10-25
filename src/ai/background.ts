import { browser } from 'wxt/browser';
import { getDb } from '@/data/db-service';
import { isTrustedSender } from '@/platform/messaging';
import { getApiKey } from '@/platform/secrets';
import type { SenderInfo } from '@/types/messages';
import { completeChat, testProvider, type ConnectionTestResult } from './client';
import { buildProviderConfig, permissionPattern } from './config';
import { AiError, errorPayload } from './errors';
import { buildPrompt } from './prompts';
import type { AiClientMessage, AiSemanticRequest, AiServerMessage } from './types';

async function resolveProvider(requestKind?: AiSemanticRequest['kind']) {
  const db = await getDb();
  const ai = db.settings.ai;
  const key = await getApiKey(ai.keyStorage);
  if (!key) throw new AiError('not_configured', 'Add an API key in Options.');
  const config = buildProviderConfig(ai, key);
  if (requestKind === 'followups' && ai.utilityModel.trim()) {
    config.model = ai.utilityModel.trim();
  }
  permissionPattern(config.baseUrl);
  return config;
}

async function ensureHostPermission(config: { baseUrl: string }): Promise<void> {
  const pattern = permissionPattern(config.baseUrl);
  const granted = await browser.permissions.contains({ origins: [pattern] });
  if (!granted) {
    throw new AiError(
      'host_permission_required',
      `Grant Anexo access to ${pattern} from the Options page.`,
    );
  }
}

export async function testAiConnection(): Promise<ConnectionTestResult> {
  const config = await resolveProvider();
  await ensureHostPermission(config);
  return testProvider(config);
}

function isSemanticRequest(value: unknown): value is AiSemanticRequest {
  if (value === null || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'optimizer' || kind === 'sideChat' || kind === 'followups';
}

async function runRequest(
  port: { postMessage: (message: AiServerMessage) => void },
  requestId: string,
  request: AiSemanticRequest,
  controller: AbortController,
): Promise<void> {
  const post = (message: AiServerMessage) => {
    try {
      port.postMessage(message);
    } catch {
      // The tab or port is gone.
    }
  };

  try {
    const config = await resolveProvider(request.kind);
    await ensureHostPermission(config);
    const prompt = buildPrompt(request);

    await completeChat(config, {
      messages: prompt.messages,
      maxTokens: Math.min(prompt.maxTokens, config.maxOutputTokens),
      stream: config.stream,
      signal: controller.signal,
      timeoutMs: request.kind === 'sideChat' ? 180_000 : 60_000,
      onDelta: (text) => post({ type: 'delta', requestId, text }),
    }).then((result) => {
      post({ type: 'done', requestId, text: result.text });
    });
  } catch (error) {
    const payload = errorPayload(error);
    post({ type: 'error', requestId, ...payload });
  }
}

export function registerAiPort(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'anexo-ai') return;
    if (!port.sender || !isTrustedSender(port.sender as SenderInfo)) {
      port.disconnect();
      return;
    }

    const controllers = new Map<string, AbortController>();

    port.onMessage.addListener((message: unknown) => {
      const value = message as AiClientMessage;
      if (value?.type === 'cancel' && typeof value.requestId === 'string') {
        controllers.get(value.requestId)?.abort();
        return;
      }

      if (
        value?.type !== 'start' ||
        typeof value.requestId !== 'string' ||
        !isSemanticRequest(value.request)
      ) {
        return;
      }

      const controller = new AbortController();
      controllers.set(value.requestId, controller);
      void runRequest(port, value.requestId, value.request, controller).finally(() => {
        controllers.delete(value.requestId);
      });
    });

    port.onDisconnect.addListener(() => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    });
  });
}
