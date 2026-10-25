import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { CheckSquare, Download, Plus, Square, Star, MoreHorizontal } from 'lucide-react';
import { ChatGptApiError } from '@/chatgpt/client';
import { getConversation } from '@/chatgpt/conversations';
import { getConversationId } from '@/chatgpt/selectors';
import type { Folder } from '@/data/schema';
import { downloadBlob, downloadText } from '@/data/import-export';
import { folderColor } from '@/domain/folder-colors';
import { buildFolderTree, flattenFolderTree } from '@/domain/folder-tree';
import {
  conversationFileName,
  conversationToHtml,
  conversationToMarkdown,
} from '@/domain/export-conversation';
import { buildConversationZip } from '@/domain/export-bulk';
import { groupByTimeBucket, type TimeBucket } from '@/domain/time-buckets';
import type { ConversationDetail, ConversationSummary } from '@/types/chatgpt';
import { t, type MessageKey } from '@/i18n';
import { dispatchAndCommit } from '@/stores/actions';
import { useConversationDelete, useConversationPatch } from '@/features/conversations/hooks';
import type { FolderSelection } from './FolderSection';
import { clearPendingFolderForNewChat, rememberFolderForNewChat } from './pending-folder';

const TIME_KEYS: Record<TimeBucket, MessageKey> = {
  today: 'time.today',
  yesterday: 'time.yesterday',
  previousWeek: 'time.previousWeek',
  previousMonth: 'time.previousMonth',
  older: 'time.older',
};

function ChatRenameInput({
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

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
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
      className="ax-input ax-conv-rename"
      value={draft}
      autoFocus
      aria-label={t('sidebar.renameChat')}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (cancelled.current) onCancel();
        else onCommit(draft);
      }}
    />
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ChatGptApiError) {
    if (error.status === 401) return t('sidebar.signIn');
    if (error.status === 429) return t('sidebar.rateLimited');
  }
  return t('sidebar.loadFailed');
}

function deleteErrorMessage(error: unknown): string {
  if (error instanceof ChatGptApiError) {
    if (error.status === 401) return t('sidebar.signIn');
    if (error.status === 429) return t('sidebar.rateLimited');
  }
  return t('sidebar.deleteFailed');
}

interface ConversationSectionProps {
  items: ConversationSummary[];
  total: number | null;
  loading: boolean;
  error: unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  searchQuery: string;
  selected: FolderSelection;
  knownConversationIds: string[];
  folders: Record<string, Folder>;
  assignments: Record<string, string>;
  bulkEnabled: boolean;
}

export function ConversationSection({
  items,
  total,
  loading,
  error,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  searchQuery,
  selected,
  knownConversationIds,
  folders,
  assignments,
  bulkEnabled,
}: ConversationSectionProps) {
  const patch = useConversationPatch();
  const deleteChat = useConversationDelete();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPlacement, setMenuPlacement] = useState({
    top: 0,
    left: 0,
    up: false,
    maxHeight: 320,
  });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteNotice, setBulkDeleteNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState('unfiled');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkExportNotice, setBulkExportNotice] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;

  const folderOptions = useMemo(
    () => flattenFolderTree(buildFolderTree(folders), new Set()),
    [folders],
  );
  const groups = useMemo(() => groupByTimeBucket(items, (item) => item.updateTime), [items]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage]);

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const inside = event
        .composedPath()
        .some(
          (node) =>
            node instanceof Element &&
            (node.classList.contains('ax-conv-menu') ||
              node.classList.contains('ax-conv-row__menu-btn')),
        );
      if (!inside) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const scroller = menuButtonRef.current?.closest('.ax-conv-section');
    scroller?.addEventListener('scroll', close, { passive: true });
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      scroller?.removeEventListener('scroll', close);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuId]);

  const toggleMenu = (conversationId: string, button: HTMLButtonElement) => {
    if (menuId === conversationId) {
      setMenuId(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const margin = 8;
    const width = 240;
    const below = window.innerHeight - rect.bottom - margin * 2;
    const above = rect.top - margin * 2;
    const up = below < 300 && above > below;
    setMenuPlacement({
      top: up ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin)),
      up,
      maxHeight: Math.max(200, Math.min(460, up ? above : below)),
    });
    menuButtonRef.current = button;
    setMenuId(conversationId);
    setConfirmDeleteId(null);
    setDeleteError(null);
  };

  const title =
    selected === 'all'
      ? t('sidebar.allChats')
      : selected === 'unfiled'
        ? t('sidebar.unfiled')
        : (folders[selected]?.name ?? t('sidebar.unfiled'));

  const move = async (id: string, folderId: string | null) => {
    setMenuId(null);
    await dispatchAndCommit({ kind: 'conversation/move', conversationId: id, folderId });
  };

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`https://chatgpt.com/c/${id}`);
      setCopiedId(id);
    } catch {
      setCopiedId(null);
    }
  };

  const exportConversation = async (id: string, format: 'md' | 'html') => {
    if (exportingId) return;
    setExportingId(id);
    setMenuId(null);
    setExportNotice(null);
    try {
      const detail = await getConversation(id);
      if (!detail) throw new Error(t('sidebar.exportFailed'));
      const text = format === 'md' ? conversationToMarkdown(detail) : conversationToHtml(detail);
      downloadText(
        conversationFileName(detail, format),
        text,
        format === 'md' ? 'text/markdown;charset=utf-8' : 'text/html;charset=utf-8',
      );
    } catch {
      setExportNotice(t('sidebar.exportFailed'));
      window.setTimeout(() => setExportNotice(null), 3000);
    } finally {
      setExportingId(null);
    }
  };

  const toggleSelectMode = () => {
    setSelecting((current) => !current);
    setSelectedIds(new Set());
    setBulkConfirm(false);
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const bulkStar = (starred: boolean) => {
    for (const id of selectedIds) patch.mutate({ id, patch: { isStarred: starred } });
    setSelectedIds(new Set());
  };

  const bulkArchive = () => {
    for (const id of selectedIds) patch.mutate({ id, patch: { isArchived: true } });
    setSelectedIds(new Set());
    setBulkConfirm(false);
  };

  const bulkDelete = async () => {
    if (!bulkConfirm) {
      setBulkConfirm(true);
      setBulkDeleteNotice(null);
      return;
    }
    if (selectedIds.size === 0 || bulkDeleting) return;

    setBulkDeleting(true);
    setBulkDeleteNotice(null);
    const failed: string[] = [];
    for (const id of selectedIds) {
      try {
        await deleteChat.mutateAsync(id);
      } catch {
        failed.push(id);
      }
    }
    setBulkDeleting(false);
    setBulkConfirm(false);
    setSelectedIds(new Set(failed));
    if (failed.length > 0) {
      setBulkDeleteNotice(t('sidebar.bulkDeleteFailed', { count: String(failed.length) }));
    }
  };

  const removeConversation = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteChat.mutateAsync(id);
      setConfirmDeleteId(null);
      setMenuId(null);
    } catch (error) {
      setDeleteError(deleteErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const bulkMove = () => {
    const target = bulkMoveTarget === 'unfiled' ? null : bulkMoveTarget;
    for (const id of selectedIds) {
      void dispatchAndCommit({ kind: 'conversation/move', conversationId: id, folderId: target });
    }
    setSelectedIds(new Set());
  };

  const bulkExport = async () => {
    if (selectedIds.size === 0 || bulkExporting) return;
    setBulkExporting(true);
    setBulkExportNotice(null);
    try {
      const fetched = await Promise.all([...selectedIds].map((id) => getConversation(id)));
      const details = fetched.filter((detail): detail is ConversationDetail => detail !== null);
      if (details.length === 0) {
        setBulkExportNotice(t('sidebar.bulkExportNone'));
        return;
      }
      const result = buildConversationZip(details);
      downloadBlob(
        `anexo-conversations-${new Date().toISOString().slice(0, 10)}.zip`,
        result.bytes,
        'application/zip',
      );
      setBulkExportNotice(t('sidebar.bulkExportDone', { count: String(details.length) }));
    } catch {
      setBulkExportNotice(t('sidebar.exportFailed'));
    } finally {
      setBulkExporting(false);
    }
  };

  const emptyText = searchQuery
    ? t('sidebar.noResults')
    : selected !== 'all' && selected !== 'unfiled'
      ? t('sidebar.noFolderConversations')
      : t('sidebar.noConversations');

  return (
    <div className="ax-conv-section">
      <div className="ax-sidebar__section-title ax-conv-section__head">
        <span>{title}</span>
        <span className="ax-inline">
          {total !== null ? <span className="ax-badge">{total}</span> : null}
          {bulkEnabled && items.length > 0 ? (
            <button
              type="button"
              className="ax-icon-btn"
              title={selecting ? t('sidebar.cancelSelect') : t('sidebar.select')}
              aria-label={selecting ? t('sidebar.cancelSelect') : t('sidebar.select')}
              onClick={toggleSelectMode}
            >
              {selecting ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>
          ) : null}
          <a
            className="ax-icon-btn"
            href="/"
            title={t('sidebar.newChat')}
            aria-label={t('sidebar.newChat')}
            onClick={() => {
              if (selected === 'all' || selected === 'unfiled') {
                clearPendingFolderForNewChat();
                return;
              }
              rememberFolderForNewChat(selected, knownConversationIds, getConversationId());
            }}
          >
            <Plus size={14} />
          </a>
        </span>
      </div>

      {searchQuery ? (
        <div className="ax-conv-search-note">
          {t('sidebar.searchResults', { query: searchQuery })}
        </div>
      ) : null}
      {exportNotice ? <div className="ax-sidebar__notice">{exportNotice}</div> : null}

      {loading && items.length === 0 ? (
        <div className="ax-stack ax-conv-skeleton" aria-label={t('sidebar.loading')}>
          <div className="ax-skeleton-row" />
          <div className="ax-skeleton-row" />
          <div className="ax-skeleton-row" />
        </div>
      ) : null}

      {error && items.length === 0 ? (
        <div className="ax-stack">
          <div className="ax-empty">{errorMessage(error)}</div>
          <button type="button" className="ax-btn" onClick={onRetry}>
            {t('sidebar.retry')}
          </button>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="ax-empty">{emptyText}</div>
      ) : null}

      {groups.map((group) => (
        <div key={group.bucket} className="ax-conv-group">
          <div className="ax-conv-group__title">{t(TIME_KEYS[group.bucket])}</div>
          {group.items.map((conversation) => {
            const assignedId = assignments[conversation.id] ?? null;
            const assigned = assignedId ? folders[assignedId] : null;
            const open = menuId === conversation.id;
            const renaming = renamingId === conversation.id;
            const confirmingDelete = confirmDeleteId === conversation.id;

            return (
              <div key={conversation.id} className="ax-conv-item">
                <div className="ax-conv-row" data-open={open}>
                  {selecting ? (
                    <label className="ax-conv-check">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(conversation.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => toggleSelected(conversation.id, event.target.checked)}
                        aria-label={conversation.title}
                      />
                    </label>
                  ) : null}
                  <a className="ax-conv-row__link" href={`/c/${conversation.id}`}>
                    {assigned ? (
                      <span
                        className="ax-folder-dot ax-folder-dot--small"
                        style={{ background: folderColor(assigned.color) }}
                        title={assigned.name}
                      />
                    ) : null}
                    {renaming ? null : <span className="ax-row-label">{conversation.title}</span>}
                    {conversation.isStarred ? (
                      <Star className="ax-conv-row__star" size={13} fill="currentColor" />
                    ) : null}
                  </a>

                  {renaming ? (
                    <ChatRenameInput
                      value={conversation.title}
                      onCancel={() => setRenamingId(null)}
                      onCommit={(name) => {
                        setRenamingId(null);
                        const title = name.trim();
                        if (!title || title === conversation.title) return;
                        patch.mutate({ id: conversation.id, patch: { title } });
                      }}
                    />
                  ) : null}

                  <button
                    type="button"
                    className="ax-icon-btn ax-conv-row__menu-btn"
                    aria-label={t('sidebar.more')}
                    title={t('sidebar.more')}
                    aria-expanded={open}
                    onClick={(event) => toggleMenu(conversation.id, event.currentTarget)}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>

                {open ? (
                  <div
                    className="ax-conv-menu"
                    data-placement={menuPlacement.up ? 'above' : 'below'}
                    style={{
                      top: menuPlacement.top,
                      left: menuPlacement.left,
                      maxHeight: menuPlacement.maxHeight,
                    }}
                  >
                    <div className="ax-conv-menu__label">{t('sidebar.moveTo')}</div>
                    <div className="ax-conv-menu__folders">
                      <button
                        type="button"
                        data-active={assignedId === null}
                        onClick={() => void move(conversation.id, null)}
                      >
                        {t('sidebar.moveToUnfiled')}
                      </button>
                      {folderOptions.map(({ folder, depth }) => (
                        <button
                          key={folder.id}
                          type="button"
                          data-active={assignedId === folder.id}
                          style={{ paddingLeft: 8 + depth * 12 }}
                          onClick={() => void move(conversation.id, folder.id)}
                        >
                          <span
                            className="ax-folder-dot ax-folder-dot--small"
                            style={{ background: folderColor(folder.color) }}
                          />
                          {folder.name}
                        </button>
                      ))}
                    </div>

                    <div className="ax-divider" />

                    <button
                      type="button"
                      onClick={() => {
                        patch.mutate({
                          id: conversation.id,
                          patch: { isStarred: !conversation.isStarred },
                        });
                        setMenuId(null);
                      }}
                    >
                      {conversation.isStarred ? t('sidebar.unstar') : t('sidebar.star')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(conversation.id);
                        setMenuId(null);
                      }}
                    >
                      {t('sidebar.renameChat')}
                    </button>
                    <button type="button" onClick={() => void copyLink(conversation.id)}>
                      {copiedId === conversation.id ? t('sidebar.copied') : t('sidebar.copyLink')}
                    </button>
                    <button
                      type="button"
                      disabled={exportingId === conversation.id}
                      onClick={() => void exportConversation(conversation.id, 'md')}
                    >
                      <Download size={12} style={{ verticalAlign: 'middle' }} />
                      {exportingId === conversation.id
                        ? t('sidebar.exporting')
                        : t('sidebar.exportMarkdown')}
                    </button>
                    <button
                      type="button"
                      disabled={exportingId === conversation.id}
                      onClick={() => void exportConversation(conversation.id, 'html')}
                    >
                      <Download size={12} style={{ verticalAlign: 'middle' }} />
                      {exportingId === conversation.id
                        ? t('sidebar.exporting')
                        : t('sidebar.exportHtml')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        patch.mutate({ id: conversation.id, patch: { isArchived: true } });
                        setMenuId(null);
                      }}
                    >
                      {t('sidebar.archive')}
                    </button>

                    {confirmingDelete ? (
                      <div className="ax-conv-menu__confirm">
                        <span>{t('sidebar.deleteChatConfirm')}</span>
                        <div className="ax-inline">
                          <button
                            type="button"
                            className="ax-btn ax-btn--danger"
                            disabled={deletingId === conversation.id}
                            onClick={() => void removeConversation(conversation.id)}
                          >
                            {deletingId === conversation.id
                              ? t('sidebar.deleting')
                              : t('common.delete')}
                          </button>
                          <button
                            type="button"
                            className="ax-btn"
                            disabled={deletingId === conversation.id}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                        {deleteError ? <div className="ax-error">{deleteError}</div> : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ax-conv-menu__danger"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmDeleteId(conversation.id);
                        }}
                      >
                        {t('sidebar.deleteChat')}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {hasNextPage ? (
        <div ref={sentinelRef} className="ax-conv-sentinel">
          {isFetchingNextPage ? t('sidebar.loading') : null}
        </div>
      ) : null}

      {selecting ? (
        <div className="ax-bulk-bar">
          <div className="ax-bulk-bar__summary">
            {t('sidebar.selectedCount', { count: String(selectedIds.size) })}
            <button type="button" className="ax-link" onClick={toggleSelectMode}>
              {t('common.cancel')}
            </button>
          </div>
          <div className="ax-bulk-bar__actions">
            <button
              type="button"
              className="ax-btn ax-btn--primary"
              disabled={selectedIds.size === 0 || bulkExporting}
              onClick={() => void bulkExport()}
            >
              {bulkExporting ? t('sidebar.bulkExporting') : t('sidebar.bulkExport')}
            </button>
            <button
              type="button"
              className="ax-btn"
              disabled={selectedIds.size === 0}
              onClick={() => bulkStar(true)}
            >
              {t('sidebar.bulkStar')}
            </button>
            <button
              type="button"
              className="ax-btn"
              disabled={selectedIds.size === 0}
              onClick={() => bulkStar(false)}
            >
              {t('sidebar.bulkUnstar')}
            </button>
            <button
              type="button"
              className="ax-btn"
              disabled={selectedIds.size === 0}
              onClick={bulkArchive}
            >
              {t('sidebar.bulkArchive')}
            </button>
            <select
              className="ax-select"
              style={{ maxWidth: 140 }}
              value={bulkMoveTarget}
              onChange={(event) => setBulkMoveTarget(event.target.value)}
              aria-label={t('sidebar.moveTo')}
            >
              <option value="unfiled">{t('sidebar.moveToUnfiled')}</option>
              {folderOptions.map(({ folder, depth }) => (
                <option key={folder.id} value={folder.id}>
                  {' '.repeat(Math.min(depth, 4))}
                  {folder.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ax-btn"
              disabled={selectedIds.size === 0}
              onClick={bulkMove}
            >
              {t('sidebar.bulkMove')}
            </button>
            <button
              type="button"
              className={`ax-btn${bulkConfirm ? ' ax-btn--danger' : ''}`}
              disabled={selectedIds.size === 0 || bulkDeleting}
              onClick={() => void bulkDelete()}
            >
              {bulkDeleting
                ? t('sidebar.bulkDeleting')
                : bulkConfirm
                  ? t('common.confirm')
                  : t('sidebar.bulkDelete')}
            </button>
          </div>
          {bulkExportNotice ? <div className="ax-bulk-bar__notice">{bulkExportNotice}</div> : null}
          {bulkDeleteNotice ? <div className="ax-bulk-bar__notice">{bulkDeleteNotice}</div> : null}
        </div>
      ) : null}

      {error && items.length > 0 ? (
        <button type="button" className="ax-btn" onClick={onRetry}>
          {t('sidebar.retry')}
        </button>
      ) : null}
    </div>
  );
}
