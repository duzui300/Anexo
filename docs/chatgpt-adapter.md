# ChatGPT adapter

All ChatGPT-specific knowledge lives in `src/chatgpt/`. Everything here is unofficial and may break
without notice.

## DOM selectors

| Purpose                | Primary selectors                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Visible root           | first visible `<main>`, else `document`                                                                                        |
| Conversation ID        | `/c/:id` pathname, hash/query fallbacks. Temporary `local-chatgpt:<uuid>` ids used before the first message resolve to `null`. |
| Turn container         | `[data-testid^="conversation-turn-"]`                                                                                          |
| Message ID             | `data-message-id`, `data-message-uuid`, stable `id`                                                                            |
| Role                   | `data-message-author-role`, `data-author-role`, `data-turn`                                                                    |
| New UI fallbacks       | `[data-chatgpt-search-unit-key]`, `[data-turn-key]`, `[data-turn-id-container]`                                                |
| Composer               | `#prompt-textarea`, `[data-testid="composer-text-input"]`                                                                      |
| Send / stop            | `[data-testid="send-button"]`, `[data-testid="stop-button"]`                                                                   |
| Assistant content      | `.markdown`, `.prose`, `[data-message-content]`                                                                                |
| Chat history / sidebar | `#history`, `#ds-sidebar` — read for capabilities, not used as an Anexo mount                                                  |
| Toolbar                | `[data-testid*="copy-turn"]`, `.turn-actions`                                                                                  |

The selector module exposes a capabilities object (`sidebar`, `composer`, `messageIds`,
`timestamps`, `toolbar`, `streaming`, `historyApi`). A surface whose capability is missing hides
itself and reports a non-blocking diagnostic instead of throwing.

## Navigation

`popstate` plus a bounded URL poll; optionally WXT's `wxt:locationchange`. On change:
reset conversation-scoped services, abort in-flight requests, re-root surfaces, restart observers.

## Observers

One debounced observer per concern:

- sidebar 300 ms
- rail/current conversation 500 ms
- turn tools/timestamps 250 ms
- follow-ups 100 ms

Observers pause when `document.hidden`, ignore Anexo-caused mutations, and reconcile idempotently.

## Backend endpoints

Same-origin requests with the user's ChatGPT session:

| Method | Path                                        | Purpose                                                              |
| ------ | ------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/backend-api/conversations`                | List conversations                                                   |
| GET    | `/backend-api/conversation/:id`             | Full conversation JSON                                               |
| PATCH  | `/backend-api/conversation/:id`             | Rename, archive, soft-delete, star, move to project                  |
| DELETE | `/backend-api/conversation/id/:id`          | Permanently delete; the shorter `/conversation/:id` path answers 405 |
| GET    | `/backend-api/conversations/search`         | Search                                                               |
| GET    | `/backend-api/gizmos/snorlax/sidebar`       | Projects                                                             |
| GET    | `/backend-api/models`                       | Model list                                                           |
| GET    | `/backend-api/accounts/check/v4-2023-04-27` | Plan capture                                                         |

Mutation bodies: `{ "title": "..." }`, `{ "is_archived": true }`, `{ "is_visible": false }`,
`{ "is_starred": true }`, `{ "gizmo_id": "..." }`.

## Auth

1. Try same-origin requests with `credentials: "include"`.
2. If 401, consider reading a token from inline page scripts.
3. Only if necessary, add a narrow MAIN-world bridge that reports outbound `Authorization` headers
   for `/backend-api` requests. The token stays in memory for the tab lifetime; never persisted,
   logged, or sent to the Anexo background.

## Rate limits

Separate read and write queues; max 2 reads or 1 write concurrently; 250–400 ms spacing for bulk
operations; respect `Retry-After`; exponential backoff with jitter; visible pause/retry; no retries
for 401; abort on navigation.

## Disclosures

First run shows a one-time plain-language notice: Anexo reads and acts on the user's own ChatGPT
session, all Anexo data stays local except requests to ChatGPT, and the project is not affiliated
with OpenAI.
