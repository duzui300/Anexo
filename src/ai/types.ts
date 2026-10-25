import type { ReasoningEffort } from '@/data/schema';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  stream: boolean;
  reasoningEffort: ReasoningEffort;
  thinkingBudget: number;
}

export interface OptimizerContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AiSemanticRequest =
  | { kind: 'optimizer'; input: string; context: OptimizerContextMessage[] }
  | {
      kind: 'sideChat';
      question: string;
      selection: string;
      context: string;
      history: { role: 'user' | 'assistant'; content: string }[];
    }
  | { kind: 'followups'; context: string };

export interface AiStartMessage {
  type: 'start';
  requestId: string;
  request: AiSemanticRequest;
}

export interface AiCancelMessage {
  type: 'cancel';
  requestId: string;
}

export type AiClientMessage = AiStartMessage | AiCancelMessage;

export type AiServerMessage =
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'done'; requestId: string; text: string }
  | { type: 'error'; requestId: string; code: string; message: string };
