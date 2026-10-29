import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { setComposerText } from '@/chatgpt/composer';
import { getComposer } from '@/chatgpt/selectors';
import type { Prompt } from '@/data/schema';
import { t } from '@/i18n';
import { useDbStore, useSettings } from '@/stores/db-store';
import { useUiStore } from '@/stores/ui-store';

function preview(text: string, length = 140): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, length);
}

export function PromptPalette() {
  const open = useUiStore((state) => state.promptPaletteOpen);
  const close = useUiStore((state) => state.closePromptPalette);
  const openCommandCenter = useUiStore((state) => state.openCommandCenter);
  const prompts = useDbStore((state) => state.db.prompts);
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [bottomInset, setBottomInset] = useState(96);
  const [maxHeight, setMaxHeight] = useState(560);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const composer = getComposer();
      const top = composer?.getBoundingClientRect().top;
      if (!top || top <= 0) {
        setBottomInset(96);
        setMaxHeight(Math.min(window.innerHeight * 0.62, 640));
        return;
      }
      setBottomInset(Math.max(24, window.innerHeight - top + 8));
      setMaxHeight(Math.max(200, Math.min(window.innerHeight * 0.62, top - 32)));
    };
    update();
    const interval = window.setInterval(update, 1000);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.values(prompts)
      .filter(
        (prompt) =>
          !needle ||
          prompt.label.toLowerCase().includes(needle) ||
          prompt.content.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [prompts, query]);

  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  if (!open) return null;

  const choose = (prompt: Prompt) => {
    if (setComposerText(prompt.content)) close();
  };

  return (
    <div
      className="ax-backdrop ax-prompt-backdrop"
      style={{ paddingBottom: bottomInset }}
      onClick={close}
    >
      <div
        className="ax-prompt-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('prompts.title')}
        style={{ maxHeight }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ax-prompt-palette__search">
          <Search size={15} />
          <input
            ref={inputRef}
            className="ax-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('prompts.palettePlaceholder')}
            aria-label={t('prompts.palettePlaceholder')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((current) => Math.min(items.length - 1, current + 1));
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((current) => Math.max(0, current - 1));
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                const prompt = items[active];
                if (prompt) choose(prompt);
              }
            }}
          />
        </div>

        {!settings.features.promptLibrary ? (
          <div className="ax-empty">{t('prompts.disabled')}</div>
        ) : items.length === 0 ? (
          <div className="ax-empty">
            {t('prompts.noResults')}
            <br />
            <button
              type="button"
              className="ax-btn"
              style={{ marginTop: 8 }}
              onClick={() => {
                close();
                openCommandCenter('library');
              }}
            >
              {t('prompts.openLibrary')}
            </button>
          </div>
        ) : (
          <div className="ax-prompt-palette__list" role="listbox">
            {items.map((prompt, index) => (
              <button
                key={prompt.id}
                type="button"
                role="option"
                aria-selected={index === active}
                className="ax-prompt-palette__item"
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(prompt)}
              >
                <span className="ax-prompt-palette__label">{prompt.label}</span>
                <span className="ax-prompt-palette__preview">{preview(prompt.content)}</span>
                {index === active ? (
                  <span className="ax-prompt-palette__enter">
                    <CornerDownLeft size={12} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <div className="ax-prompt-palette__footer">
          <span>{t('prompts.paletteHint')}</span>
        </div>
      </div>
    </div>
  );
}
