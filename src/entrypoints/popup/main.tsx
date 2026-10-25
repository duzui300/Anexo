import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Settings as SettingsIcon } from 'lucide-react';
import { browser } from 'wxt/browser';
import { dispatchDbCommand, fetchDbSnapshot, watchDb } from '@/data/repository';
import type { AnexoDb, DeepPartial, Settings } from '@/data/schema';
import { setLocale, t } from '@/i18n';
import { applyPageTheme, watchPageTheme } from '@/ui/page-theme';
import { Toggle } from '@/ui/primitives/Toggle';
import { AnexoMark } from '@/ui/AnexoMark';
import './style.css';

applyPageTheme();

function getVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

function Popup() {
  const [db, setDb] = useState<AnexoDb | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let stopTheme = () => {};
    void fetchDbSnapshot()
      .then((value) => {
        if (!live) return;
        setDb(value);
        setLocale(value.settings.locale);
        stopTheme = watchPageTheme(value.settings.theme);
      })
      .catch((loadError: unknown) => {
        if (live) setError(loadError instanceof Error ? loadError.message : String(loadError));
      });

    const unsubscribe = watchDb((next) => {
      setDb(next);
      setLocale(next.settings.locale);
      applyPageTheme(next.settings.theme);
    });

    return () => {
      live = false;
      unsubscribe();
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

  const openChat = async () => {
    await browser.tabs.create({ url: 'https://chatgpt.com/' });
    window.close();
  };

  const openCommandCenter = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await browser.tabs.sendMessage(tab.id, { type: 'ui:openCommandCenter' });
        window.close();
        return;
      } catch {
        // Not a ChatGPT tab; fall through and open one.
      }
    }
    await openChat();
  };

  const features = db?.settings.features;
  const version = getVersion();

  return (
    <main className="ax-popup">
      <header className="ax-popup__header">
        <AnexoMark size={34} />
        <div className="ax-popup__brand">
          <h1 className="ax-popup__title">{t('app.name')}</h1>
          <span className="ax-popup__badge">{t('popup.status')}</span>
        </div>
        <button
          type="button"
          className="ax-icon-btn"
          title={t('popup.settings')}
          aria-label={t('popup.settings')}
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <SettingsIcon size={15} />
        </button>
      </header>

      {error ? <div className="ax-error">{error}</div> : null}

      {db && features ? (
        <>
          <section className="ax-popup__section" aria-label={t('popup.quickAccess')}>
            <div className="ax-popup__section-title">{t('popup.quickAccess')}</div>
            <div className="ax-popup__tiles">
              <div className="ax-popup__tile">
                <span className="ax-popup__tile-label">{t('popup.organizer')}</span>
                <Toggle
                  label={t('settings.sidebar')}
                  checked={features.sidebar}
                  onChange={(value) => void patch({ features: { sidebar: value } })}
                />
              </div>
              <div className="ax-popup__tile">
                <span className="ax-popup__tile-label">{t('settings.rightRail')}</span>
                <Toggle
                  label={t('settings.rightRail')}
                  checked={features.rightRail}
                  onChange={(value) => void patch({ features: { rightRail: value } })}
                />
              </div>
              <div className="ax-popup__tile">
                <span className="ax-popup__tile-label">{t('popup.timestamps')}</span>
                <Toggle
                  label={t('settings.timestamps')}
                  checked={features.timestamps}
                  onChange={(value) => void patch({ features: { timestamps: value } })}
                />
              </div>
              <button
                type="button"
                className="ax-popup__tile ax-popup__tile--action"
                onClick={() => void openCommandCenter()}
              >
                <span className="ax-popup__tile-label">{t('popup.commandCenter')}</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </div>
          </section>

          <div className="ax-popup__row ax-popup__row--plain">
            <span>{t('popup.ai')}</span>
            <span className="ax-badge" title={db.settings.ai.model || undefined}>
              {db.settings.ai.enabled
                ? db.settings.ai.model || t('popup.configured')
                : t('popup.notConfigured')}
            </span>
          </div>

          <div className="ax-popup__actions">
            <button
              type="button"
              className="ax-btn ax-btn--primary"
              onClick={() => void openChat()}
            >
              {t('popup.openChat')}
            </button>
          </div>
        </>
      ) : (
        <p className="ax-popup__loading">{t('popup.loading')}</p>
      )}

      <footer className="ax-popup__footer">
        <span>{t('welcome.localFirst')}</span>
        <span>v{version}</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
