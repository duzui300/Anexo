import type { Folder } from '@/data/schema';

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  depth: number;
}

export interface FlatFolder {
  folder: Folder;
  depth: number;
  hasChildren: boolean;
}

function sortFolders(a: Folder, b: Folder): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

export function buildFolderTree(folders: Record<string, Folder>): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  const ids = new Set(Object.keys(folders));

  for (const folder of Object.values(folders)) {
    const parentId =
      folder.parentId && folder.parentId !== folder.id && ids.has(folder.parentId)
        ? folder.parentId
        : null;
    const siblings = byParent.get(parentId);
    if (siblings) siblings.push(folder);
    else byParent.set(parentId, [folder]);
  }

  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number): FolderNode[] => {
    const nodes: FolderNode[] = [];
    for (const folder of (byParent.get(parentId) ?? []).slice().sort(sortFolders)) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      nodes.push({ folder, depth, children: walk(folder.id, depth + 1) });
    }
    return nodes;
  };

  const tree = walk(null, 0);

  // Orphans and cycles that were never reachable from a root still need to
  // appear so the user can fix them instead of losing data.
  for (const folder of Object.values(folders).sort(sortFolders)) {
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    tree.push({ folder, depth: 0, children: [] });
  }

  return tree;
}

export function flattenFolderTree(
  nodes: readonly FolderNode[],
  collapsed: ReadonlySet<string>,
): FlatFolder[] {
  const result: FlatFolder[] = [];
  const walk = (list: readonly FolderNode[]) => {
    for (const node of list) {
      result.push({
        folder: node.folder,
        depth: node.depth,
        hasChildren: node.children.length > 0,
      });
      if (!collapsed.has(node.folder.id)) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export function folderDescendantIds(
  folders: Record<string, Folder>,
  rootId: string,
): Set<string> {
  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const folder of Object.values(folders)) {
      if (folder.parentId === current && !result.has(folder.id)) {
        result.add(folder.id);
        queue.push(folder.id);
      }
    }
  }
  return result;
}

export function nextFolderOrder(
  folders: Record<string, Folder>,
  parentId: string | null,
): number {
  let max = 0;
  for (const folder of Object.values(folders)) {
    if (folder.parentId !== parentId) continue;
    max = Math.max(max, folder.order);
  }
  return max + 100;
}

/**
 * Order value for dropping a folder before or after a sibling. Uses midpoints so an
 * insert does not require rewriting the other orders.
 */
export function siblingOrder(
  folders: Record<string, Folder>,
  targetId: string,
  position: 'before' | 'after',
): number | null {
  const target = folders[targetId];
  if (!target) return null;

  const siblings = Object.values(folders)
    .filter((folder) => folder.parentId === target.parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const index = siblings.findIndex((folder) => folder.id === targetId);

  if (position === 'before') {
    const previous = siblings[index - 1];
    return previous ? (previous.order + target.order) / 2 : target.order - 100;
  }

  const next = siblings[index + 1];
  return next ? (target.order + next.order) / 2 : target.order + 100;
}

export function folderLabel(folders: Record<string, Folder>, id: string): string {
  return folders[id]?.name ?? 'Unfiled';
}
