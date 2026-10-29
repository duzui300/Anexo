import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  BookOpen,
  Download,
  Info,
  KeyRound,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { browser } from 'wxt/browser';
import { ChatGptApiError } from '@/chatgpt/client';
import { checkBackend } from '@/chatgpt/conversations';
import { getConversationId, probeCapabilities, type Capabilities } from '@/chatgpt/selectors';
import { downloadText, exportFileName, parseDbFile, serializeDb } from '@/data/import-export';
import { dispatchDbCommand } from '@/data/repository';
import type { DeepPartial, Settings } from '@/data/schema';
import { setLocale, t, type MessageKey } from '@/i18n';
import { request } from '@/platform/messaging';
import { getLocalBytesInUse } from '@/platform/storage';
import { resetData, updateSettings } from '@/stores/actions';
import { useDbStore, useSettings } from '@/stores/db-store';
import { useUiStore } from '@/stores/ui-store';
import { Segmented } from '@/ui/primitives/Segmented';
import { SettingRow } from '@/ui/primitives/SettingRow';
import { Toggle } from '@/ui/primitives/Toggle';
import { AnexoMark } from '@/ui/AnexoMark';
import { PromptLibrary } from './PromptLibrary';

type Section = 'general' | 'library' | 'about';

const NAV: { id: Section; labelKey: MessageKey; icon: typeof SettingsIcon }[] = [
  { id: 'general', labelKey: 'settings.general', icon: SettingsIcon },
  { id: 'library', labelKey: 'settings.library', icon: BookOpen },
  { id: 'about', labelKey: 'settings.about', icon: Info },
];

function getVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ToggleRow({
  labelKey,
  descriptionKey,
  checked,
  onChange,
}: {
  labelKey: MessageKey;
  descriptionKey?: MessageKey;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const label = t(labelKey);
  return (
    <SettingRow
      label={label}
      description={descriptionKey ? t(descriptionKey) : undefined}
      control={<Toggle label={label} checked={checked} onChange={onChange} />}
    />
  );
}

export function CommandCenter({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const db = useDbStore((state) => state.db);
  const initialSection = useUiStore((state) => state.commandCenterSection);
  const [section, setSection] = useState<Section>(initialSection);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [bytes, setBytes] = useState<number | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const root = dialog.getRootNode();
      const active = (
        root instanceof ShadowRoot ? root.activeElement : document.activeElement
      ) as HTMLElement | null;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    if (section === 'about') setCapabilities(probeCapabilities());
  }, [section]);

  useEffect(() => {
    let live = true;
    void getLocalBytesInUse()
      .then((value) => {
        if (live) setBytes(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [db.revision]);

  const patch = async (value: DeepPartial<Settings>) => {
    try {
      setError(null);
      await updateSettings(value);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : String(updateError));
    }
  };

  const onExport = () => {
    downloadText(exportFileName(), serializeDb(db));
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const imported = parseDbFile(await file.text());
      const next = await dispatchDbCommand({ kind: 'db/replace', db: imported });
      useDbStore.getState().setDb(next);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      event.target.value = '';
    }
  };

  const onReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    try {
      setError(null);
      await resetData();
      setConfirmReset(false);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : String(resetError));
    }
  };

  const openOptions = () => {
    void request({ type: 'ui:openOptions' }).catch((openError: unknown) => {
      setError(openError instanceof Error ? openError.message : String(openError));
    });
  };

  const checkConnection = async () => {
    setBackendStatus(t('settings.checking'));
    try {
      const status = await checkBackend();
      setBackendStatus(status.ok ? `ok${status.plan ? ` · ${status.plan}` : ''}` : 'error');
    } catch (connectionError) {
      setBackendStatus(
        connectionError instanceof ChatGptApiError && connectionError.status === 401
          ? t('settings.unauthorized')
          : t('settings.connectionError'),
      );
    }
  };

  const version = getVersion();

  return (
    <div
      className="ax-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="ax-command"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ax-command-title"
      >
        <header className="ax-command__header">
          <AnexoMark size={26} />
          <h2 id="ax-command-title" className="ax-command__title">
            {t('settings.title')}
          </h2>
          <nav className="ax-command__nav" aria-label={t('settings.title')}>
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="ax-nav-item"
                  data-active={section === item.id}
                  onClick={() => setSection(item.id)}
                >
                  <span className="ax-inline">
                    <Icon size={15} />
                    {t(item.labelKey)}
                  </span>
                </button>
              );
            })}
          </nav>
          <button
            ref={closeRef}
            type="button"
            className="ax-icon-btn"
            aria-label={t('common.close')}
            title={t('common.close')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="ax-command__body">
          <div className="ax-command__content">
            {error ? <div className="ax-error">{error}</div> : null}

            {section === 'general' ? (
              <div className="ax-settings-ledger">
                <div className="ax-settings-column">
                  <section className="ax-settings-group">
                    <h3>{t('settings.groupWorkspace')}</h3>
                    <ToggleRow
                      labelKey="settings.sidebar"
                      descriptionKey="settings.sidebarDesc"
                      checked={settings.features.sidebar}
                      onChange={(value) => void patch({ features: { sidebar: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.timestamps"
                      descriptionKey="settings.timestampsDesc"
                      checked={settings.features.timestamps}
                      onChange={(value) => void patch({ features: { timestamps: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.rightRail"
                      descriptionKey="settings.rightRailDesc"
                      checked={settings.features.rightRail}
                      onChange={(value) => void patch({ features: { rightRail: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.minimap"
                      descriptionKey="settings.minimapDesc"
                      checked={settings.features.minimap}
                      onChange={(value) => void patch({ features: { minimap: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.selectionActions"
                      descriptionKey="settings.selectionActionsDesc"
                      checked={settings.features.selectionActions}
                      onChange={(value) => void patch({ features: { selectionActions: value } })}
                    />
                  </section>

                  <section className="ax-settings-group">
                    <h3>{t('settings.groupAppearance')}</h3>
                    <SettingRow
                      label={t('settings.theme')}
                      control={
                        <Segmented
                          label={t('settings.theme')}
                          value={settings.theme}
                          onChange={(value) => void patch({ theme: value })}
                          options={[
                            { value: 'system', label: t('settings.themeSystem') },
                            { value: 'light', label: t('settings.themeLight') },
                            { value: 'dark', label: t('settings.themeDark') },
                          ]}
                        />
                      }
                    />
                    <SettingRow
                      label={t('settings.language')}
                      control={
                        <select
                          className="ax-select"
                          style={{ width: 190 }}
                          aria-label={t('settings.language')}
                          value={settings.locale}
                          onChange={(event) => {
                            const locale = event.target.value;
                            setLocale(locale);
                            void patch({ locale });
                          }}
                        >
                          <option value="auto">{t('settings.languageAuto')}</option>
                          <option value="en">English</option>
                          <option value="zh-CN">简体中文</option>
                        </select>
                      }
                    />
                  </section>

                  <div className="ax-card ax-settings-ai">
                    <h3 className="ax-inline">
                      <KeyRound size={15} />
                      {t('settings.ai')}
                    </h3>
                    <p>{t('settings.aiDesc')}</p>
                    <div className="ax-inline" style={{ marginTop: 12 }}>
                      <button type="button" className="ax-btn" onClick={openOptions}>
                        {t('settings.openOptions')}
                      </button>
                      <span className="ax-badge">
                        {settings.ai.enabled
                          ? t('settings.aiReady')
                          : t('settings.aiNotConfigured')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ax-settings-column">
                  <section className="ax-settings-group">
                    <h3>{t('settings.groupTools')}</h3>
                    <ToggleRow
                      labelKey="settings.bookmarks"
                      descriptionKey="settings.bookmarksDesc"
                      checked={settings.features.bookmarks}
                      onChange={(value) => void patch({ features: { bookmarks: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.notes"
                      descriptionKey="settings.notesDesc"
                      checked={settings.features.notes}
                      onChange={(value) => void patch({ features: { notes: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.promptLibrary"
                      descriptionKey="settings.promptLibraryDesc"
                      checked={settings.features.promptLibrary}
                      onChange={(value) => void patch({ features: { promptLibrary: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.export"
                      descriptionKey="settings.exportDesc"
                      checked={settings.features.export}
                      onChange={(value) => void patch({ features: { export: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.bulk"
                      descriptionKey="settings.bulkDesc"
                      checked={settings.features.bulk}
                      onChange={(value) => void patch({ features: { bulk: value } })}
                    />
                    <ToggleRow
                      labelKey="settings.nativeTools"
                      descriptionKey="settings.nativeToolsDesc"
                      checked={settings.features.nativeTools}
                      onChange={(value) => void patch({ features: { nativeTools: value } })}
                    />
                    <SettingRow
                      label={t('settings.followUps')}
                      description={t('settings.followUpsDesc')}
                      control={
                        <select
                          className="ax-select"
                          style={{ width: 150 }}
                          aria-label={t('settings.followUps')}
                          value={settings.features.followUps}
                          onChange={(event) =>
                            void patch({
                              features: {
                                followUps: event.target.value as Settings['features']['followUps'],
                              },
                            })
                          }
                        >
                          <option value="off">{t('settings.followUpsOff')}</option>
                          <option value="heuristic">{t('settings.followUpsHeuristic')}</option>
                          <option value="ai">{t('settings.followUpsAi')}</option>
                        </select>
                      }
                    />
                    <ToggleRow
                      labelKey="settings.promptOptimizer"
                      descriptionKey="settings.promptOptimizerDesc"
                      checked={settings.features.promptOptimizer}
                      onChange={(value) => void patch({ features: { promptOptimizer: value } })}
                    />
                  </section>

                  <section className="ax-settings-group">
                    <h3>{t('settings.groupPrivacy')}</h3>
                    <p className="ax-settings-copy">{t('settings.privacyBody')}</p>
                    <h4 className="ax-settings-subhead">{t('settings.data')}</h4>
                    <p className="ax-settings-copy">{t('settings.dataDesc')}</p>
                    <div className="ax-inline ax-settings-actions">
                      <button type="button" className="ax-btn" onClick={onExport}>
                        <Download size={14} />
                        {t('settings.exportData')}
                      </button>
                      <button
                        type="button"
                        className="ax-btn"
                        onClick={() => importRef.current?.click()}
                      >
                        <Upload size={14} />
                        {t('settings.importData')}
                      </button>
                      <input
                        ref={importRef}
                        type="file"
                        accept="application/json"
                        className="ax-visually-hidden"
                        onChange={(event) => void onImport(event)}
                      />
                      {confirmReset ? (
                        <>
                          <button
                            type="button"
                            className="ax-btn ax-btn--danger"
                            onClick={() => void onReset()}
                          >
                            <Trash2 size={14} />
                            {t('common.confirm')}
                          </button>
                          <button
                            type="button"
                            className="ax-btn"
                            onClick={() => setConfirmReset(false)}
                          >
                            {t('common.cancel')}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="ax-btn ax-btn--danger"
                          onClick={() => void onReset()}
                        >
                          <Trash2 size={14} />
                          {t('settings.resetData')}
                        </button>
                      )}
                    </div>
                    <p className="ax-settings-storage">
                      {t('settings.storage')}: <strong>{formatBytes(bytes)}</strong>
                    </p>
                  </section>
                </div>
              </div>
            ) : null}

            {section === 'library' ? <PromptLibrary /> : null}

            {section === 'about' ? (
              <>
                <div className="ax-card">
                  <h3>{t('settings.aboutTitle')}</h3>
                  <p>{t('settings.aboutBody')}</p>
                  <dl className="ax-kv">
                    <dt>{t('settings.version')}</dt>
                    <dd>{version}</dd>
                    <dt>License</dt>
                    <dd>MIT</dd>
                    <dt>{t('settings.data')}</dt>
                    <dd>{t('common.localOnly')}</dd>
                  </dl>
                </div>
                <div className="ax-card">
                  <h3>{t('settings.shortcuts')}</h3>
                  <dl className="ax-kv">
                    <dt>{t('settings.shortcutCommandCenter')}</dt>
                    <dd>
                      <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>,</kbd>
                    </dd>
                    <dt>{t('settings.shortcutPalette')}</dt>
                    <dd>
                      <kbd>//</kbd>
                    </dd>
                    <dt>{t('settings.shortcutOptimizer')}</dt>
                    <dd>
                      <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd>
                    </dd>
                  </dl>
                </div>
                <div className="ax-card">
                  <h3>{t('settings.adapterTitle')}</h3>
                  <p>{t('settings.adapterDesc')}</p>
                  <dl className="ax-kv">
                    <dt>{t('settings.conversationId')}</dt>
                    <dd>{getConversationId() ?? '—'}</dd>
                    <dt>{t('settings.capabilities')}</dt>
                    <dd className="ax-inline" style={{ flexWrap: 'wrap', gap: 4 }}>
                      {capabilities
                        ? Object.entries(capabilities).map(([key, ok]) => (
                            <span key={key} className="ax-badge" title={key}>
                              {key}: {ok ? '✓' : '—'}
                            </span>
                          ))
                        : '—'}
                    </dd>
                    <dt>{t('settings.backendStatus')}</dt>
                    <dd>{backendStatus ?? t('settings.unknown')}</dd>
                  </dl>
                  <button
                    type="button"
                    className="ax-btn"
                    style={{ marginTop: 12 }}
                    onClick={() => void checkConnection()}
                  >
                    {t('settings.checkConnection')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
