import type { MessageRole } from '@/data/schema';

export interface ConversationSummary {
  id: string;
  title: string;
  createTime: number | null;
  updateTime: number | null;
  isArchived: boolean;
  isStarred: boolean;
  gizmoId: string | null;
}

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  text: string;
  createTime: number | null;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createTime: number | null;
  updateTime: number | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface BackendStatus {
  ok: boolean;
  plan: string | null;
}
