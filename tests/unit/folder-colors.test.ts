import { describe, expect, it } from 'vitest';
import { FOLDER_COLORS, folderColor, nextFolderColor } from '@/domain/folder-colors';

describe('folder colors', () => {
  it('maps the legacy palette onto warm swatches', () => {
    expect(folderColor('#14b8a6')).toBe('#8b9d77');
    expect(folderColor('#0ea5e9')).toBe('#6f845d');
    expect(folderColor('#6366f1')).toBe('#6b4f3a');
  });

  it('keeps unknown colors and falls back for empty values', () => {
    expect(folderColor('#123456')).toBe('#123456');
    expect(folderColor(null)).toBe(FOLDER_COLORS[0]);
    expect(folderColor(undefined)).toBe(FOLDER_COLORS[0]);
  });

  it('cycles through the warm palette and wraps', () => {
    expect(nextFolderColor(FOLDER_COLORS[0])).toBe(FOLDER_COLORS[1]);
    expect(nextFolderColor(FOLDER_COLORS[FOLDER_COLORS.length - 1]!)).toBe(FOLDER_COLORS[0]);
    expect(nextFolderColor('#14b8a6')).toBe(FOLDER_COLORS[2]);
  });
});
