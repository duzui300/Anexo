# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-10-29

### Added

- The new-folder form now includes an eight-color palette, so a folder's icon color can be chosen
  when it is created instead of always starting with the default bark tone. Subfolders start with
  their parent's color.

## [0.3.1] - 2026-10-25

### Added

- The right rail now closes when you click anywhere outside it with the primary button; clicks
  inside the rail (including its tabs, panel, and footer) keep it open.
- Folder drag-and-drop now supports sibling reordering with before/after insertion indicators,
  in addition to nesting and dropping to the top level.
- Bulk export selected conversations to a ZIP containing Markdown and self-contained HTML files
  plus a README. Individual Markdown/HTML export remains available from each row.

### Changed

- The minimap, bookmark, and note jumps now resolve messages by ChatGPT's message ids on the
  rendered turn, progressively loading older history when needed. A backend message index no longer
  maps onto a DOM turn index, so prompt/answer pairs and partially loaded conversations cannot
  shift the target. When ChatGPT merges consecutive assistant messages into one rendered response,
  a unique text match scrolls to the exact segment and outlines its block.

- The conversation organizer now lives in a floating right-hand drawer. A leaf button sits below
  ChatGPT's Share control; it opens the full organizer, which closes on an outside click or Escape.
  The drawer stays below the right rail's z-index and shifts left while the rail is open. ChatGPT's
  native sidebar and history stay visible. The right rail and its animation are unchanged.
- The composer's Polish prompt chip now appears only while the composer contains text.
- New prompts in the Command Center can be polished with the configured AI provider before saving;
  the rewritten draft lands back in the editor for review. Setup errors link to the AI options.
- Removed the now-obsolete "Replace native history list" setting row; the native list is always
  kept.
- Shortened the popup's quick-access labels and the minimap's prompt-view label so they fit at the
  default widths without wrapping or truncating.

- Redesigned the injected sidebar, right rail, overlay, Command Center, optimizer, prompt palette,
  side chat, and popup/welcome/options/lab pages in a restrained natural-organic style: warm cream
  paper, stone brown ink, sage interaction states, serif headings, organic radii, paper grain, and
  soft 320–480 ms transitions. Class names and behavior are unchanged.
- Restructured the layouts around a "field desk": the sidebar now has a search/new-folder toolbar,
  pinned folder views, a bounded collapsible folder shelf, an independently scrolling conversation
  pane with a sticky head, and a floating conversation menu; the right rail is a floating
  auto-height tool tray with a horizontal tab bar when open and a vertical dock when closed.
- The Command Center now uses horizontal top-level pills and a two-column settings ledger instead
  of a 228 px left nav and Display/Features/Privacy tabs. Options gained a masthead and sticky side
  index, welcome became a split field-guide spread, the popup uses a 2×2 quick-access grid, and the
  prompt palette docks above the composer.
- Removed the composer prompt chip; the palette now opens only from `//`. The bottom-right Anexo
  power button and its popover are gone, the right rail sits at the bottom edge, and the popup's
  minimap switch became a Command Center button. The popup is a full-bleed sheet without the outer
  frame. Removed the minimap and sidebar footer hints.
- Redrew the Anexo mark, logo, and extension icons as a two-tone leaf seal. Folder colors now use a
  warm palette with a display-time mapping for legacy values; jump highlights and stars are warm.

### Removed

- The "Phase 1" badge and its unused copy are gone from the sidebar.

### Fixed

- Starting a new chat from inside a folder now files that chat in the folder. ChatGPT briefly uses
  a temporary `local-chatgpt:<uuid>` URL before the first message; that id is no longer treated as
  a real conversation, so the pending folder survives until the actual conversation id appears.
  Pending assignments also survive DB updates and stale route state on the page they started from.
- Deleting a conversation now calls ChatGPT's real
  `DELETE /backend-api/conversation/id/:id` endpoint instead of a non-existent shorter path, so the
  chat disappears from ChatGPT itself, not only from Anexo. Folder assignments, bookmarks, and
  notes for that chat are removed locally as well.
- Delete no longer immediately refetches the conversation list, which could briefly re-add a chat
  while ChatGPT's list endpoint caught up.
- Dark-mode shadow surfaces were missing the base token block (radii, fonts, texture), which made
  panels and buttons render with square corners and fallback fonts. Base tokens now apply to
  `:root`, `:host`, and `.ax-root`, so dark mode matches the light layout.
- Primary and danger button labels inside shadow roots inherited the body text color instead of
  their variant color; text now stays readable on filled buttons.
- The ChatGPT sidebar can overflow the viewport when the Anexo panel and the native tool rows are
  both tall. The native nav is now scrollable and the Anexo panel body has a visible scrollbar, so
  the mouse wheel reaches everything below the panel.
- The right rail panel now fills its pinned container. Long minimap ("All"), bookmarks, and notes
  lists scroll inside the panel instead of stretching the whole rail past the viewport.

## [0.3.0] - 2026-10-24

### Fixed

- ChatGPT history sync. The backend list/detail endpoints silently return empty pages without the
  bearer token from `/api/auth/session`; Anexo now fetches and caches that token in content-script
  memory (never storage), sends it with backend calls, and refreshes it once on 401.
- Side Chat, the optimizer, and follow-ups now read context from the backend conversation detail,
  which works with the current ChatGPT DOM (no `data-message-author-role` on messages) and
  includes virtualized turns. DOM extraction remains the fallback for unsaved chats.

### Added

- Working minimap sourced from the conversation detail: search, prompts/all/code filters, message
  outline, jump-to-message, and per-message bookmark/note actions.
- Working bookmarks panel (current/all, jump, delete) and notes panel (add, edit, delete, jump,
  anchors), backed by the local database.
- Prompt library in the Command Center: create/edit/delete, search, insert into the composer,
  JSON import/export, plus a `//` and Ctrl/Cmd+Shift+P prompt palette and a composer chip.
- Conversation export to Markdown and self-contained HTML from the sidebar row menu.
- Bulk selection in the sidebar (star/unstar, archive, delete, move) gated by the Bulk feature.
- Drag-and-drop folder nesting and a top-level drop zone.
- E2E coverage for the minimap, bookmarks, notes, prompt library/palette, Markdown download, bulk
  selection, bearer-token auth, and the fixture conversation detail.

### Known gaps

- PDF export is not implemented yet; Markdown and HTML are.

## [0.2.0] - 2026-10-24

### Added

- BYOK AI provider settings for any OpenAI-compatible endpoint: base URL, model, utility model,
  reasoning effort (including `max`), thinking budget, temperature, output limit, streaming, and
  device/session key storage.
- Background-only AI transport with host permissions requested from the options page, an
  extension-origin IndexedDB secret store, SSE streaming, per-task timeouts, and abort support.
  API keys never enter ChatGPT pages, content scripts, or `chrome.storage.local`.
- Prompt optimizer: composer chip, `Ctrl/Cmd+Shift+E`, streaming compare dialog, regenerate, and
  "Use prompt" insertion.
- Side Chat in the right rail: streamed answers grounded in the current conversation, starters,
  stop, retry, clear, and Markdown rendering.
- AI follow-up suggestions with an opt-in provider mode, a local heuristic fallback, an in-session
  cache, and click-to-insert.
- Conversation organizer: nested folders with colors, rename, delete, subfolders, Unfiled and All
  chats views, local search and star filters, time buckets, infinite scroll, row actions, and a
  collapsible sidebar.
- Real-site ChatGPT composer support for the current ProseMirror editor in addition to legacy
  `#prompt-textarea`.
- Connection testing and provider error mapping for 401, 403, 404, 429, context overflow, and
  server failures.
- E2E coverage for BYOK streaming, request payload settings, key isolation, follow-ups, error
  mapping, abort, and the local mock provider; unit tests for prompts, follow-up heuristics, errors,
  SSE, and provider URL handling.

### Changed

- Command Center, popup, and power menu display the configured AI model or a not-configured state.
- Follow-ups, Side Chat, and the optimizer use their own timeouts (60s/180s); utility requests can
  use a separate utility model.

## [0.0.2] - 2026-10-24

### Added

- Reasoning effort and thinking budget fields in the AI provider settings.

### Fixed

- Mount the sidebar in the current ChatGPT layout (`#ds-sidebar`), with fallbacks for legacy
  `#history`, localized history navs, and generic sidebars. The sidebar is no longer appended to
  the bottom of the page when the old selector is missing.
- Render the right rail and power button immediately instead of waiting for the ChatGPT sidebar.
- Keep injected surfaces above host-page stacking contexts by raising their z-index.
- Re-anchor the sidebar on SPA navigation and on a faster retry interval.

## [0.0.1] - 2026-10-24

### Added

- WXT + React + TypeScript project foundation with strict TypeScript, ESLint, Prettier, Vitest,
  Playwright, and GitHub Actions.
- Anexo design tokens, brand assets, popup, welcome, options, and UI lab.
- Three injected surfaces (sidebar, right rail, overlay) with shadow DOM isolation, theme sync,
  and cleanup.
- Background single-writer database with Zod validation, migrations, corrupt-payload backups,
  and serialized semantic commands.
- Working Control Center with display, feature, privacy, library, and about sections; local data
  export/import/reset; and live ChatGPT adapter diagnostics.
- ChatGPT adapter spike: selectors, capability probes, navigation lifecycle, observers, a
  credentials-based backend client, and tolerant normalizers for conversations and projects.
- Mock ChatGPT and mock OpenAI-compatible servers for local development and e2e tests.
- Local-only UI reference capture harness for the original packed extension (gitignored).
- Unit tests for commands, migrations, deep merge, selectors, text utilities, and conversation
  normalization; Playwright smoke tests for surfaces, settings persistence, adapter diagnostics,
  and extension pages.
- Initial scaffold.
