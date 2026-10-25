import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Code2, StickyNote } from 'lucide-react';
import type { ConversationMessage } from '@/types/chatgpt';
import { useCurrentConversationId } from '@/chatgpt/use-current-conversation';
import { useConversationDetail } from '@/features/conversations/hooks';
import { newId } from '@/domain/id';
import { t } from '@/i18n';
import { dispatchAndCommit, updateSettings } from '@/stores/actions';
import { useDbStore, useSettings } from '@/stores/db-store';
import { useUiStore } from '@/stores/ui-store';
import { jumpToMessage } from './jump';

function preview(text: string, length = 140): string {
  return text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length);
}

function roleOf(message: ConversationMessage): 'user' | 'assistant' {
  return message.role === 'user' ? 'user' : 'assistant';
}

export function MinimapPanel() {
  const conversationId = useCurrentConversationId();
  const detail = useConversationDetail(conversationId);
  const settings = useSettings();
  const db = useDbStore((state) => state.db);
  const openNoteTarget = useUiStore((state) => state.openNoteTarget);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery('');
    setError(null);
  }, [conversationId]);

  const messages = useMemo(
    () =>
      (detail.data?.messages ?? []).filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      ),
    [detail.data],
  );
  const title = detail.data?.title ?? null;

  const bookmarksByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const bookmark of Object.values(db.bookmarks)) {
      if (bookmark.conversationId !== conversationId) continue;
      map.set(bookmark.messageId ?? `index:${bookmark.messageIndex}`, bookmark.id);
    }
    return map;
  }, [db.bookmarks, conversationId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return messages
      .map((message, index) => ({ message, index }))
      .filter(({ message, index }) => {
        if (settings.ui.minimapDepth === 'prompts' && message.role !== 'user') return false;
        if (settings.ui.minimapCodeOnly && !/```|\bcode\b/i.test(message.text)) return false;
        if (!needle) return true;
        return `${index + 1} ${message.text}`.toLowerCase().includes(needle);
      });
  }, [messages, query, settings.ui.minimapDepth, settings.ui.minimapCodeOnly]);

  const bookmarkKey = (message: ConversationMessage, index: number): string =>
    message.id || `index:${index}`;

  const toggleBookmark = async (message: ConversationMessage, index: number) => {
    if (!conversationId) return;
    const key = bookmarkKey(message, index);
    const existing = bookmarksByKey.get(key) ?? bookmarksByKey.get(`index:${index}`);
    try {
      setError(null);
      if (existing) {
        await dispatchAndCommit({ kind: 'bookmark/remove', id: existing });
        return;
      }
      await dispatchAndCommit({
        kind: 'bookmark/add',
        bookmark: {
          id: newId('bookmark'),
          conversationId,
          messageId: message.id || null,
          messageIndex: index,
          role: roleOf(message),
          preview: message.text.slice(0, 500),
          conversationTitle: title,
          createdAt: Date.now(),
        },
      });
    } catch (bookmarkError) {
      setError(bookmarkError instanceof Error ? bookmarkError.message : String(bookmarkError));
    }
  };

  const addNote = (message: ConversationMessage, index: number) => {
    if (!conversationId) return;
    openNoteTarget({
      conversationId,
      conversationTitle: title,
      messageId: message.id || null,
      messageIndex: index,
      role: roleOf(message),
      anchorText: message.text.slice(0, 2_000),
    });
    void updateSettings({ ui: { railTab: 'notes', railOpen: true } }).catch(() => {});
  };

  if (!conversationId) {
    return <div className="ax-empty">{t('rail.minimapEmpty')}</div>;
  }

  return (
    <div className="ax-minimap">
      <div className="ax-inline ax-rail__toolbar">
        <input
          className="ax-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('rail.filter')}
          aria-label={t('rail.filter')}
        />
      </div>

      <div className="ax-inline ax-rail__toolbar">
        <button
          type="button"
          className="ax-subtab"
          data-active={settings.ui.minimapDepth === 'prompts'}
          onClick={() => void updateSettings({ ui: { minimapDepth: 'prompts' } })}
        >
          {t('rail.viewPrompts')}
        </button>
        <button
          type="button"
          className="ax-subtab"
          data-active={settings.ui.minimapDepth === 'all'}
          onClick={() => void updateSettings({ ui: { minimapDepth: 'all' } })}
        >
          {t('rail.all')}
        </button>
        <button
          type="button"
          className="ax-subtab"
          data-active={settings.ui.minimapCodeOnly}
          onClick={() =>
            void updateSettings({ ui: { minimapCodeOnly: !settings.ui.minimapCodeOnly } })
          }
        >
          <Code2 size={12} />
          {t('rail.code')}
        </button>
      </div>

      {detail.isLoading ? <div className="ax-empty">{t('rail.minimapLoading')}</div> : null}
      {detail.error ? (
        <div className="ax-error">
          {detail.error instanceof Error ? detail.error.message : String(detail.error)}
        </div>
      ) : null}
      {error ? <div className="ax-error">{error}</div> : null}

      {!detail.isLoading && !detail.error && filtered.length === 0 ? (
        <div className="ax-empty">{t('rail.minimapHint')}</div>
      ) : null}

      <div className="ax-outline">
        {filtered.map(({ message, index }) => {
          const bookmarked = bookmarksByKey.has(bookmarkKey(message, index));
          const role = roleOf(message);
          return (
            <div key={`${message.id || index}`} className="ax-outline-row" data-role={role}>
              <button
                type="button"
                className="ax-outline-row__main"
                title={preview(message.text, 300)}
                onClick={() =>
                  void jumpToMessage({
                    messageId: message.id,
                    index,
                    total: messages.length,
                    preview: message.text,
                    role,
                  })
                }
              >
                <span className="ax-outline-row__index">{index + 1}</span>
                <span className="ax-outline-row__text">{preview(message.text)}</span>
              </button>
              <div className="ax-outline-row__actions">
                <button
                  type="button"
                  className="ax-icon-btn"
                  title={bookmarked ? t('rail.removeBookmark') : t('rail.addBookmark')}
                  aria-label={bookmarked ? t('rail.removeBookmark') : t('rail.addBookmark')}
                  onClick={() => void toggleBookmark(message, index)}
                >
                  {bookmarked ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                </button>
                <button
                  type="button"
                  className="ax-icon-btn"
                  title={t('rail.addNote')}
                  aria-label={t('rail.addNote')}
                  onClick={() => addNote(message, index)}
                >
                  <StickyNote size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
