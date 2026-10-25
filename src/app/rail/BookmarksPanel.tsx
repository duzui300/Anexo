import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCurrentConversationId } from '@/chatgpt/use-current-conversation';
import { useConversationDetail } from '@/features/conversations/hooks';
import { t } from '@/i18n';
import { dispatchAndCommit } from '@/stores/actions';
import { useDbStore } from '@/stores/db-store';
import { jumpToMessage } from './jump';

const PENDING_JUMP = 'anexo:pendingJump';

interface PendingJump {
  conversationId: string;
  messageId?: string | null;
  messageIndex: number;
  preview: string;
  role?: string | null;
}

function dateLabel(value: number): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

function preview(text: string, length = 180): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, length);
}

export function BookmarksPanel() {
  const conversationId = useCurrentConversationId();
  const detail = useConversationDetail(conversationId);
  const db = useDbStore((state) => state.db);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [error, setError] = useState<string | null>(null);

  const bookmarks = useMemo(() => {
    return Object.values(db.bookmarks)
      .filter((bookmark) => scope === 'all' || bookmark.conversationId === conversationId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [db.bookmarks, scope, conversationId]);

  useEffect(() => {
    if (!detail.data || !conversationId) return;
    const raw = sessionStorage.getItem(PENDING_JUMP);
    if (!raw) return;
    try {
      const pending = JSON.parse(raw) as PendingJump;
      if (pending.conversationId !== conversationId) return;
      sessionStorage.removeItem(PENDING_JUMP);
      void jumpToMessage({
        messageId: pending.messageId ?? null,
        index: pending.messageIndex,
        total: detail.data.messages.length,
        preview: pending.preview,
        role: pending.role ?? null,
      });
    } catch {
      sessionStorage.removeItem(PENDING_JUMP);
    }
  }, [detail.data, conversationId]);

  const open = async (bookmarkId: string) => {
    const bookmark = db.bookmarks[bookmarkId];
    if (!bookmark) return;
    if (bookmark.conversationId === conversationId) {
      await jumpToMessage({
        messageId: bookmark.messageId,
        index: bookmark.messageIndex,
        total: detail.data?.messages.length ?? bookmark.messageIndex + 1,
        preview: bookmark.preview,
        role: bookmark.role,
      });
      return;
    }
    sessionStorage.setItem(
      PENDING_JUMP,
      JSON.stringify({
        conversationId: bookmark.conversationId,
        messageId: bookmark.messageId,
        messageIndex: bookmark.messageIndex,
        preview: bookmark.preview,
        role: bookmark.role,
      } satisfies PendingJump),
    );
    window.location.assign(`/c/${bookmark.conversationId}`);
  };

  const remove = async (id: string) => {
    try {
      setError(null);
      await dispatchAndCommit({ kind: 'bookmark/remove', id });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError));
    }
  };

  return (
    <div className="ax-bookmarks">
      <div className="ax-inline ax-rail__toolbar">
        <button
          type="button"
          className="ax-subtab"
          data-active={scope === 'current'}
          onClick={() => setScope('current')}
        >
          {t('rail.currentChat')}
        </button>
        <button
          type="button"
          className="ax-subtab"
          data-active={scope === 'all'}
          onClick={() => setScope('all')}
        >
          {t('rail.all')}
        </button>
      </div>

      {error ? <div className="ax-error">{error}</div> : null}

      {bookmarks.length === 0 ? (
        <div className="ax-empty">
          {scope === 'all' ? t('rail.bookmarksAllEmpty') : t('rail.bookmarksEmpty')}
          <br />
          {t('rail.bookmarksHow')}
        </div>
      ) : null}

      <div className="ax-outline">
        {bookmarks.map((bookmark) => (
          <div key={bookmark.id} className="ax-outline-row" data-role={bookmark.role}>
            <button
              type="button"
              className="ax-outline-row__main ax-outline-row__main--stacked"
              onClick={() => void open(bookmark.id)}
            >
              <span className="ax-outline-row__text">{preview(bookmark.preview)}</span>
              <span className="ax-outline-row__meta">
                {bookmark.conversationTitle || t('rail.untitled')} · {dateLabel(bookmark.createdAt)}
              </span>
            </button>
            <div className="ax-outline-row__actions">
              <button
                type="button"
                className="ax-icon-btn"
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => void remove(bookmark.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
