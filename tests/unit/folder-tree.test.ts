import { describe, expect, it } from 'vitest';
import type { Folder } from '../../src/data/schema';
import {
  buildFolderTree,
  flattenFolderTree,
  folderDescendantIds,
  nextFolderOrder,
  siblingOrder,
} from '../../src/domain/folder-tree';

function makeFolder(id: string, patch: Partial<Folder> = {}): Folder {
  return {
    id,
    name: id,
    color: '#14b8a6',
    parentId: null,
    order: 100,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

describe('buildFolderTree', () => {
  it('sorts siblings by order and nests children', () => {
    const tree = buildFolderTree({
      b: makeFolder('b', { order: 200 }),
      a: makeFolder('a', { order: 100 }),
      child: makeFolder('child', { parentId: 'a', order: 50 }),
      grandchild: makeFolder('grandchild', { parentId: 'child', order: 10 }),
    });

    expect(tree.map((node) => node.folder.id)).toEqual(['a', 'b']);
    expect(tree[0]?.children[0]?.folder.id).toBe('child');
    expect(tree[0]?.children[0]?.children[0]?.folder.id).toBe('grandchild');
  });

  it('keeps orphans and cycles visible at the root', () => {
    const tree = buildFolderTree({
      orphan: makeFolder('orphan', { parentId: 'missing' }),
      a: makeFolder('a', { parentId: 'b' }),
      b: makeFolder('b', { parentId: 'a' }),
    });
    expect(tree).toHaveLength(3);
  });
});

describe('flattenFolderTree', () => {
  it('hides children of collapsed folders', () => {
    const tree = buildFolderTree({
      a: makeFolder('a'),
      child: makeFolder('child', { parentId: 'a' }),
      b: makeFolder('b', { order: 200 }),
    });

    expect(flattenFolderTree(tree, new Set()).map((row) => row.folder.id)).toEqual([
      'a',
      'child',
      'b',
    ]);
    expect(flattenFolderTree(tree, new Set(['a'])).map((row) => row.folder.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('folder helpers', () => {
  it('collects descendants without recursing forever on cycles', () => {
    const folders = {
      a: makeFolder('a'),
      b: makeFolder('b', { parentId: 'a' }),
      c: makeFolder('c', { parentId: 'b' }),
      loop: makeFolder('loop', { parentId: 'c' }),
    };
    folders.a.parentId = 'loop';

    expect([...folderDescendantIds(folders, 'a')].sort()).toEqual(['a', 'b', 'c', 'loop']);
  });

  it('returns a sibling order above the current maximum', () => {
    const folders = {
      a: makeFolder('a', { order: 300 }),
      b: makeFolder('b', { order: 100 }),
      child: makeFolder('child', { parentId: 'a', order: 900 }),
    };
    expect(nextFolderOrder(folders, null)).toBe(400);
    expect(nextFolderOrder(folders, 'a')).toBe(1000);
  });

  it('computes midpoint orders for sibling drops', () => {
    const folders = {
      a: makeFolder('a', { order: 100 }),
      b: makeFolder('b', { order: 200 }),
      c: makeFolder('c', { order: 300 }),
      child: makeFolder('child', { parentId: 'a', order: 100 }),
    };

    expect(siblingOrder(folders, 'b', 'before')).toBe(150);
    expect(siblingOrder(folders, 'b', 'after')).toBe(250);
    expect(siblingOrder(folders, 'a', 'before')).toBe(0);
    expect(siblingOrder(folders, 'c', 'after')).toBe(400);
    expect(siblingOrder(folders, 'child', 'after')).toBe(200);
    expect(siblingOrder(folders, 'missing', 'after')).toBeNull();
  });
});
