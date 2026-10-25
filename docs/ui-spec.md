# UI specification

This document is filled in from the Phase 0 reference capture (see `reference-local/`, which is
gitignored). Only distilled dimensions, hierarchy, behavior, and tokens belong here — never
captured screenshots or copied assets.

## Brand

- Name: Anexo
- Mark: an organic pressed-leaf seal in stone brown and sage; no gradient, no perfect circle
- Product tone: a quiet field notebook — warm paper, ink, sage for interaction; calm, dense,
  keyboard-friendly, no promotional surfaces
- Type: system serif headings (Iowan Old Style / Palatino / Georgia + CJK serif fallback), system
  sans body; no downloaded fonts

## Tokens

Defined in `src/ui/tokens.css` as `--ax-*`. Light and dark themes share names; the base token
block applies to `:root`, `:host`, and `.ax-root` so shadow roots get radii, fonts, and texture in
dark mode too.

| Group     | Notes                                                                                 |
| --------- | ------------------------------------------------------------------------------------- |
| Brand     | stone brown `--ax-brand-600`, sage `--ax-brand-500`/`--ax-accent-500`                 |
| Surfaces  | warm cream `--ax-bg`/`--ax-surface`/`--ax-surface-sunken`                             |
| Text      | ink `--ax-text`, warm muted/subtle                                                    |
| Borders   | warm stone `--ax-border`/`--ax-border-strong`                                         |
| State     | terracotta danger, ochre warning, olive success                                       |
| Shape     | radii 10–30 px plus `--ax-radius-organic` (asymmetric panels) and pill controls       |
| Type      | `--ax-font` (sans body), `--ax-font-serif` (headings), 11–30 px scale, line 1.5       |
| Texture   | `--ax-paper-texture` static inline SVG grain on large paper surfaces                  |
| Motion    | 320/480 ms ease-in-out colour transitions; hover presses 1 px; reduced motion honored |
| Elevation | warm low-alpha `--ax-shadow-sm/md/lg`                                                 |

## Surfaces and dimensions (field-desk layout)

| Surface                 | Anexo dimensions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sidebar                 | the conversation organizer is a fixed right-hand drawer, 340 px wide (capped by the viewport), opened by a 36 px leaf launcher right-aligned 8 px below ChatGPT's Share control. Closed by default; outside pointerdown or Escape closes it. Right edge sits 68 px from the viewport when the rail is closed (12 px margin + 44 px rail + 12 px gap) and shifts left with the open rail. Top is the launcher bottom + 8 px; max-height is the viewport below it. Hidden with `display:none` but kept mounted so pending folder work survives. Native ChatGPT history stays visible. Inside: brand header, search/new-folder/star toolbar, pinned All chats/Unfiled views, collapsible folder shelf (`max-height: min(150px, 22vh)`) with its own scroll; conversation pane owns the remaining height and vertical scroll |
| Sidebar row             | folder/conversation rows min-height 28 px, 4 px padding, organic radius; inline folder indent `4 + 14 × depth`; row actions hidden until hover                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Conversation head       | sticky at the top of the conversation pane; view name, count, select and new-chat actions; dashed bottom rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Conversation menu       | fixed paper popover 240 px wide, measured from the kebab; flips above near the viewport bottom, closes on scroll/outside/Escape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Right rail              | floating tray fixed right 12 px, bottom 16 px, width 44 px closed / `railWidth` open (default 320 px), max-height 72vh; open panel height auto up to `calc(72vh - 48px)` with internal body scroll                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rail tabs               | five `.ax-whisker-tab` buttons in fixed order (minimap, bookmarks, notes, side chat, follow-ups); horizontal icon bar when open, vertical dock when closed; tab bar is right-aligned and only as wide as its buttons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Command Center          | 1180 px wide / 92vw, 820 px high / 90vh; horizontal General/Library/About pills in the header; General is a two-column settings ledger (Workspace, Conversation tools, Appearance & language, Privacy & data) with one scroll pane; Library/About full width                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Settings row            | 13 px vertical padding in the ledger; serif label, muted description, switch/segmented/select control                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Options page            | max-width 1180 px; masthead + sticky side index (anchors, version, BYOK, local-only note) + existing cards; one column below 860 px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Welcome                 | split field-guide spread: sage guide panel (brand, headline, clickable three-step index, progress, local-only badge) and paper step panel; stacks below 860 px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Popup                   | 340 px full-bleed sheet; 2×2 quick-access grid (three toggles plus a Command Center button); AI status row; full-width Open ChatGPT action; settings gear in the header                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Prompt palette          | opened only by `//`; docked bottom-center above the composer (`padding-bottom: clamp(96px, 15vh, 156px)`), max-height 62vh                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Theme segmented control | 3 equal segments, 44 px high; active segment uses the brand color                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Follow-up chips         | below assistant message; 8 px gap; wrap; 12 px label                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Anexo uses its own warm cream/stone/sage palette, serif headings, organic radii, and paper grain.
The table above is the current implementation, not the legacy reference geometry.

Z-index layers live in `src/ui/z-index.ts`: sidebar 2147482999, rail 2147483000, overlay
2147483001, toast 2147483002, modal 2147483003, menu 2147483004.

## Interaction rules

- Hover reveals row actions; selection is keyboard accessible.
- Context menus support ArrowUp/Down, Home/End, Enter, Escape.
- Dialogs use `<dialog>` in the overlay shadow root; focus is trapped and restored.
- `Ctrl/Cmd+Shift+Comma` opens the Command Center.
- `//` in the composer opens the prompt palette.
- `Ctrl/Cmd+Shift+E` runs the prompt optimizer when the composer is focused (Phase 2).
- The Polish prompt chip is hidden while the composer is empty and appears on input.
- New prompts in the Command Center offer AI optimize; the result replaces the draft for review.
- Reduced motion is honored globally.
- Light/dark follows the Anexo theme setting, defaulting to system.

## States

Every surface defines loading, empty, error, disabled, and unsupported-capability states. When a
ChatGPT capability probe fails, the surface hides and a single non-blocking diagnostic is shown in
settings, never an alert or thrown error.

## Reference capture

The Phase 0 harness loads the original packed extension unpacked in an isolated Chromium profile,
routes `https://chatgpt.com/*` to `tests/fixtures/chatgpt/page.html`, and captures screenshots,
host HTML, shadow HTML, and host computed styles. Outputs live in `reference-local/captures/` and
are gitignored. Distilled specs only belong in this document.

## Capture checklist

Sidebar, folder context menu, conversation context menu, multi-select bar, add-to-folder dialog,
details dialog, delete confirm, right rail (minimap/bookmarks/notes), side chat, optimizer chip,
Command Center (General/Library/AI/About), onboarding, popup, welcome, toasts, light/dark,
1280/1440/1920 widths.
