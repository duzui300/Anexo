import { create } from 'zustand';
import type { MessageRole } from '@/data/schema';

export type CommandCenterSection = 'general' | 'library' | 'about';

export interface NoteTarget {
  conversationId: string;
  conversationTitle: string | null;
  messageId: string | null;
  messageIndex: number;
  role: MessageRole;
  anchorText: string | null;
}

interface UiState {
  commandCenterOpen: boolean;
  commandCenterSection: CommandCenterSection;
  optimizerOpen: boolean;
  optimizerInput: string;
  promptPaletteOpen: boolean;
  noteTarget: NoteTarget | null;
  openCommandCenter: (section?: CommandCenterSection) => void;
  closeCommandCenter: () => void;
  openOptimizer: (input: string) => void;
  closeOptimizer: () => void;
  openPromptPalette: () => void;
  closePromptPalette: () => void;
  openNoteTarget: (target: NoteTarget) => void;
  closeNoteTarget: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandCenterOpen: false,
  commandCenterSection: 'general',
  optimizerOpen: false,
  optimizerInput: '',
  promptPaletteOpen: false,
  noteTarget: null,
  openCommandCenter: (section = 'general') =>
    set({ commandCenterOpen: true, commandCenterSection: section }),
  closeCommandCenter: () => set({ commandCenterOpen: false, commandCenterSection: 'general' }),
  openOptimizer: (input) => set({ optimizerOpen: true, optimizerInput: input }),
  closeOptimizer: () => set({ optimizerOpen: false }),
  openPromptPalette: () => set({ promptPaletteOpen: true }),
  closePromptPalette: () => set({ promptPaletteOpen: false }),
  openNoteTarget: (target) => set({ noteTarget: target }),
  closeNoteTarget: () => set({ noteTarget: null }),
}));
