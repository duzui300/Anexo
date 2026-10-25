import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Download, Pencil, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { browser } from 'wxt/browser';
import { extractEnhanced } from '@/ai/prompts/optimizer';
import { useAiStream } from '@/ai/use-ai-stream';
import { setComposerText } from '@/chatgpt/composer';
import { downloadText } from '@/data/import-export';
import type { Prompt } from '@/data/schema';
import { newId } from '@/domain/id';
import { t } from '@/i18n';
import { dispatchAndCommit } from '@/stores/actions';
import { useDbStore, useSettings } from '@/stores/db-store';

interface ImportedPrompt {
  label?: unknown;
  content?: unknown;
}

function readImport(text: string): ImportedPrompt[] {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { prompts?: unknown }).prompts)
      ? (parsed as { prompts: unknown[] }).prompts
      : [];
  return list.filter((item): item is ImportedPrompt => item !== null && typeof item === 'object');
}

function preview(text: string, length = 180): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, length);
}

function needsAiSettings(code: string | undefined): boolean {
  return code === 'not_configured' || code === 'host_permission_required';
}

export function PromptLibrary() {
  const db = useDbStore((state) => state.db);
  const settings = useSettings();
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const {
    text: aiText,
    status: aiStatus,
    error: aiError,
    start: startAi,
    cancel: cancelAi,
    reset: resetAi,
  } = useAiStream();
  const optimizing = aiStatus === 'streaming';

  useEffect(() => {
    if (aiStatus !== 'done') return;
    const next = extractEnhanced(aiText);
    if (next) {
      setContent(next);
      setAiNotice(t('prompts.aiOptimized'));
    } else {
      setError(t('prompts.aiEmpty'));
    }
    resetAi();
  }, [aiStatus, aiText, resetAi]);

  const optimize = () => {
    const draft = content.trim();
    if (!draft || optimizing) return;
    setError(null);
    setAiNotice(null);
    if (!settings.ai.enabled) {
      setAiNotice(t('prompts.aiNeedsSetup'));
      return;
    }
    startAi({ kind: 'optimizer', input: draft, context: [] });
  };

  const prompts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.values(db.prompts)
      .filter(
        (prompt) =>
          !needle ||
          prompt.label.toLowerCase().includes(needle) ||
          prompt.content.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [db.prompts, query]);

  const resetForm = () => {
    cancelAi();
    setAiNotice(null);
    setLabel('');
    setContent('');
    setEditingId(null);
  };

  const save = async () => {
    const nextLabel = label.trim();
    const nextContent = content.trim();
    if (!nextLabel || !nextContent) return;

    try {
      setError(null);
      if (editingId) {
        await dispatchAndCommit({
          kind: 'prompt/update',
          id: editingId,
          patch: { label: nextLabel, content: nextContent },
        });
      } else {
        await dispatchAndCommit({
          kind: 'prompt/add',
          prompt: {
            id: newId('prompt'),
            label: nextLabel,
            content: nextContent,
            source: 'manual',
            sourceMessageId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const edit = (prompt: Prompt) => {
    cancelAi();
    setAiNotice(null);
    setEditingId(prompt.id);
    setLabel(prompt.label);
    setContent(prompt.content);
  };

  const remove = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    try {
      setError(null);
      await dispatchAndCommit({ kind: 'prompt/remove', id });
      setConfirmId(null);
      if (editingId === id) resetForm();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : String(removeError));
    }
  };

  const insert = (prompt: Prompt) => {
    if (setComposerText(prompt.content)) {
      setInsertedId(prompt.id);
      window.setTimeout(() => setInsertedId(null), 1_800);
    }
  };

  const exportPrompts = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      prompts: Object.values(db.prompts).map((prompt) => ({
        label: prompt.label,
        content: prompt.content,
      })),
    };
    downloadText('anexo-prompts.json', JSON.stringify(payload, null, 2));
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const items = readImport(await file.text());
      if (items.length === 0) throw new Error(t('prompts.importFailed'));

      for (const item of items) {
        const nextLabel = typeof item.label === 'string' ? item.label.trim() : '';
        const nextContent = typeof item.content === 'string' ? item.content.trim() : '';
        if (!nextLabel || !nextContent) continue;
        await dispatchAndCommit({
          kind: 'prompt/add',
          prompt: {
            id: newId('prompt'),
            label: nextLabel.slice(0, 128),
            content: nextContent.slice(0, 20_000),
            source: 'import',
            sourceMessageId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        });
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="ax-prompt-library">
      {!settings.features.promptLibrary ? (
        <div className="ax-empty">{t('prompts.disabled')}</div>
      ) : null}

      {error ? <div className="ax-error">{error}</div> : null}
      {aiError ? (
        <div className="ax-error">
          <span>{aiError.message}</span>
          {needsAiSettings(aiError.code) ? (
            <button
              type="button"
              className="ax-btn"
              onClick={() => void browser.runtime.openOptionsPage()}
            >
              {t('optimizer.openSettings')}
            </button>
          ) : null}
        </div>
      ) : null}
      {aiNotice ? (
        <div className="ax-note ax-inline">
          <span>{aiNotice}</span>
          {!settings.ai.enabled ? (
            <button
              type="button"
              className="ax-btn"
              onClick={() => void browser.runtime.openOptionsPage()}
            >
              {t('optimizer.openSettings')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="ax-card">
        <h3 className="ax-inline">
          {editingId ? <Pencil size={15} /> : <Plus size={15} />}
          {editingId ? t('prompts.edit') : t('prompts.new')}
        </h3>
        <div className="ax-stack">
          <label className="ax-field">
            <span>{t('prompts.label')}</span>
            <input
              className="ax-input"
              value={label}
              maxLength={128}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('prompts.labelPlaceholder')}
            />
          </label>
          <label className="ax-field">
            <span>{t('prompts.content')}</span>
            <textarea
              className="ax-input"
              rows={4}
              value={content}
              maxLength={20_000}
              readOnly={optimizing}
              onChange={(event) => {
                setContent(event.target.value);
                setAiNotice(null);
              }}
              placeholder={t('prompts.contentPlaceholder')}
            />
          </label>
          <div className="ax-inline">
            <button
              type="button"
              className="ax-btn ax-btn--primary"
              disabled={!label.trim() || !content.trim() || optimizing}
              onClick={() => void save()}
            >
              {editingId ? t('common.save') : t('prompts.add')}
            </button>
            {settings.features.promptOptimizer ? (
              <button
                type="button"
                className="ax-btn"
                disabled={!content.trim() || optimizing}
                onClick={optimize}
              >
                <Sparkles size={13} />
                {optimizing ? t('prompts.aiOptimizing') : t('prompts.aiOptimize')}
              </button>
            ) : null}
            {editingId ? (
              <button type="button" className="ax-btn" onClick={resetForm}>
                {t('common.cancel')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ax-inline ax-prompt-library__tools">
        <input
          className="ax-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('prompts.search')}
          aria-label={t('prompts.search')}
        />
        <button type="button" className="ax-btn" onClick={exportPrompts}>
          <Download size={13} />
          {t('prompts.export')}
        </button>
        <button type="button" className="ax-btn" onClick={() => importRef.current?.click()}>
          <Upload size={13} />
          {t('prompts.import')}
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="ax-visually-hidden"
          onChange={(event) => void onImport(event)}
        />
      </div>

      <p className="ax-prompt-library__hint">{t('prompts.paletteHint')}</p>

      {prompts.length === 0 ? <div className="ax-empty">{t('prompts.noResults')}</div> : null}

      <div className="ax-prompt-list">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="ax-prompt-row">
            <div className="ax-prompt-row__main">
              <strong>{prompt.label}</strong>
              <span>{preview(prompt.content)}</span>
            </div>
            <div className="ax-inline ax-prompt-row__actions">
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => insert(prompt)}
              >
                {insertedId === prompt.id ? t('prompts.inserted') : t('prompts.insert')}
              </button>
              <button
                type="button"
                className="ax-icon-btn"
                title={t('prompts.edit')}
                aria-label={t('prompts.edit')}
                onClick={() => edit(prompt)}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className={`ax-btn${confirmId === prompt.id ? ' ax-btn--danger' : ''}`}
                onClick={() => void remove(prompt.id)}
              >
                <Trash2 size={13} />
                {confirmId === prompt.id ? t('common.confirm') : ''}
              </button>
              {confirmId === prompt.id ? (
                <button type="button" className="ax-btn" onClick={() => setConfirmId(null)}>
                  {t('common.cancel')}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
