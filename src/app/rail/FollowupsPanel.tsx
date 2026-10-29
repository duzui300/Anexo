import { useEffect, useRef, useState } from 'react';
import { Lightbulb, RotateCcw, Sparkles } from 'lucide-react';
import { browser } from 'wxt/browser';
import { parseFollowups } from '@/ai/prompts/followups';
import { useAiStream } from '@/ai/use-ai-stream';
import { setComposerText } from '@/chatgpt/composer';
import { contextToText, getConversationContextForChat } from '@/chatgpt/context';
import { getConversationId } from '@/chatgpt/selectors';
import { heuristicFollowups } from '@/domain/followup-heuristic';
import { t } from '@/i18n';
import { useSettings } from '@/stores/db-store';

const CACHE_LIMIT = 50;
const cache = new Map<string, string[]>();

function cacheKey(conversationId: string | null, answer: string): string {
  return `${conversationId ?? 'unknown'}:${answer.length}:${answer.slice(-160)}`;
}

function remember(key: string, items: string[]): void {
  cache.delete(key);
  cache.set(key, items);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function recall(key: string): string[] | null {
  const items = cache.get(key);
  if (!items) return null;
  cache.delete(key);
  cache.set(key, items);
  return items;
}

export function FollowupsPanel() {
  const settings = useSettings();
  const mode = settings.features.followUps;
  const stream = useAiStream();
  const [items, setItems] = useState<string[]>([]);
  const [source, setSource] = useState<'heuristic' | 'ai' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const answerRef = useRef('');
  const keyRef = useRef('');
  const handledRef = useRef('');
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (stream.status !== 'done' || !answerRef.current) return;
    if (handledRef.current === stream.text) return;
    handledRef.current = stream.text;

    const parsed = parseFollowups(stream.text);
    if (parsed.length > 0) {
      setItems(parsed);
      setSource('ai');
      setNotice(null);
      setError(null);
      remember(keyRef.current, parsed);
      return;
    }

    // A malformed or empty model reply falls back to the local suggestions.
    setItems(heuristicFollowups(answerRef.current));
    setSource('heuristic');
    setError(t('followups.failed'));
  }, [stream.status, stream.text]);

  useEffect(() => {
    if (stream.status !== 'error') return;
    setItems(heuristicFollowups(answerRef.current));
    setSource('heuristic');
    setError(stream.error?.message ?? t('followups.failed'));
  }, [stream.status, stream.error]);

  const generate = async () => {
    if (preparing || stream.status === 'streaming') return;
    setPreparing(true);
    setError(null);

    try {
      const messages = await getConversationContextForChat(2_000);
      if (!mountedRef.current) return;
      const lastAssistant = [...messages].reverse().find((item) => item.role === 'assistant');
      const answer = lastAssistant?.content.trim() ?? '';
      if (!answer) {
        setItems([]);
        setSource(null);
        setError(null);
        setNotice(t('followups.empty'));
        return;
      }

      answerRef.current = answer;
      const key = cacheKey(getConversationId(), answer);
      keyRef.current = key;

      if (mode === 'ai' && settings.ai.enabled) {
        const cached = recall(key);
        if (cached) {
          setItems(cached);
          setSource('ai');
          setNotice(null);
          return;
        }

        handledRef.current = '';
        setItems([]);
        setSource('ai');
        setNotice(null);
        stream.start({
          kind: 'followups',
          context: contextToText(messages),
        });
        return;
      }

      if (mode === 'ai' && !settings.ai.enabled) {
        setNotice(t('followups.aiUnavailable'));
      } else {
        setNotice(null);
      }
      setItems(heuristicFollowups(answer));
      setSource('heuristic');
    } finally {
      if (mountedRef.current) setPreparing(false);
    }
  };

  const insert = (text: string) => {
    setComposerText(text);
  };

  if (mode === 'off') {
    return (
      <div className="ax-followups">
        <div className="ax-empty">{t('followups.off')}</div>
      </div>
    );
  }

  const streaming = stream.status === 'streaming';

  return (
    <div className="ax-followups">
      <div className="ax-followups__head">
        <span className="ax-followups__label">
          {source === 'ai' ? <Sparkles size={13} /> : <Lightbulb size={13} />}
          {source === 'ai' ? t('followups.ai') : t('followups.local')}
        </span>
        <button
          type="button"
          className="ax-btn ax-btn--ghost"
          disabled={preparing || streaming}
          onClick={() => void generate()}
        >
          {preparing || streaming ? (
            t('followups.thinking')
          ) : items.length > 0 ? (
            <>
              <RotateCcw size={13} />
              {t('followups.retry')}
            </>
          ) : (
            <>
              <Lightbulb size={13} />
              {t('followups.suggest')}
            </>
          )}
        </button>
      </div>

      {notice ? <div className="ax-followups__notice">{notice}</div> : null}

      {items.length > 0 ? (
        <>
          <div className="ax-followups__hint">{t('followups.insertHint')}</div>
          <div className="ax-followups__items">
            {items.map((item) => (
              <button
                key={item}
                type="button"
                className="ax-followups__item"
                onClick={() => insert(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="ax-followups__based">{t('followups.basedOn')}</div>
        </>
      ) : null}

      {error ? (
        <div className="ax-stack">
          <div className="ax-error">{error}</div>
          <button type="button" className="ax-btn" onClick={() => void generate()}>
            <RotateCcw size={13} />
            {t('followups.retry')}
          </button>
        </div>
      ) : null}

      {mode === 'ai' && !settings.ai.enabled ? (
        <button
          type="button"
          className="ax-btn ax-btn--ghost"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          {t('sidechat.openSettings')}
        </button>
      ) : null}
    </div>
  );
}
