import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AnexoMark } from '@/ui/AnexoMark';
import './style.css';

function Lab() {
  return (
    <main className="ax-lab">
      <header className="ax-lab__header">
        <AnexoMark size={30} />
        <div>
          <h1>Anexo UI Lab</h1>
          <p>
            Internal gallery for the natural-organic components. Not linked from the product UI.
          </p>
        </div>
      </header>

      <div className="ax-lab__grid">
        <section className="ax-card">
          <h3>Buttons</h3>
          <div className="ax-inline" style={{ flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="ax-btn ax-btn--primary">
              Save changes
            </button>
            <button type="button" className="ax-btn">
              Cancel
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              Ghost
            </button>
            <button type="button" className="ax-btn ax-btn--danger">
              Reset data
            </button>
          </div>
        </section>

        <section className="ax-card">
          <h3>Fields</h3>
          <div className="ax-lab__stack">
            <label className="ax-field">
              Base URL
              <input className="ax-input" defaultValue="https://api.openai.com/v1" />
            </label>
            <label className="ax-field">
              Note
              <textarea
                className="ax-input"
                rows={3}
                defaultValue="A note anchored to this message."
              />
            </label>
          </div>
        </section>

        <section className="ax-card">
          <h3>Controls</h3>
          <div className="ax-lab__stack">
            <div className="ax-segmented" role="group" aria-label="Theme example">
              <button type="button">System</button>
              <button type="button" data-active="true">
                Light
              </button>
              <button type="button">Dark</button>
            </div>
            <div className="ax-inline">
              <button
                type="button"
                role="switch"
                aria-checked="true"
                aria-label="Toggle example"
                className="ax-switch"
              >
                <span className="ax-switch__thumb" />
              </button>
              <span className="ax-badge">Saved</span>
              <span className="ax-row-badge">12</span>
            </div>
          </div>
        </section>

        <section className="ax-card">
          <h3>States</h3>
          <div className="ax-lab__stack">
            <div className="ax-empty">No conversations match your filters.</div>
            <div className="ax-error">Invalid API key. Check the provider settings.</div>
            <div className="ax-note">
              Folders are stored locally. ChatGPT history stays in ChatGPT.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lab />
  </StrictMode>,
);
