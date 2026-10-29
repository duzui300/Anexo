# Testing

## Commands

```bash
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
npm run mock:openai     # http://127.0.0.1:11435/v1
npm run build
npm run scan:forbidden
npm run check           # everything above except e2e
```

## Unit tests (Vitest)

Pure logic only:

- folder tree: cycle validation, ordering, rebalance, recursive delete, unfiled behavior
- time bucket boundaries in local timezone
- message reference fallback and jump keys
- minimap outline extraction and filters
- prompt variable parsing and replacement
- optimizer output parsing, no-op detection, code-fence stripping, clipping
- side chat context budgeting
- follow-up JSON parsing and heuristics
- SSE parser: CRLF, multiple `data:`, `[DONE]`, content arrays, usage, malformed frames, abort
- provider URL normalization and error mapping
- export builders and ZIP filenames
- schema validation, migrations, corrupt-payload salvage

## Component tests

Testing Library + jsdom + MSW for menus, settings persistence, dialog focus, provider form masking,
bookmark/note editors, toast undo, prompt palette, and empty/loading/error states.

## End-to-end tests (Playwright)

Build a test extension with `E2E=1 npm run build`; localhost mock hosts are added to the content
script matches and localhost is allowed for the mock AI provider.

Fixtures:

- `tests/fixtures/chatgpt/page.html` — mock ChatGPT UI with old and new selectors
- `scripts/mock-chatgpt-server.mjs` — mock `/backend-api/*`
- `scripts/mock-openai-server.mjs` — SSE provider with `mock-ok`, `mock-optimizer`,
  `mock-followups`, `mock-401`, `mock-429`, `mock-slow`, `mock-abort`

Scenarios: sidebar CRUD and drag-drop, search/star/buckets, timestamps, bookmarks/notes/highlights,
minimap, bulk 429 pause/stop/retry, prompt palette, exports, settings persistence, onboarding,
BYOK configuration and streaming, network allowlist, and secret non-exposure.

## Mock provider

```bash
npm run mock:openai
```

Configure in Anexo options:

- Base URL: `http://127.0.0.1:11435/v1`
- API key: `test-key`
- Model: `mock-ok` (or `mock-optimizer`, `mock-followups`)

## Manual QA

Fresh Chrome profile; load `.output/chrome-mv3` unpacked. Check:

- signed-out and signed-in ChatGPT; new chat, existing chat, SPA navigation
- light/dark/system; 80/100/125% zoom; 1280/1440/1920 widths
- long conversation with code, headings, images, math, links, streaming, regeneration
- every surface and setting; data export/import/reset
- exports in an editor/browser/print dialog
- AI: valid/invalid key, wrong base URL, denied permission, 401, 429, timeout, abort
- keyboard-only traversal, focus return, Escape, reduced motion
- multi-tab storage sync, corrupt storage recovery, disable/re-enable cleanup
- network audit: only ChatGPT and the configured provider; no key in DOM, storage, or console
