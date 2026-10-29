import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { extractEnhanced } from '@/ai/prompts/optimizer';
import { useAiStream } from '@/ai/use-ai-stream';
import { getComposerText, setComposerText } from '@/chatgpt/composer';
import { getConversationContextForChat } from '@/chatgpt/context';
import { t } from '@/i18n';
import { useUiStore } from '@/stores/ui-store';

function settingsError(code: string | undefined): boolean {
  return code === 'not_configured' || code === 'host_permission_required';
}

function OptimizerDialogInner({ initial, onClose }: { initial: string; onClose: () => void }) {
  const stream = useAiStream();
  const [input, setInput] = useState(initial.trim() || getComposerText().trim());
  const [preparing, setPreparing] = useState(false);
  const startRef = useRef(stream.start);
  startRef.current = stream.start;
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);

  useEffect(
    () => () => {
      mountedRef.current = false;
      runIdRef.current += 1;
    },
    [],
  );

  const run = async (value: string) => {
    const prompt = value.trim();
    if (!prompt) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setPreparing(true);
    try {
      const context = await getConversationContextForChat(4_000);
      if (!mountedRef.current || runIdRef.current !== runId) return;
      startRef.current({ kind: 'optimizer', input: prompt, context });
    } finally {
      if (mountedRef.current && runIdRef.current === runId) setPreparing(false);
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run(input);
    // The dialog opens once per click; subsequent runs are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stream.cancel();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stream, onClose]);

  const busy = preparing || stream.status === 'streaming';
  const display = busy
    ? stream.text.replace(/<\/?enhanced>/gi, '').trim()
    : extractEnhanced(stream.text);
  const canUse = !busy && stream.status === 'done' && display.length > 0;

  const usePrompt = () => {
    if (!canUse) return;
    if (setComposerText(display)) onClose();
  };

  return (
    <div className="ax-backdrop ax-optimizer-backdrop" onClick={onClose}>
      <div
        className="ax-optimizer"
        role="dialog"
        aria-modal="true"
        aria-label={t('optimizer.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ax-optimizer__header">
          <Sparkles size={16} />
          <div className="ax-optimizer__heading">
            <strong>{t('optimizer.title')}</strong>
            <span>{t('optimizer.note')}</span>
          </div>
          <button
            type="button"
            className="ax-icon-btn"
            aria-label={t('common.close')}
            onClick={() => {
              stream.cancel();
              onClose();
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="ax-optimizer__body">
          <label className="ax-optimizer__column">
            <span className="ax-optimizer__label">{t('optimizer.original')}</span>
            <textarea
              className="ax-input ax-optimizer__textarea"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="ax-optimizer__column">
            <span className="ax-optimizer__label">{t('optimizer.result')}</span>
            <div className="ax-optimizer__output" aria-live="polite">
              {display ? (
                <pre>{display}</pre>
              ) : busy ? (
                <span className="ax-optimizer__thinking">{t('optimizer.thinking')}</span>
              ) : (
                <span className="ax-optimizer__thinking">{t('optimizer.empty')}</span>
              )}
            </div>
          </div>
        </div>

        {stream.error ? (
          <div className="ax-optimizer__error">
            <span>{stream.error.message}</span>
            {settingsError(stream.error.code) ? (
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

        <div className="ax-optimizer__footer">
          <button
            type="button"
            className="ax-btn"
            disabled={busy || !input.trim()}
            onClick={() => void run(input)}
          >
            <RotateCcw size={14} />
            {t('optimizer.regenerate')}
          </button>
          <span className="ax-spacer" />
          <button type="button" className="ax-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            disabled={!canUse}
            onClick={usePrompt}
          >
            {t('optimizer.use')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OptimizerDialog() {
  const open = useUiStore((state) => state.optimizerOpen);
  const initial = useUiStore((state) => state.optimizerInput);
  const close = useUiStore((state) => state.closeOptimizer);

  if (!open) return null;
  return <OptimizerDialogInner key={initial} initial={initial} onClose={close} />;
}
