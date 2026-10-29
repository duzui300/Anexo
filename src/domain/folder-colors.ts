export const FOLDER_COLORS = [
  '#6b4f3a',
  '#8b9d77',
  '#b08968',
  '#a65b45',
  '#667a55',
  '#c9a26b',
  '#7a6a58',
  '#9e8c6a',
] as const;

/** Older folders may still carry the original saturated palette. */
const LEGACY_COLORS: Record<string, string> = {
  '#14b8a6': '#8b9d77',
  '#0ea5e9': '#6f845d',
  '#6366f1': '#6b4f3a',
  '#8b5cf6': '#7a6a58',
  '#ec4899': '#a65b45',
  '#f59e0b': '#c9a26b',
  '#ef4444': '#a65b45',
  '#84cc16': '#667a55',
};

/** Maps the legacy palette onto the warm organic one without rewriting stored data. */
export function folderColor(color: string | null | undefined): string {
  if (!color) return FOLDER_COLORS[0];
  return LEGACY_COLORS[color] ?? color;
}

export function nextFolderColor(current: string): string {
  const index = FOLDER_COLORS.indexOf(folderColor(current) as (typeof FOLDER_COLORS)[number]);
  return FOLDER_COLORS[(index + 1) % FOLDER_COLORS.length]!;
}
