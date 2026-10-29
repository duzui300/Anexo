import { SCHEMA_VERSION, type AnexoDb, type LocalFlags, type Settings } from './schema';

export const DEFAULT_SETTINGS: Settings = {
  locale: 'auto',
  theme: 'system',
  features: {
    sidebar: true,
    replaceNativeHistory: true,
    timestamps: true,
    rightRail: true,
    minimap: true,
    selectionActions: true,
    bookmarks: true,
    notes: true,
    promptLibrary: true,
    export: true,
    bulk: true,
    nativeTools: false,
    followUps: 'heuristic',
    promptOptimizer: true,
  },
  ui: {
    railOpen: false,
    railWidth: 320,
    railTab: 'minimap',
    minimapDepth: 'prompts',
    minimapAutoFollow: true,
    minimapCodeOnly: false,
    sidebarCollapsed: false,
    sidebarCompact: false,
    sidebarShowCounts: true,
    collapsedFolderIds: [],
  },
  ai: {
    enabled: false,
    preset: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    utilityModel: '',
    reasoningEffort: 'default',
    thinkingBudget: 0,
    temperature: 0.7,
    maxOutputTokens: 900,
    timeoutMs: 60_000,
    stream: true,
    keyStorage: 'device',
    keyHint: null,
    consentAt: null,
  },
};

export const DEFAULT_FLAGS: LocalFlags = {
  welcomeSeen: false,
  onboardingSeenAt: null,
  disclosureAcceptedAt: null,
  lastVersion: '0.3.2',
};

export function createDefaultDb(now = Date.now()): AnexoDb {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    updatedAt: now,
    folders: {},
    conversationFolders: {},
    bookmarks: {},
    notes: {},
    prompts: {},
    installedPacks: {},
    settings: structuredClone(DEFAULT_SETTINGS),
    flags: structuredClone(DEFAULT_FLAGS),
  };
}
