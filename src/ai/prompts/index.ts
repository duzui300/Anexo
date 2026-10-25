import type { ChatMessage, AiSemanticRequest } from '../types';
import { buildFollowupMessages } from './followups';
import { buildOptimizerMessages } from './optimizer';
import { buildSideChatMessages } from './side-chat';

export interface BuiltPrompt {
  messages: ChatMessage[];
  maxTokens: number;
}

export function buildPrompt(request: AiSemanticRequest): BuiltPrompt {
  if (request.kind === 'optimizer') {
    return {
      messages: buildOptimizerMessages(request.input, request.context),
      maxTokens: 700,
    };
  }

  if (request.kind === 'sideChat') {
    return {
      messages: buildSideChatMessages(request),
      maxTokens: 900,
    };
  }

  return {
    messages: buildFollowupMessages(request.context),
    maxTokens: 900,
  };
}

export { extractEnhanced } from './optimizer';
export { parseFollowups } from './followups';
