import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getComposerText } from '@/chatgpt/composer';
import { getComposer } from '@/chatgpt/selectors';
import { t } from '@/i18n';
import { useSettings } from '@/stores/db-store';
import { useUiStore } from '@/stores/ui-store';

interface ChipPosition {
  left: number;
  top: number;
}

export function ComposerTools() {
  const settings = useSettings();
  const openOptimizer = useUiStore((state) => state.openOptimizer);
  const openPromptPalette = useUiStore((state) => state.openPromptPalette);
  const [position, setPosition] = useState<ChipPosition | null>(null);
  const optimizerEnabled = settings.features.promptOptimizer && settings.ai.enabled;
  const promptsEnabled = settings.features.promptLibrary;

  useEffect(() => {
    if (!optimizerEnabled) {
      setPosition(null);
      return;
    }

    const update = () => {
      const composer = getComposer();
      if (!composer || getComposerText().trim().length === 0) {
        setPosition(null);
        return;
      }
      const rect = composer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setPosition(null);
        return;
      }
      setPosition({
        left: Math.round(rect.left + 8),
        top: Math.round(rect.top - 30),
      });
    };

    update();
    const interval = window.setInterval(update, 1000);
    window.addEventListener('input', update, true);
    window.addEventListener('compositionend', update, true);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('input', update, true);
      window.removeEventListener('compositionend', update, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [optimizerEnabled]);

  useEffect(() => {
    if (!optimizerEnabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== 'e') return;
      event.preventDefault();
      openOptimizer(getComposerText());
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [optimizerEnabled, openOptimizer]);

  useEffect(() => {
    if (!promptsEnabled) return;

    const onInput = (event: Event) => {
      if (event.target !== getComposer()) return;
      if (getComposerText().trim() === '//') openPromptPalette();
    };

    window.addEventListener('input', onInput, true);
    return () => window.removeEventListener('input', onInput, true);
  }, [promptsEnabled, openPromptPalette]);

  if (!optimizerEnabled || !position) return null;

  return (
    <div className="ax-composer-tools" style={{ left: position.left, top: position.top }}>
      <button
        type="button"
        className="ax-optimize-chip"
        title={t('optimizer.title')}
        onClick={() => openOptimizer(getComposerText())}
      >
        <Sparkles size={13} />
        {t('optimizer.button')}
      </button>
    </div>
  );
}
