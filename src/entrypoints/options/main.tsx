import { StrictMode, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, KeyRound, Trash2, Upload } from 'lucide-react';
import { browser } from 'wxt/browser';
import type { ConnectionTestResult } from '@/ai/client';
import { permissionPattern } from '@/ai/config';
import { downloadText, exportFileName, parseDbFile, serializeDb } from '@/data/import-export';
import { dispatchDbCommand, fetchDbSnapshot } from '@/data/repository';
import type { AnexoDb, AiPreset, AiSettings, ReasoningEffort } from '@/data/schema';
import { setLocale, t, type MessageKey } from '@/i18n';
import { request } from '@/platform/messaging';
import { apiKeyHint, clearApiKey, getApiKey, saveApiKey } from '@/platform/secrets';
import { applyPageTheme, watchPageTheme } from '@/ui/page-theme';
import { Toggle } from '@/ui/primitives/Toggle';
import { AnexoMark } from '@/ui/AnexoMark';
import './style.css';

applyPageTheme();

type AiForm = Pick<
  AiSettings,
  | 'preset'
  | 'baseUrl'
  | 'model'
  | 'utilityModel'
  | 'reasoningEffort'
  | 'thinkingBudget'
  | 'temperature'
  | 'maxOutputTokens'
  | 'stream'
  | 'keyStorage'
>;

const PRESETS: { value: AiPreset; labelKey: MessageKey; baseUrl: string }[] = [
  { value: 'openai', labelKey: 'options.presetOpenai', baseUrl: 'https://api.openai.com/v1' },
  {
    value: 'anthropic',
    labelKey: 'options.presetAnthropic',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  {
    value: 'openrouter',
    labelKey: 'options.presetOpenrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  { value: 'groq', labelKey: 'options.presetGroq', baseUrl: 'https://api.groq.com/openai/v1' },
  { value: 'ollama', labelKey: 'options.presetOllama', baseUrl: 'http://localhost:11434/v1' },
  { value: 'lmstudio', labelKey: 'options.presetLmstudio', baseUrl: 'http://localhost:1234/v1' },
  { value: 'custom', labelKey: 'options.presetCustom', baseUrl: '' },
];

function getVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

function Options() {
  const [db, setDb] = useState<AnexoDb | null>(null);
  const [form, setForm] = useState<AiForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    let stopTheme = () => {};
    void fetchDbSnapshot()
      .then(async (value) => {
        if (!live) return;
        setDb(value);
        setForm({
          preset: value.settings.ai.preset,
          baseUrl: value.settings.ai.baseUrl,
          model: value.settings.ai.model,
          utilityModel: value.settings.ai.utilityModel,
          reasoningEffort: value.settings.ai.reasoningEffort,
          thinkingBudget: value.settings.ai.thinkingBudget,
          temperature: value.settings.ai.temperature,
          maxOutputTokens: value.settings.ai.maxOutputTokens,
          stream: value.settings.ai.stream,
          keyStorage: value.settings.ai.keyStorage,
        });
        setLocale(value.settings.locale);
        stopTheme = watchPageTheme(value.settings.theme);
        const key = await getApiKey(value.settings.ai.keyStorage);
        if (live) setHasKey(Boolean(key));
      })
      .catch((loadError: unknown) => {
        if (live) setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
    return () => {
      live = false;
      stopTheme();
    };
  }, []);

  const update = (patch: Partial<AiForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setSaved(false);
  };

  const save = async (): Promise<boolean> => {
    if (!form) return false;
    try {
      setError(null);
      setTestError(null);
      setTestResult(null);

      let hint = db?.settings.ai.keyHint ?? null;
      let storedNewKey = false;

      if (keyInput.trim()) {
        await saveApiKey(keyInput.trim(), form.keyStorage);
        hint = apiKeyHint(keyInput);
        storedNewKey = true;
        setHasKey(true);
        setKeyInput('');
      } else if (hasKey && db && form.keyStorage !== db.settings.ai.keyStorage) {
        const existing = await getApiKey(db.settings.ai.keyStorage);
        if (existing) {
          await saveApiKey(existing, form.keyStorage);
          hint = apiKeyHint(existing);
        }
      }

      const enabled = Boolean(form.baseUrl.trim() && form.model.trim() && (storedNewKey || hasKey));
      const next = await dispatchDbCommand({
        kind: 'settings/patch',
        patch: { ai: { ...form, enabled, keyHint: hint } },
      });
      setDb(next);
      setSaved(true);
      applyPageTheme(next.settings.theme);
      window.setTimeout(() => setSaved(false), 1800);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      return false;
    }
  };

  const ensurePermission = async (): Promise<boolean> => {
    if (!form?.baseUrl.trim()) return true;
    try {
      return await browser.permissions.request({
        origins: [permissionPattern(form.baseUrl)],
      });
    } catch (permissionError) {
      setError(
        permissionError instanceof Error ? permissionError.message : String(permissionError),
      );
      return false;
    }
  };

  const onSave = async () => {
    if (!form) return;
    const granted = await ensurePermission();
    if (!granted) {
      setError(t('options.permissionDenied'));
      return;
    }
    await save();
  };

  const test = async () => {
    if (!form) return;
    const granted = await ensurePermission();
    if (!granted) {
      setTestError(t('options.permissionDenied'));
      return;
    }
    if (!(await save())) return;

    setTesting(true);
    setTestError(null);
    try {
      const result = await request<ConnectionTestResult>({ type: 'ai:test' });
      setTestResult(result);
    } catch (testFailure) {
      setTestError(testFailure instanceof Error ? testFailure.message : String(testFailure));
    } finally {
      setTesting(false);
    }
  };

  const onClearKey = async () => {
    try {
      setError(null);
      setTestResult(null);
      setTestError(null);
      await clearApiKey();
      setHasKey(false);
      setKeyInput('');
      const next = await dispatchDbCommand({
        kind: 'settings/patch',
        patch: { ai: { enabled: false, keyHint: null } },
      });
      setDb(next);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    }
  };

  const onExport = () => {
    if (db) downloadText(exportFileName(), serializeDb(db));
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const imported = parseDbFile(await file.text());
      const next = await dispatchDbCommand({ kind: 'db/replace', db: imported });
      setDb(next);
      setForm({
        preset: next.settings.ai.preset,
        baseUrl: next.settings.ai.baseUrl,
        model: next.settings.ai.model,
        utilityModel: next.settings.ai.utilityModel,
        reasoningEffort: next.settings.ai.reasoningEffort,
        thinkingBudget: next.settings.ai.thinkingBudget,
        temperature: next.settings.ai.temperature,
        maxOutputTokens: next.settings.ai.maxOutputTokens,
        stream: next.settings.ai.stream,
        keyStorage: next.settings.ai.keyStorage,
      });
      const key = await getApiKey(next.settings.ai.keyStorage);
      setHasKey(Boolean(key));
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
      const next = await dispatchDbCommand({ kind: 'db/reset' });
      setDb(next);
      setConfirmReset(false);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : String(resetError));
    }
  };

  return (
    <main className="ax-options">
      <header className="ax-options__header">
        <div className="ax-options__brand">
          <AnexoMark size={40} />
          <div>
            <h1>{t('options.title')}</h1>
            <p>{t('options.subtitle')}</p>
          </div>
        </div>
        <span className="ax-badge">{t('welcome.localFirst')}</span>
      </header>

      {error ? <div className="ax-error">{error}</div> : null}

      <div className="ax-options__layout">
        <aside className="ax-options__index" aria-label={t('options.onThisPage')}>
          <div className="ax-options__index-card">
            <div className="ax-options__index-title">{t('options.onThisPage')}</div>
            <nav className="ax-options__index-nav">
              <a className="ax-options__index-link" href="#ax-options-ai">
                {t('options.aiTitle')}
              </a>
              <a className="ax-options__index-link" href="#ax-options-data">
                {t('options.dataTitle')}
              </a>
              <a className="ax-options__index-link" href="#ax-options-about">
                {t('options.aboutTitle')}
              </a>
            </nav>
            <div className="ax-options__index-meta">
              <span>
                {t('options.version')} {getVersion()}
              </span>
              <span className="ax-badge">{t('options.byok')}</span>
              <span>{t('settings.privacyBody')}</span>
            </div>
          </div>
        </aside>

        <div className="ax-options__cards">
          <section id="ax-options-ai" className="ax-card ax-options__card">
            <h2 className="ax-inline">
              <KeyRound size={16} />
              {t('options.aiTitle')}
            </h2>
            <p>{t('options.aiDesc')}</p>

            {form ? (
              <div className="ax-options__form">
                <label className="ax-options__field">
                  <span>{t('options.preset')}</span>
                  <select
                    className="ax-select"
                    value={form.preset}
                    onChange={(event) => {
                      const preset = event.target.value as AiPreset;
                      const match = PRESETS.find((item) => item.value === preset);
                      update({
                        preset,
                        baseUrl: match && match.baseUrl ? match.baseUrl : form.baseUrl,
                      });
                    }}
                  >
                    {PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {t(preset.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="ax-options__field">
                  <span>{t('options.baseUrl')}</span>
                  <input
                    className="ax-input"
                    value={form.baseUrl}
                    onChange={(event) => update({ baseUrl: event.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                </label>

                <label className="ax-options__field">
                  <span>{t('options.model')}</span>
                  <input
                    className="ax-input"
                    value={form.model}
                    onChange={(event) => update({ model: event.target.value })}
                    placeholder="gpt-5"
                  />
                </label>

                <label className="ax-options__field">
                  <span>{t('options.utilityModel')}</span>
                  <input
                    className="ax-input"
                    value={form.utilityModel}
                    onChange={(event) => update({ utilityModel: event.target.value })}
                    placeholder="gpt-5-mini"
                  />
                </label>

                <label className="ax-options__field ax-options__field--half">
                  <span>{t('options.reasoningEffort')}</span>
                  <select
                    className="ax-select"
                    value={form.reasoningEffort}
                    onChange={(event) =>
                      update({ reasoningEffort: event.target.value as ReasoningEffort })
                    }
                  >
                    <option value="default">{t('options.reasoningDefault')}</option>
                    <option value="none">{t('options.reasoningNone')}</option>
                    <option value="low">{t('options.reasoningLow')}</option>
                    <option value="medium">{t('options.reasoningMedium')}</option>
                    <option value="high">{t('options.reasoningHigh')}</option>
                    <option value="max">{t('options.reasoningMax')}</option>
                  </select>
                </label>

                <label className="ax-options__field ax-options__field--half">
                  <span>{t('options.thinkingBudget')}</span>
                  <input
                    className="ax-input"
                    type="number"
                    min={0}
                    max={100_000}
                    step={256}
                    value={form.thinkingBudget}
                    onChange={(event) =>
                      update({
                        thinkingBudget: Math.max(
                          0,
                          Math.min(100_000, Number(event.target.value) || 0),
                        ),
                      })
                    }
                  />
                  <small className="ax-options__hint">{t('options.thinkingBudgetHint')}</small>
                </label>

                <label className="ax-options__field ax-options__field--full">
                  <span>{t('options.apiKey')}</span>
                  <div className="ax-inline ax-options__key-row">
                    <input
                      className="ax-input"
                      type="password"
                      value={keyInput}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => setKeyInput(event.target.value)}
                      placeholder={hasKey ? t('options.apiKeyStored') : t('options.apiKeyHint')}
                    />
                    {hasKey ? (
                      <button type="button" className="ax-btn" onClick={() => void onClearKey()}>
                        {t('options.clearKey')}
                      </button>
                    ) : null}
                  </div>
                  <small className="ax-options__hint">
                    {hasKey && db?.settings.ai.keyHint
                      ? t('options.apiKeyHintSaved', { hint: db.settings.ai.keyHint })
                      : t('options.apiKeyHint')}
                  </small>
                </label>

                <label className="ax-options__field ax-options__field--half">
                  <span>{t('options.keyStorage')}</span>
                  <select
                    className="ax-select"
                    value={form.keyStorage}
                    onChange={(event) =>
                      update({ keyStorage: event.target.value as AiSettings['keyStorage'] })
                    }
                  >
                    <option value="device">{t('options.keyStorageDevice')}</option>
                    <option value="session">{t('options.keyStorageSession')}</option>
                  </select>
                </label>

                <label className="ax-options__field ax-options__field--half">
                  <span>{t('options.temperature')}</span>
                  <input
                    className="ax-input"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature}
                    onChange={(event) => update({ temperature: Number(event.target.value) })}
                  />
                </label>

                <label className="ax-options__field ax-options__field--half">
                  <span>{t('options.maxTokens')}</span>
                  <input
                    className="ax-input"
                    type="number"
                    min={1}
                    max={32768}
                    value={form.maxOutputTokens}
                    onChange={(event) => update({ maxOutputTokens: Number(event.target.value) })}
                  />
                </label>

                <div className="ax-options__field ax-options__inline">
                  <span>{t('options.stream')}</span>
                  <Toggle
                    label={t('options.stream')}
                    checked={form.stream}
                    onChange={(value) => update({ stream: value })}
                  />
                </div>
              </div>
            ) : (
              <p>{t('popup.loading')}</p>
            )}

            <div className="ax-inline ax-options__actions">
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => void onSave()}
              >
                {t('options.save')}
              </button>
              {saved ? <span className="ax-badge">{t('options.saved')}</span> : null}
              <button
                type="button"
                className="ax-btn"
                disabled={testing}
                onClick={() => void test()}
              >
                {testing ? t('options.testing') : t('options.test')}
              </button>
              {testResult ? (
                <span className="ax-badge">
                  {t('options.testSuccess', { ms: String(testResult.latencyMs) })}
                </span>
              ) : null}
              <span className="ax-badge">{t('options.byok')}</span>
              {testError ? (
                <div className="ax-error" style={{ width: '100%' }}>
                  {testError}
                </div>
              ) : null}
            </div>
          </section>

          <section id="ax-options-data" className="ax-card ax-options__card">
            <h2>{t('options.dataTitle')}</h2>
            <p>{t('options.dataDesc')}</p>
            <div className="ax-inline ax-options__actions" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="ax-btn" onClick={onExport} disabled={!db}>
                <Download size={14} />
                {t('settings.exportData')}
              </button>
              <button type="button" className="ax-btn" onClick={() => importRef.current?.click()}>
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
                  <button type="button" className="ax-btn" onClick={() => setConfirmReset(false)}>
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
          </section>

          <section id="ax-options-about" className="ax-card ax-options__card">
            <h2>{t('options.aboutTitle')}</h2>
            <p>{t('options.aboutDesc')}</p>
            <dl className="ax-kv">
              <dt>{t('options.version')}</dt>
              <dd>{getVersion()}</dd>
              <dt>License</dt>
              <dd>MIT</dd>
              <dt>{t('settings.privacyTitle')}</dt>
              <dd>{t('settings.privacyBody')}</dd>
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
