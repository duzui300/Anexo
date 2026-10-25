import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  FolderTree,
  Languages,
  Map,
  Sparkles,
} from 'lucide-react';
import { browser } from 'wxt/browser';
import { dispatchDbCommand, fetchDbSnapshot } from '@/data/repository';
import type { AnexoDb, DeepPartial, Settings } from '@/data/schema';
import { setLocale, t } from '@/i18n';
import { applyPageTheme, watchPageTheme } from '@/ui/page-theme';
import { AnexoMark } from '@/ui/AnexoMark';
import './style.css';

applyPageTheme();

const STEPS = 3;

const STEP_KEYS = ['welcome.stepLanguage', 'welcome.stepTools', 'welcome.stepAi'] as const;

const LANGUAGE_OPTIONS = [
  { value: 'auto', labelKey: 'settings.languageAuto' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
] as const;

function Welcome() {
  const [step, setStep] = useState(0);
  const [, setDb] = useState<AnexoDb | null>(null);
  const [locale, setLocaleState] = useState('auto');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    let stopTheme = () => {};
    void fetchDbSnapshot()
      .then((value) => {
        if (!live) return;
        setDb(value);
        setLocaleState(value.settings.locale);
        setLocale(value.settings.locale);
        stopTheme = watchPageTheme(value.settings.theme);
      })
      .catch((loadError: unknown) => {
        if (live) setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
    return () => {
      live = false;
      stopTheme();
    };
  }, []);

  const patch = async (value: DeepPartial<Settings>) => {
    try {
      setError(null);
      const next = await dispatchDbCommand({ kind: 'settings/patch', patch: value });
      setDb(next);
      setLocale(next.settings.locale);
      applyPageTheme(next.settings.theme);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError));
    }
  };

  const chooseLocale = (value: string) => {
    setLocaleState(value);
    setLocale(value);
    void patch({ locale: value });
  };

  const finish = async () => {
    setSaving(true);
    try {
      await dispatchDbCommand({
        kind: 'flags/patch',
        patch: { welcomeSeen: true, onboardingSeenAt: Date.now() },
      });
      await browser.tabs.create({ url: 'https://chatgpt.com/' });
      window.close();
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : String(finishError));
      setSaving(false);
    }
  };

  const next = () => {
    if (step >= STEPS - 1) {
      void finish();
      return;
    }
    setStep(step + 1);
  };

  return (
    <main className="ax-welcome">
      <div className="ax-welcome__spread">
        <aside className="ax-welcome__guide">
          <div className="ax-welcome__guide-brand">
            <AnexoMark size={34} />
            <span>{t('app.name')}</span>
          </div>
          <p className="ax-welcome__guide-title">{t('welcome.guideTitle')}</p>
          <p className="ax-welcome__guide-body">{t('welcome.guideBody')}</p>

          <ol className="ax-welcome__steps">
            {STEP_KEYS.map((key, index) => (
              <li
                key={key}
                data-active={index === step}
                aria-current={index === step ? 'step' : undefined}
              >
                <button
                  type="button"
                  className="ax-welcome__step-link"
                  onClick={() => setStep(index)}
                >
                  <span className="ax-welcome__step-num">{String(index + 1).padStart(2, '0')}</span>
                  <span>{t(key)}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="ax-welcome__guide-footer">
            <div className="ax-welcome__progress" aria-hidden="true">
              {Array.from({ length: STEPS }, (_, index) => (
                <span key={index} data-active={index === step} />
              ))}
            </div>
            <span className="ax-badge">{t('welcome.localFirst')}</span>
          </div>
        </aside>

        <section className="ax-welcome__paper">
          <div className="ax-welcome__stage">
            {error ? <div className="ax-error">{error}</div> : null}

            {step === 0 ? (
              <section className="ax-welcome__section">
                <p className="ax-welcome__eyebrow">
                  <Languages size={14} />
                  {t('welcome.language')}
                </p>
                <h1 className="ax-welcome__title">{t('welcome.language')}</h1>
                <p className="ax-welcome__body">{t('welcome.languageHint')}</p>
                <div className="ax-welcome__languages">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="ax-btn"
                      data-active={locale === option.value}
                      aria-pressed={locale === option.value}
                      onClick={() => chooseLocale(option.value)}
                    >
                      {'labelKey' in option ? t(option.labelKey) : option.label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="ax-welcome__section">
                <p className="ax-welcome__eyebrow">{t('welcome.features')}</p>
                <h1 className="ax-welcome__title">{t('welcome.features')}</h1>
                <p className="ax-welcome__body">{t('welcome.featuresDesc')}</p>
                <ul className="ax-welcome__features">
                  <li>
                    <FolderTree size={16} />
                    {t('welcome.featureFolders')}
                  </li>
                  <li>
                    <Bookmark size={16} />
                    {t('welcome.featureBookmarks')}
                  </li>
                  <li>
                    <Map size={16} />
                    {t('welcome.featureMinimap')}
                  </li>
                  <li>
                    <Sparkles size={16} />
                    {t('welcome.featureAi')}
                  </li>
                </ul>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="ax-welcome__section">
                <p className="ax-welcome__eyebrow">{t('welcome.byok')}</p>
                <h1 className="ax-welcome__title">{t('welcome.byok')}</h1>
                <p className="ax-welcome__body">{t('welcome.byokDesc')}</p>
                <div className="ax-card">
                  <h3>{t('options.aiTitle')}</h3>
                  <p>{t('options.aiDesc')}</p>
                  <div className="ax-inline" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="ax-btn"
                      onClick={() => browser.runtime.openOptionsPage()}
                    >
                      {t('welcome.openAi')}
                    </button>
                    <span className="ax-badge">{t('options.byok')}</span>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <footer className="ax-welcome__footer">
            <div className="ax-inline">
              <button
                type="button"
                className="ax-btn ax-btn--ghost"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
              >
                <ArrowLeft size={14} />
                {t('welcome.back')}
              </button>
              <button type="button" className="ax-link" onClick={() => void finish()}>
                {t('welcome.skip')}
              </button>
            </div>

            <button
              type="button"
              className="ax-btn ax-btn--primary"
              onClick={next}
              disabled={saving}
            >
              {step === STEPS - 1 ? t('welcome.finish') : t('welcome.next')}
              <ArrowRight size={14} />
            </button>
          </footer>

          <p className="ax-welcome__step">
            {t('welcome.step', { current: step + 1, total: STEPS })}
          </p>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Welcome />
  </StrictMode>,
);
