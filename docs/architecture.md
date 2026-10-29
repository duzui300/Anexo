# Architecture

## Overview

Anexo is a Manifest V3 extension built with WXT, React, and TypeScript. It injects three
long-lived React surfaces into ChatGPT pages plus small custom elements for repeated per-message
UI. All user data is local; AI is optional and proxied through the background worker.

## Entrypoints

| Entrypoint                  | Purpose                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| `background.ts`             | Database single writer, AI transport, commands, first-install welcome tab |
| `chatgpt.content/index.tsx` | Content bootstrap: lifecycle, observers, surface mounting                 |
| `chatgpt-auth.content.ts`   | Optional MAIN-world auth bridge (memory only), enabled only if needed     |
| `popup`                     | Quick access toggles, Command Center and status                           |
| `welcome`                   | Onboarding                                                                |
| `options`                   | Settings and the only AI API-key input                                    |
| `lab`                       | Internal UI gallery, not linked from production UI                        |

## Module boundaries

```
src/chatgpt/   ChatGPT DOM selectors, navigation, observers, backend adapter
src/data/      Schema, defaults, migrations, commands, background writer, caches
src/domain/    Pure logic: folder tree, buckets, message refs, outline, exports
src/ai/        Provider config, SSE, errors, budgets, secrets, prompt builders
src/stores/    Zustand stores for settings, directory, library, side chat, toasts
src/features/  Vertical feature UI and orchestration
src/ui/        Tokens, primitives, icons, z-index
src/platform/  Typed wrappers for runtime, storage, permissions, logging
src/i18n/      Typed catalogs (en, zh-CN)
```

Dependency rule: `features -> stores/domain -> data/platform`, and only `src/chatgpt` may know
ChatGPT selectors or endpoints. `src/domain` is pure and must not import Chrome APIs or React.

## Surfaces

1. **Sidebar** — a fixed right-hand conversation-organizer drawer with a leaf launcher; it never
   mounts inside ChatGPT's sidebar, so the native history stays visible. The panel is hidden with
   `display:none` when closed but stays mounted for pending folder work.
2. **Right rail** — floating fixed tray with a whisker tab strip.
3. **Overlay** — toasts, context menus, dialogs, Command Center, onboarding.
4. **Micro custom elements** — `<anexo-turn-tools>` and `<anexo-followups>`, each with its own open
   shadow root.

Each surface host gets an `--ax-*` token set and `data-ax-theme`. Dialogs and menus always render
in the overlay root; React portals never cross shadow boundaries.

## Messaging

Typed runtime messages and ports:

- `db:snapshot`, `db:command` — content reads and semantic mutations; background is the sole writer.
- `ai:stream` (port), `ai:cancel`, `ai:configure`, `ai:testConnection`, `ai:clearKey` — AI is
  configured in options and executed in background. Content never receives the API key.
- `ui:openCommandCenter`, `ui:openOptions` — cross-context navigation.

The background validates the sender tab/origin and payload shape for every message class. There is
no `externally_connectable`.

## Lifecycle

- Content script runs at `document_start` in the top frame only.
- URL changes are detected with `popstate` plus a bounded URL poll (optionally WXT's
  `wxt:locationchange` when available).
- Each concern has one debounced `MutationObserver`; observers pause while the document is hidden.
- Reconciliation is idempotent and ignores mutations caused by Anexo hosts.
- On navigation, conversation-scoped services reset and in-flight requests abort.
- On extension invalidation or removal, hosts are removed and native sidebar rows restored.
