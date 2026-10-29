# Feature parity

Anexo rebuilds the useful, local-first feature set of its reference product and intentionally omits
every account, billing, quota, telemetry, and promotional surface.

| Feature | Phase 1 | Phase 2 | Notes |
| --- | --- | --- | --- |
| Nested folders, colors, drag-drop, move-to-root | Yes | — | Virtual Unfiled root; no folder limit |
| Conversation search, star filter, time buckets, infinite scroll | Yes | — | Server search with local fallback |
| Conversation menu: rename, star, archive, delete, copy link, open tab, note, details, move, export | Yes | — | Pin and star consolidate to native Star |
| Multi-select + bulk archive/delete/move/star/export | Yes | — | Progress, stop, retry, 429 pause |
| Message timestamps | Yes | — | From conversation snapshot; skeleton state |
| Message bookmarks and notes with highlights | Yes | — | Local, unlimited; note highlights via CSS Highlight API |
| Right rail: minimap, bookmarks, notes | Yes | — | No inbox |
| Minimap outline/search/depth/code filter/auto-follow/jump | Yes | — | Local cache |
| Prompt library, `//` palette, variables, packs | Yes | — | Local import/export; no paid pack store |
| Exports: Markdown/HTML/PDF, bulk ZIP | Yes | — | No bulk PDF |
| Heuristic follow-up suggestions | Yes | — | Free fallback |
| Prompt optimizer, side chat, AI follow-ups | Hidden | BYOK | Opt-in; no automatic requests |
| Settings, Command Center, popup, welcome, onboarding | Yes | Adds AI provider | No account tab |
| Keyboard shortcuts | Yes | Adds optimizer shortcut | |
| Account, Google sign-in, Stripe, billing, plans | Removed | Removed | No identity permission |
| Usage limits, tiers, upsell, counters | Removed | Removed | No such schema fields |
| Telemetry, remote flags/config, notifications, review prompts, offers | Removed | Removed | No remote config |
| `page-size.js` fetch patch and 429 tap | Removed | Removed | May return as opt-in experiment |
| Side Chat rating backend | Removed | Removed | No ratings sent |

## Replacement surfaces

- Account tab → AI Provider settings (Phase 2).
- Popup account card → quick toggles and status.
- Welcome sign-in/plans → three-step local onboarding.
- Footer upgrade/usage → removed.
- Inbox → removed.
- Help form → About, privacy, shortcuts, and source links.
