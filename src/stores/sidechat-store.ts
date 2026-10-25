import { create } from 'zustand';

export interface SideChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SideChatState {
  messages: SideChatMessage[];
  add: (message: SideChatMessage) => void;
  clear: () => void;
}

export const useSideChatStore = create<SideChatState>((set) => ({
  messages: [],
  add: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clear: () => set({ messages: [] }),
}));
