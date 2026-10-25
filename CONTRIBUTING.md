# Contributing

## Setup

```bash
npm install
npm run icons
npm run dev
```

Load `.output/chrome-mv3-dev` as an unpacked extension in Chrome or Edge.

## Before opening a pull request

```bash
npm run check
```

This runs typecheck, ESLint, unit tests, a production build, and a forbidden-string scan. Add or
update tests for behavior changes. Keep the bundle small: no UI kits, AI SDKs, or remote code.

## Architecture rules

- `src/chatgpt/` is the only place that knows ChatGPT DOM selectors or internal endpoints.
- `src/data/` owns the database schema, migrations, and the background single-writer queue.
- `src/domain/` is pure logic and must not touch the DOM or Chrome APIs.
- `src/features/` uses services and stores; it must not read raw selectors or endpoints.
- `src/ai/` has no Chrome API calls directly; adapters are injected.
- Content scripts never receive the AI API key.

## ChatGPT selector changes

ChatGPT changes its DOM regularly. When a surface breaks:

1. Add or update the selector/fallback in `src/chatgpt/selectors.ts`.
2. Add a fixture case in `tests/fixtures/dom/` (legacy and new UI).
3. Add an e2e assertion for the surface.
4. Keep the capability probe honest: if a capability is missing, hide the surface instead of
   throwing.

## Commit style

Conventional commits are appreciated (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Keep PRs
focused. Do not add telemetry, remote configuration, or account systems.
