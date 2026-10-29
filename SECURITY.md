# Security

## Threat model

Anexo runs in two trust zones:

- **Content script** — isolated from page JavaScript by Chrome, but sharing the DOM. It reads the
  ChatGPT DOM and talks to ChatGPT's same-origin backend with the user's existing session.
- **Extension background/options** — holds the AI provider configuration and API key. Content
  scripts cannot read extension-origin IndexedDB and are never sent the key.

The AI key is stored in extension-origin IndexedDB by default, or in `chrome.storage.session` with
`TRUSTED_CONTEXTS` access in session-only mode. It is never written to `chrome.storage.local`,
never injected into ChatGPT pages, and never included in logs or error messages.

This protects against page JavaScript and accidental exposure through content scripts. It does not
protect against a compromised browser profile, malicious local software, or a malicious extension
with broad permissions. A passphrase-encrypted vault is a possible future enhancement, not a
replacement for OS account security.

## AI requests

- Requests are constructed and sent by the background service worker.
- Content scripts send semantic requests only (`optimize`, `sideChat`, `followUps`); they cannot
  choose the base URL, model, headers, or key.
- Base URLs must be HTTPS, except `localhost`/`127.0.0.1`.
- Redirects to a different origin are rejected.
- Response bodies are streamed to the requesting tab and not persisted.
- Prompt text is never logged. A local debug buffer, if enabled, records metadata only.

## ChatGPT integration

Anexo uses ChatGPT's internal web endpoints for conversation list/search/detail and for mutations
such as rename, archive, delete, star, and move-to-project. These endpoints are unofficial and may
change without notice. Access uses the user's own ChatGPT session. Anexo does not store the
ChatGPT access token; if a token bridge is required, the token stays in memory for the tab lifetime.

## Reporting a vulnerability

Please open a private security advisory in the project repository, or email the maintainers if a
private channel is listed. Include reproduction steps and the affected version. Do not include real
API keys or private conversation content.
