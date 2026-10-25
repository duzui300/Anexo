import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  Inbox,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Folder } from '@/data/schema';
import {
  buildFolderTree,
  flattenFolderTree,
  folderDescendantIds,
  nextFolderOrder,
  siblingOrder,
} from '@/domain/folder-tree';
import { FOLDER_COLORS, folderColor, nextFolderColor } from '@/domain/folder-colors';
import { t } from '@/i18n';
import { dispatchAndCommit, updateSettings } from '@/stores/actions';
import { useDbStore, useSettings } from '@/stores/db-store';

export type FolderSelection = 'all' | 'unfiled' | string;
type DropPosition = 'before' | 'after' | 'inside';

interface FolderSectionProps {
  selected: FolderSelection;
  onSelect: (selection: FolderSelection) => void;
  onNewSubfolder: (parentId: string) => void;
  unfiledCount: number;
  allCount: number | null;
}

function RenameInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelled.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <input
      className="ax-input ax-folder-rename"
      value={draft}
      autoFocus
      aria-label={t('sidebar.rename')}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (cancelled.current) onCancel();
        else onCommit(draft);
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

function FolderRow({
  folder,
  depth,
  hasChildren,
  collapsed,
  selected,
  count,
  showCounts,
  isDragging,
  dropPosition,
  onSelect,
  onToggleCollapse,
  onNewSubfolder,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  folder: Folder;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  selected: boolean;
  count: number;
  showCounts: boolean;
  isDragging: boolean;
  dropPosition: DropPosition | null;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onNewSubfolder: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (position: DropPosition) => void;
  onDrop: (position: DropPosition) => void;
}) {
  const positionFor = (event: React.DragEvent<HTMLDivElement>): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    if (ratio < 0.28) return 'before';
    if (ratio > 0.72) return 'after';
    return 'inside';
  };
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const rename = async (name: string) => {
    setRenaming(false);
    const next = name.trim();
    if (!next || next === folder.name) return;
    await dispatchAndCommit({ kind: 'folder/update', id: folder.id, patch: { name: next } });
  };

  const cycleColor = () => {
    void dispatchAndCommit({
      kind: 'folder/update',
      id: folder.id,
      patch: { color: nextFolderColor(folder.color ?? FOLDER_COLORS[0]) },
    }).catch(() => {});
  };

  const remove = async () => {
    setConfirmingDelete(false);
    await dispatchAndCommit({ kind: 'folder/delete', id: folder.id, reassignTo: null });
  };

  return (
    <>
      <div
        className="ax-folder-row"
        data-selected={selected}
        data-dragging={isDragging}
        data-drop-position={dropPosition ?? undefined}
        style={{ paddingLeft: 4 + depth * 14 }}
        draggable
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', folder.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          event.preventDefault();
          onDragOver(positionFor(event));
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(positionFor(event));
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="ax-icon-btn ax-folder-row__chevron"
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse();
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <span className="ax-folder-row__chevron" />
        )}

        <button
          type="button"
          className="ax-folder-dot"
          style={{ background: folderColor(folder.color) }}
          aria-label={t('sidebar.changeColor')}
          title={t('sidebar.changeColor')}
          onClick={(event) => {
            event.stopPropagation();
            cycleColor();
          }}
        />

        {renaming ? (
          <RenameInput
            value={folder.name}
            onCommit={(name) => void rename(name)}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="ax-row-label" title={folder.name}>
            {folder.name}
          </span>
        )}

        {showCounts && count > 0 ? <span className="ax-row-badge">{count}</span> : null}

        <span className="ax-folder-row__actions">
          <button
            type="button"
            className="ax-icon-btn"
            title={t('sidebar.addSubfolder')}
            aria-label={t('sidebar.addSubfolder')}
            onClick={(event) => {
              event.stopPropagation();
              onNewSubfolder();
            }}
          >
            <FolderPlus size={13} />
          </button>
          <button
            type="button"
            className="ax-icon-btn"
            title={t('sidebar.rename')}
            aria-label={t('sidebar.rename')}
            onClick={(event) => {
              event.stopPropagation();
              setRenaming(true);
            }}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="ax-icon-btn"
            title={t('sidebar.deleteFolder')}
            aria-label={t('sidebar.deleteFolder')}
            onClick={(event) => {
              event.stopPropagation();
              setConfirmingDelete(true);
            }}
          >
            <Trash2 size={13} />
          </button>
        </span>
      </div>

      {confirmingDelete ? (
        <div className="ax-folder-confirm" onClick={(event) => event.stopPropagation()}>
          <span>{t('sidebar.deleteFolderConfirm', { name: folder.name })}</span>
          <div className="ax-inline">
            <button type="button" className="ax-btn ax-btn--danger" onClick={() => void remove()}>
              {t('common.delete')}
            </button>
            <button type="button" className="ax-btn" onClick={() => setConfirmingDelete(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FolderSection({
  selected,
  onSelect,
  onNewSubfolder,
  unfiledCount,
  allCount,
}: FolderSectionProps) {
  const db = useDbStore((state) => state.db);
  const settings = useSettings();
  const [shelfOpen, setShelfOpen] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; position: DropPosition } | null>(null);

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  const dropInto = async (
    dragged: string | null,
    target: Folder | null,
    position: DropPosition,
  ) => {
    if (!dragged || dragged === target?.id) return;
    try {
      const descendants = folderDescendantIds(db.folders, dragged);
      let parentId: string | null;
      let order: number;

      if (!target) {
        parentId = null;
        order = nextFolderOrder(db.folders, null);
      } else if (position === 'inside') {
        if (descendants.has(target.id)) return;
        parentId = target.id;
        order = nextFolderOrder(db.folders, target.id);
      } else {
        if (target.parentId && descendants.has(target.parentId)) return;
        parentId = target.parentId;
        const nextOrder = siblingOrder(db.folders, target.id, position);
        if (nextOrder === null) return;
        order = nextOrder;
      }

      await dispatchAndCommit({
        kind: 'folder/update',
        id: dragged,
        patch: { parentId, order },
      });
    } catch {
      // Cycle and reference errors are rejected by the command layer; leave the UI intact.
    } finally {
      endDrag();
    }
  };

  const collapsed = useMemo(
    () => new Set(settings.ui.collapsedFolderIds),
    [settings.ui.collapsedFolderIds],
  );
  const rows = useMemo(
    () => flattenFolderTree(buildFolderTree(db.folders), collapsed),
    [db.folders, collapsed],
  );
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const folderId of Object.values(db.conversationFolders)) {
      let current: string | null = folderId;
      const seen = new Set<string>();
      while (current && db.folders[current] && !seen.has(current)) {
        seen.add(current);
        result[current] = (result[current] ?? 0) + 1;
        current = db.folders[current]!.parentId;
      }
    }
    return result;
  }, [db.conversationFolders, db.folders]);

  const toggleCollapsed = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    void updateSettings({ ui: { collapsedFolderIds: [...next] } }).catch(() => {});
  };

  return (
    <div className="ax-sidebar__section ax-shelf">
      <button
        type="button"
        className="ax-sidebar__section-title ax-shelf__toggle"
        aria-expanded={shelfOpen}
        onClick={() => setShelfOpen((value) => !value)}
      >
        <span>{t('sidebar.folders')}</span>
        <ChevronDown className="ax-shelf__chevron" size={13} />
      </button>

      <div className="ax-shelf__pinned">
        <div
          className="ax-folder-row"
          data-selected={selected === 'all'}
          onClick={() => onSelect('all')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect('all');
            }
          }}
        >
          <span className="ax-folder-row__chevron" />
          <Inbox className="ax-row-icon" size={15} />
          <span className="ax-row-label">{t('sidebar.allChats')}</span>
          {settings.ui.sidebarShowCounts && allCount !== null ? (
            <span className="ax-row-badge">{allCount}</span>
          ) : null}
        </div>

        <div
          className="ax-folder-row"
          data-selected={selected === 'unfiled'}
          onClick={() => onSelect('unfiled')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect('unfiled');
            }
          }}
        >
          <span className="ax-folder-row__chevron" />
          <FolderIcon className="ax-row-icon" size={15} />
          <span className="ax-row-label">{t('sidebar.unfiled')}</span>
          {settings.ui.sidebarShowCounts && unfiledCount > 0 ? (
            <span className="ax-row-badge">{unfiledCount}</span>
          ) : null}
        </div>
      </div>

      {shelfOpen ? (
        <div className="ax-shelf__scroll">
          {rows.map(({ folder, depth, hasChildren }) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              depth={depth}
              hasChildren={hasChildren}
              collapsed={collapsed.has(folder.id)}
              selected={selected === folder.id}
              count={counts[folder.id] ?? 0}
              showCounts={settings.ui.sidebarShowCounts}
              isDragging={dragId === folder.id}
              dropPosition={over?.id === folder.id && dragId !== folder.id ? over.position : null}
              onSelect={() => onSelect(folder.id)}
              onToggleCollapse={() => toggleCollapsed(folder.id)}
              onNewSubfolder={() => onNewSubfolder(folder.id)}
              onDragStart={() => setDragId(folder.id)}
              onDragOver={(position) => {
                if (dragId && dragId !== folder.id) setOver({ id: folder.id, position });
              }}
              onDrop={(position) => void dropInto(dragId, folder, position)}
              onDragEnd={endDrag}
            />
          ))}

          {rows.length === 0 ? (
            <div className="ax-empty ax-empty--compact">
              {t('sidebar.emptyFolders')}
              <br />
              {t('sidebar.emptyHint')}
            </div>
          ) : null}

          <div
            className="ax-folder-dropzone"
            data-active={dragId !== null && over === null}
            onDragOver={(event) => {
              if (dragId) {
                event.preventDefault();
                setOver(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              void dropInto(dragId, null, 'inside');
            }}
          >
            {dragId ? t('sidebar.dropToRoot') : t('sidebar.dropHint')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
