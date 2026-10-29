import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useCurrentConversationId } from '@/chatgpt/use-current-conversation';
import { useConversationDetail } from '@/features/conversations/hooks';
import { newId } from '@/domain/id';
import { t } from '@/i18n';
import { dispatchAndCommit } from '@/stores/actions';
import { useDbStore } from '@/stores/db-store';
import { useUiStore, type NoteTarget } from '@/stores/ui-store';
import { jumpToMessage } from './jump';

const PENDING_JUMP = 'anexo:pendingJump';

interface PendingJump {
  conversationId: string;
  messageId?: string | null;
  messageIndex: number;
  preview: string;
  role?: string | null;
}

function preview(text: string, length = 160): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, length);
}

function dateLabel(value: number): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

export function NotesPanel() {
  const conversationId = useCurrentConversationId();
  const detail = useConversationDetail(conversationId);
  const db = useDbStore((state) => state.db);
  const noteTarget = useUiStore((state) => state.noteTarget);
  const closeNoteTarget = useUiStore((state) => state.closeNoteTarget);
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messages = useMemo(
    () =>
      (detail.data?.messages ?? []).filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      ),
    [detail.data],
  );

  const target: NoteTarget | null = useMemo(() => {
    if (noteTarget && noteTarget.conversationId === conversationId) return noteTarget;
    if (!conversationId || messages.length === 0) return null;
    const index = messages.length - 1;
    const message = messages[index]!;
    return {
      conversationId,
      conversationTitle: detail.data?.title ?? null,
      messageId: message.id || null,
      messageIndex: index,
      role: message.role === 'user' ? 'user' : 'assistant',
      anchorText: message.text.slice(0, 2_000),
    };
  }, [noteTarget, conversationId, messages, detail.data]);

  useEffect(() => {
    setDraft('');
    setEditingId(null);
    setEditText('');
    setError(null);
  }, [conversationId, noteTarget?.messageId, noteTarget?.messageIndex]);

  const notes = useMemo(
    () =>
      Object.values(db.notes)
        .filter((note) => scope === 'all' || note.conversationId === conversationId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [db.notes, scope, conversationId],
  );

  const save = async () => {
    const text = draft.trim();
    if (!text || !target) return;
    try {
      setError(null);
      await dispatchAndCommit({
        kind: 'note/add',
        note: {
          id: newId('note'),
          conversationId: target.conversationId,
          messageId: target.messageId,
          messageIndex: target.messageIndex,
          role: target.role,
          anchorText: target.anchorText,
          text,
          conversationTitle: target.conversationTitle,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          orphaned: false,
        },
      });
      setDraft('');
      closeNoteTarget();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const saveEdit = async (id: string) => {
    const text = editText.trim();
    if (!text) return;
    try {
      setError(null);
      await dispatchAndCommit({ kind: 'note/update', id, patch: { text } });
      setEditingId(null);
      setEditText('');
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : String(editError));
    }
  };

  const remove = async (id: string) => {
    try {
      setError(null);
      await dispatchAndCommit({ kind: 'note/remove', id });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError));
    }
  };

  const open = async (noteId: string) => {
    const note = db.notes[noteId];
    if (!note) return;
    if (note.conversationId === conversationId) {
      await jumpToMessage({
        messageId: note.messageId,
        index: note.messageIndex,
        total: detail.data?.messages.length ?? note.messageIndex + 1,
        preview: note.anchorText ?? '',
        role: note.role,
      });
      return;
    }
    sessionStorage.setItem(
      PENDING_JUMP,
      JSON.stringify({
        conversationId: note.conversationId,
        messageId: note.messageId,
        messageIndex: note.messageIndex,
        preview: note.anchorText ?? '',
        role: note.role,
      } satisfies PendingJump),
    );
    window.location.assign(`/c/${note.conversationId}`);
  };

  return (
    <div className="ax-notes">
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

      {target ? (
        <div className="ax-note-editor">
          <div className="ax-note-editor__anchor">
            <span>{t('rail.noteOnMessage', { index: String(target.messageIndex + 1) })}</span>
            <span>{preview(target.anchorText ?? '', 120)}</span>
          </div>
          <textarea
            className="ax-input ax-note-editor__input"
            rows={3}
            maxLength={20_000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('rail.notesPlaceholder')}
            aria-label={t('rail.notesPlaceholder')}
          />
          <div className="ax-inline">
            <button
              type="button"
              className="ax-btn ax-btn--primary"
              disabled={!draft.trim()}
              onClick={() => void save()}
            >
              {t('rail.addNote')}
            </button>
            {noteTarget ? (
              <button type="button" className="ax-btn" onClick={closeNoteTarget}>
                {t('common.cancel')}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="ax-empty">{t('rail.notesNoTarget')}</div>
      )}

      {notes.length === 0 ? (
        <div className="ax-empty">
          {scope === 'all' ? t('rail.bookmarksAllEmpty') : t('rail.notesEmpty')}
        </div>
      ) : null}

      <div className="ax-outline">
        {notes.map((note) => (
          <div key={note.id} className="ax-note-row">
            {editingId === note.id ? (
              <>
                <textarea
                  className="ax-input ax-note-editor__input"
                  rows={3}
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  aria-label={t('rail.notesPlaceholder')}
                />
                <div className="ax-inline">
                  <button
                    type="button"
                    className="ax-btn ax-btn--primary"
                    disabled={!editText.trim()}
                    onClick={() => void saveEdit(note.id)}
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    className="ax-btn"
                    onClick={() => {
                      setEditingId(null);
                      setEditText('');
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ax-outline-row__main ax-outline-row__main--stacked"
                  onClick={() => void open(note.id)}
                >
                  <span className="ax-outline-row__text">{preview(note.text, 240)}</span>
                  <span className="ax-outline-row__meta">
                    {note.conversationTitle || t('rail.untitled')} · #{note.messageIndex + 1} ·{' '}
                    {dateLabel(note.updatedAt)}
                  </span>
                  {note.anchorText ? (
                    <span className="ax-note-row__anchor">{preview(note.anchorText, 90)}</span>
                  ) : null}
                </button>
                <div className="ax-outline-row__actions">
                  <button
                    type="button"
                    className="ax-icon-btn"
                    title={t('rail.editNote')}
                    aria-label={t('rail.editNote')}
                    onClick={() => {
                      setEditingId(note.id);
                      setEditText(note.text);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="ax-icon-btn"
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
                    onClick={() => void remove(note.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
