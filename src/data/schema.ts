import { z } from 'zod';

export const SCHEMA_VERSION = 1;

const idSchema = z.string().min(1).max(128);
const timestampSchema = z.number().int().nonnegative();
const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a 6-digit hex color')
  .nullable();

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool', 'unknown']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const FolderSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  color: colorSchema,
  parentId: idSchema.nullable(),
  order: z.number().finite(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Folder = z.infer<typeof FolderSchema>;

export const BookmarkSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  messageId: z.string().max(256).nullable(),
  messageIndex: z.number().int().nonnegative(),
  role: MessageRoleSchema,
  preview: z.string().max(500),
  conversationTitle: z.string().max(300).nullable(),
  createdAt: timestampSchema,
});
export type Bookmark = z.infer<typeof BookmarkSchema>;

export const NoteSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  messageId: z.string().max(256).nullable(),
  messageIndex: z.number().int().nonnegative(),
  role: MessageRoleSchema,
  anchorText: z.string().max(2_000).nullable(),
  text: z.string().min(1).max(20_000),
  conversationTitle: z.string().max(300).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  orphaned: z.boolean(),
});
export type Note = z.infer<typeof NoteSchema>;

export const PromptSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(128),
  content: z.string().min(1).max(20_000),
  source: z.string().min(1).max(200),
  sourceMessageId: z.string().max(256).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Prompt = z.infer<typeof PromptSchema>;

export const InstalledPackSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  version: z.string().min(1).max(64),
  installedAt: timestampSchema,
});
export type InstalledPack = z.infer<typeof InstalledPackSchema>;

export const FollowUpsModeSchema = z.enum(['off', 'heuristic', 'ai']);
export type FollowUpsMode = z.infer<typeof FollowUpsModeSchema>;

export const ThemeSchema = z.enum(['system', 'light', 'dark']);
export type Theme = z.infer<typeof ThemeSchema>;

export const AiPresetSchema = z.enum([
  'openai',
  'anthropic',
  'openrouter',
  'groq',
  'ollama',
  'lmstudio',
  'custom',
]);
export type AiPreset = z.infer<typeof AiPresetSchema>;

export const FeatureSettingsSchema = z.object({
  sidebar: z.boolean(),
  replaceNativeHistory: z.boolean(),
  timestamps: z.boolean(),
  rightRail: z.boolean(),
  minimap: z.boolean(),
  selectionActions: z.boolean(),
  bookmarks: z.boolean(),
  notes: z.boolean(),
  promptLibrary: z.boolean(),
  export: z.boolean(),
  bulk: z.boolean(),
  nativeTools: z.boolean(),
  followUps: FollowUpsModeSchema,
  promptOptimizer: z.boolean(),
});
export type FeatureSettings = z.infer<typeof FeatureSettingsSchema>;

export const UiSettingsSchema = z.object({
  railOpen: z.boolean(),
  railWidth: z.number().int().min(240).max(720),
  railTab: z.enum(['minimap', 'bookmarks', 'notes', 'sideChat', 'followups']),
  minimapDepth: z.enum(['prompts', 'all']),
  minimapAutoFollow: z.boolean(),
  minimapCodeOnly: z.boolean(),
  sidebarCollapsed: z.boolean(),
  sidebarCompact: z.boolean(),
  sidebarShowCounts: z.boolean(),
  collapsedFolderIds: z.array(z.string()),
});
export type UiSettings = z.infer<typeof UiSettingsSchema>;

export const ReasoningEffortSchema = z.enum(['default', 'none', 'low', 'medium', 'high', 'max']);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

export const AiSettingsSchema = z.object({
  enabled: z.boolean(),
  preset: AiPresetSchema,
  baseUrl: z.string().max(500),
  model: z.string().max(200),
  utilityModel: z.string().max(200),
  reasoningEffort: ReasoningEffortSchema,
  thinkingBudget: z.number().int().min(0).max(100_000),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().min(1).max(32_768),
  timeoutMs: z.number().int().min(5_000).max(300_000),
  stream: z.boolean(),
  keyStorage: z.enum(['device', 'session']),
  keyHint: z.string().max(8).nullable(),
  consentAt: timestampSchema.nullable(),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const SettingsSchema = z.object({
  locale: z.string().max(32),
  theme: ThemeSchema,
  features: FeatureSettingsSchema,
  ui: UiSettingsSchema,
  ai: AiSettingsSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

export const LocalFlagsSchema = z.object({
  welcomeSeen: z.boolean(),
  onboardingSeenAt: timestampSchema.nullable(),
  disclosureAcceptedAt: timestampSchema.nullable(),
  lastVersion: z.string().max(32),
});
export type LocalFlags = z.infer<typeof LocalFlagsSchema>;

export const DbSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  revision: z.number().int().nonnegative(),
  updatedAt: timestampSchema,
  folders: z.record(z.string(), FolderSchema),
  conversationFolders: z.record(z.string(), idSchema),
  bookmarks: z.record(z.string(), BookmarkSchema),
  notes: z.record(z.string(), NoteSchema),
  prompts: z.record(z.string(), PromptSchema),
  installedPacks: z.record(z.string(), InstalledPackSchema),
  settings: SettingsSchema,
  flags: LocalFlagsSchema,
});
export type AnexoDb = z.infer<typeof DbSchema>;

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
