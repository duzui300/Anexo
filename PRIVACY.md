# Privacy

Anexo is local-first. It has no backend service, no account system, no analytics, and no
advertising.

## What Anexo stores

All user data is stored on your device with `chrome.storage.local`:

- folders, conversation-to-folder mappings, conversation stars
- message bookmarks (a short preview, not the full message)
- notes and their anchors
- prompts and installed prompt packs
- settings and UI state
- bounded caches (conversation index, timestamps, minimap outlines, suggestions)

You can export or delete this data at any time from Anexo settings.

## Network requests

Anexo makes exactly two kinds of network requests:

1. **ChatGPT** (`https://chatgpt.com`, `https://chat.openai.com`) — to list, search, read, rename,
   archive, delete, star, or export conversations you act on, using your existing ChatGPT session.
   This uses ChatGPT's internal web API and can break when ChatGPT changes it.
2. **Your AI provider** (Phase 2, optional) — only when you configure BYOK and invoke an AI
   feature. Requests go from the extension background directly to the base URL you configure.
   Anexo does not proxy, log, or retain prompts on any server.

No requests are made to Anexo-owned servers. There is no telemetry, crash reporting, remote
configuration, or A/B testing.

## API keys

Your AI API key is stored in extension-origin IndexedDB (or session storage if you choose
session-only mode). It is never written to `chrome.storage.local`, never exposed to content
scripts, and never inserted into ChatGPT pages. See [SECURITY.md](SECURITY.md).

## Permissions

- `storage` — required to save your folders, bookmarks, notes, prompts, and settings.
- Host access to ChatGPT — required to inject the UI and act on your conversations.
- Optional host access to your AI provider — requested only when you configure BYOK.

Anexo does not request `identity`, `cookies`, `tabs`, `webRequest`, `notifications`, or
`unlimitedStorage`.

## Contact

Open an issue in the project repository for privacy questions.
