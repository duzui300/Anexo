import { useEffect, useRef, useState } from 'react';
import { ArrowUp, RotateCcw, Square } from 'lucide-react';
import { browser } from 'wxt/browser';
import { useAiStream } from '@/ai/use-ai-stream';
import {
  contextToText,
  getConversationContextForChat,
  getSelectedText,
} from '@/chatgpt/context';
import { t } from '@/i18n';
import { useSettings } from '@/stores/db-store';
import { useSideChatStore } from '@/stores/sidechat-store';
import { Markdown } from '@/ui/Markdown';

interface LastRequest {
  question: string;
  selection: string;
  context: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}

const STARTERS = [
  'sidechat.starterSummary',
  'sidechat.starterDecisions',
  'sidechat.starterNext',
] as const;

export function SideChatPanel() {
  const settings = useSettings();
  const enabled = settings.ai.enabled;
  const stream = useAiStream();
  const messages = useSideChatStore((state) => state.messages);
  const addMessage = useSideChatStore((state) => state.add);
  const clearMessages = useSideChatStore((state) => state.clear);
  const [question, setQuestion] = useState('');
  const [preparing, setPreparing] = useState(false);
  const pendingRef = useRef(false);
  const lastRequestRef = useRef<LastRequest | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stream.status === 'done' && pendingRef.current) {
      const content = stream.text.trim();
      if (content) addMessage({ role: 'assistant', content });
      pendingRef.current = false;
    }
  }, [stream.status, stream.text, addMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, stream.text]);

  const start = (request: LastRequest) => {
    lastRequestRef.current = request;
    pendingRef.current = true;
    stream.start({
      kind: 'sideChat',
      question: request.question,
      selection: request.selection,
      context: request.context,
      history: request.history,
    });
  };

  const send = (value = question) => {
    const text = value.trim();
    if (!text || preparing || stream.status === 'streaming') return;

    const selection = getSelectedText();
    const history = messages.slice(-8);
    setQuestion('');
    addMessage({ role: 'user', content: text });
    setPreparing(true);

    void (async () => {
      try {
        const context = contextToText(await getConversationContextForChat(24_000));
        start({ question: text, selection, context, history });
      } finally {
        setPreparing(false);
      }
    })();
  };

  const retry = () => {
    const last = lastRequestRef.current;
    if (last) start(last);
  };

  const stop = () => {
    const partial = stream.text.trim();
    stream.cancel();
    pendingRef.current = false;
    if (partial) addMessage({ role: 'assistant', content: partial });
  };

  if (!enabled) {
    return (
      <div className="ax-sidechat">
        <div className="ax-empty">{t('sidechat.configure')}</div>
        <button
          type="button"
          className="ax-btn"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          {t('sidechat.openSettings')}
        </button>
      </div>
    );
  }

  const streaming = stream.status === 'streaming';
  const busy = preparing || streaming;

  return (
    <div className="ax-sidechat">
      <div className="ax-sidechat__thread">
        {messages.length === 0 && !busy ? (
          <div className="ax-empty">{t('sidechat.empty')}</div>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`ax-sidechat__msg ax-sidechat__msg--${message.role}`}
          >
            {message.role === 'assistant' ? (
              <Markdown text={message.content} />
            ) : (
              <p>{message.content}</p>
            )}
          </div>
        ))}

        {busy ? (
          <div className="ax-sidechat__msg ax-sidechat__msg--assistant">
            {stream.text ? (
              <Markdown text={stream.text} />
            ) : (
              <span className="ax-sidechat__typing">{t('sidechat.thinking')}</span>
            )}
          </div>
        ) : null}

        {stream.error ? (
          <div className="ax-stack">
            <div className="ax-error">{stream.error.message}</div>
            <div className="ax-inline">
              <button type="button" className="ax-btn" onClick={retry}>
                <RotateCcw size={13} />
                {t('sidechat.retry')}
              </button>
              {stream.error.code === 'not_configured' ||
              stream.error.code === 'host_permission_required' ? (
                <button
                  type="button"
                  className="ax-btn"
                  onClick={() => void browser.runtime.openOptionsPage()}
                >
                  {t('sidechat.openSettings')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <div className="ax-sidechat__starters">
        {STARTERS.map((key) => (
          <button
            key={key}
            type="button"
            className="ax-subtab"
            disabled={busy}
            onClick={() => send(t(key))}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <div className="ax-sidechat__composer">
        <textarea
          className="ax-input ax-sidechat__input"
          rows={2}
          maxLength={500}
          value={question}
          placeholder={t('sidechat.placeholder')}
          aria-label={t('sidechat.placeholder')}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        {streaming ? (
          <button
            type="button"
            className="ax-btn ax-btn--danger ax-sidechat__send"
            onClick={stop}
            title={t('sidechat.stop')}
          >
            <Square size={13} />
          </button>
        ) : (
          <button
            type="button"
            className="ax-btn ax-btn--primary ax-sidechat__send"
            disabled={!question.trim()}
            onClick={() => send()}
            title={t('sidechat.send')}
          >
            <ArrowUp size={14} />
          </button>
        )}
      </div>

      {messages.length > 0 ? (
        <button
          type="button"
          className="ax-btn ax-btn--ghost ax-sidechat__clear"
          onClick={clearMessages}
        >
          {t('sidechat.clear')}
        </button>
      ) : null}
    </div>
  );
}
