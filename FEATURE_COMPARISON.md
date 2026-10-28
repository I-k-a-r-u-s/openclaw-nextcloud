# Feature Comparison: `openclaw-nextcloud` vs. `cbcoutinho/nextcloud-mcp-server`

**Date:** 2026-10-28
**Compared against:** [`cbcoutinho/nextcloud-mcp-server`](https://github.com/cbcoutinho/nextcloud-mcp-server) @ `master` (sha `86c8504`) — analysis based on the actual tool definitions in `nextcloud_mcp_server/server/*.py`, not just its README.

---

## TL;DR

The two projects overlap on the "personal CRUD core" (notes, files, calendar, contacts, deck, shares, basic chat) and are otherwise highly complementary:

- **This skill wins on Talk API depth** — polls, message edit/delete, conversation settings, bots, avatars, participant moderation — none of which exist upstream — plus notes history/categories/backup and password-protected link shares.
- **The external server wins on breadth** (Mail, Collectives, Cookbook, News, Tables, Shopping List, SAR/GDPR), **WebDAV/calendar depth** (versions, trash, tags, comments, RRULE, attendees, availability), and **AI infrastructure** (semantic search/RAG, document OCR, OAuth multi-user, MCP resources) — at the cost of running a Python service.

| | `openclaw-nextcloud` (this skill) | `nextcloud-mcp-server` |
|---|---|---|
| Form factor | CLI, zero-install esbuild bundle, per-invocation | Resident MCP server (FastMCP) |
| Runtime | Node.js 22+, no install step | Python + uvx / Docker / Kubernetes |
| App domains | 8 | 14+ |
| Approx. surface | ~90 CLI commands | ~110+ MCP tools + 14 resources |
| Deepest area | **Talk** | **Search / document infrastructure** |
| Auth | Single-user app password, HTTPS enforced at startup | Single-user BasicAuth + multi-user (OAuth 2.1 / Login Flow v2, scopes) |
| Transports | Shell invocation | streamable-HTTP (default) + stdio |

---

## 1. ✅ Covered by Both

| Domain | Shared capabilities |
|---|---|
| **Notes** | Full CRUD (list / get / create / update / delete); category field on notes |
| **Files (WebDAV)** | List, read/download, write/upload, delete, search; directory creation (local auto-MKCOL on upload, external explicit `mkdir`) |
| **Calendar** | Calendar listing, event CRUD, date-range queries, calendar display color (local: `calendar get-color`/`set-color`; external: `nc_calendar_manage_calendar` properties) |
| **Tasks** | Todo create / update / complete / delete / list |
| **Contacts** | Addressbook listing; contact list / search / create / update / delete; photo read & write (local: file-based `--photo` + `contacts photo` download; external: inline base64 PHOTO field) |
| **Deck** | Boards / stacks / cards CRUD, move card, archive/unarchive, complete, label CRUD, assign/unassign label & user, due dates, overdue reporting |
| **Shares** | Public link (with expiry), user, group, remote/federated (`user@remote`, shareType 6), chat share into Talk (shareType 10); list + delete |
| **Talk** | List / get / create conversations, list messages, send message (with reply/threading), list/add/remove participants, add / remove / list reactions, read markers |
| **Security posture** | App-password Basic Auth against a single Nextcloud host; no telemetry |

---

## 2. 🟢 Exclusive to `openclaw-nextcloud`

### 2.1 Talk API depth (biggest differentiator)

The external server exposes only 12 Talk tools (`talk_list_conversations`, `talk_get_conversation`, `talk_create_conversation`, `talk_get_messages`, `talk_send_message`, `talk_list_participants`, `talk_add_participant`, `talk_remove_participant`, `talk_react`, `talk_remove_reaction`, `talk_list_reactions`, `talk_mark_as_read`). This skill additionally offers:

| Capability | This skill | External |
|---|---|---|
| Polls — create / vote / unvote / get / results / close | ✅ `talk create-poll`, `vote-poll`, `unvote-poll`, `get-poll`, `get-poll-results`, `close-poll` | ❌ none |
| Edit / delete a message | ✅ `talk edit-message`, `talk delete-message` | ❌ send-only |
| Conversation settings (notification level, read-only, favorite, public, listable, default permissions) | ✅ `talk get-settings` / `update-settings` | ❌ none |
| Guest settings | ✅ `talk get-guest-settings` / `update-guest-settings` | ❌ none |
| Conversation avatar get / set / delete | ✅ | ❌ none |
| Bots — list / enable / disable | ✅ (incl. `occ talk:bot:*` setup docs) | ❌ none |
| Join / leave conversation (self) | ✅ `talk join` / `leave` | ❌ |
| Promote / demote moderator | ✅ | ❌ |
| Per-attendee permission bitmask (set / add / remove) | ✅ | ❌ |
| Upload a file into the chat (`Talk/` folder + share post) | ✅ `talk upload-file` | ❌ |
| Delete a conversation | ✅ CLI command | ❌ (client method exists, not exposed as a tool) |

### 2.2 Notes extras

| Capability | This skill | External |
|---|---|---|
| Category management (list / create / delete) | ✅ `notes list-categories`, `create-category`, `delete-category` | ❌ (category is a note field only — no category endpoints) |
| Per-note version history | ✅ `notes history` | ❌ |
| Full backup export (`?format=backup`) | ✅ `notes backup [--output]` | ❌ |

### 2.3 Shares extras

| Capability | This skill | External |
|---|---|---|
| **Password-protected public links** (`--password`) | ✅ | ❌ (supports expiry — even minute-granular `expires_in_minutes` — but no password param) |

### 2.4 Deck extras

| Capability | This skill | External |
|---|---|---|
| Undo-delete a trashed board | ✅ `deck undo-delete-board` | ❌ (no board-trash restore tool) |

### 2.5 Delivery / operational model

- **Zero-install single bundled file** (`scripts/nextcloud.js`) — no npm install, no Python, no Docker, no running service. Ideal where an agent only has shell access.
- **HTTPS enforced at startup** (with explicit `OPENCLAW_ALLOW_HTTP=1` opt-out for local dev).
- **Reproducible-build audit story**: committed bundle verifiable via `npm run build && git diff`.
- `.env` auto-loading from the working directory.
- Human-friendly resource resolution for `--board` / `--stack` / `--label` (id, exact name, or unique substring, with structured "did you mean" errors).

---

## 3. 🔵 Exclusive to `cbcoutinho/nextcloud-mcp-server`

### 3.1 Entire app domains absent from this skill

| App | Tools | Highlights |
|---|---|---|
| **Mail** | 13 | Accounts, mailboxes, browse/read/send, attachments, flags (read/star), tags, move, delete |
| **Collectives** | 16 | Full CRUD on collectives / pages / tags, trash & restore, search, emoji |
| **Cookbook** | 13 | Recipe CRUD, categories, keywords, **URL import (schema.org)**, reindex |
| **Shopping List** | 12 | Lists & items, add a whole recipe's ingredients in one call, tick items, clear checked |
| **News** | 8 | Feeds, folders, items, starred/unread, feed health, status |
| **Tables** | 5 | Schema inspection + row CRUD |
| **SAR / GDPR** | 10 | Subject-Access-Request case management with redacted export |

### 3.2 Semantic search / RAG (experimental)

- Vector search across Notes, Files, News items, Deck cards, and Mail messages.
- Embedding providers: Ollama, OpenAI, Mistral, Bedrock; BM25 hybrid; cross-encoder reranking (Infinity / vLLM / Cohere).
- Background vector sync via webhooks; Qdrant backend; per-user paths for shared documents.
- This skill has **no** semantic search — keyword WebDAV `files search` only.

### 3.3 Document processing

- OCR + text extraction from PDF, DOCX, PPTX, XLSX, images, MSG inside `nc_webdav_read_file` (`parse_document: auto | markdown | raw`).
- Engines: Tesseract OCR, PyMuPDF, Docling, Unstructured, native OOXML readers, Collabora conversion fallback — with MCP progress notifications.

### 3.4 Files / WebDAV depth

| Capability | External | This skill |
|---|---|---|
| Copy / move resources | ✅ | ❌ |
| Trash listing + restore | ✅ | ❌ |
| File versions listing + restore | ✅ | ❌ |
| System tags (list / tag / untag / get-file-tags) | ✅ | ❌ |
| Favorites listing | ✅ | ❌ |
| File comments (create / list) | ✅ | ❌ |
| Rich search filters (by name / type / tag) | ✅ | ❌ (basicsearch only) |
| Tag-based exclusion of sensitive files from tools | ✅ (`EXCLUDED_TAGS`) | ❌ |

### 3.5 Calendar depth

| Capability | External | This skill |
|---|---|---|
| Recurring events (RFC 5545 RRULE + recurrence end) | ✅ | ❌ (single-shot events only) |
| Attendees on events | ✅ | ❌ |
| Meeting creation with attendee lookup | ✅ `nc_calendar_create_meeting` | ❌ |
| Availability / free-busy finder | ✅ `nc_calendar_find_availability` | ❌ |
| Bulk calendar operations | ✅ | ❌ |
| Todo search | ✅ | ❌ (list only) |
| Calendar create / delete | ✅ `nc_calendar_manage_calendar` | ❌ |

### 3.6 Deck depth

| Capability | External | This skill |
|---|---|---|
| Card comments (full CRUD) | ✅ | ❌ |
| Card attachments — attach files & notes, list, delete | ✅ | ❌ |
| Dependent cards (card relations) | ✅ | ❌ |
| Card reordering within stack | ✅ | ✅ (`deck move --to-stack <same-stack> --order n`) |
| Board overview (all stacks + cards in one call) | ✅ | ✅ (`deck stacks` returns stacks with nested cards; `deck board` for board detail) |
| MCP resources for boards / stacks / cards / labels | ✅ | n/a |

### 3.7 Notes extras

| Capability | External | This skill |
|---|---|---|
| Dedicated note keyword search | ✅ `nc_notes_search_notes` | ❌ (fetch-all + client-side filter only) |
| Append content to a note | ✅ `nc_notes_append_content` | ❌ |
| Note attachment retrieval | ✅ | ❌ |

### 3.8 Shares extras

| Capability | External | This skill |
|---|---|---|
| Update an existing share (permissions, expiry) | ✅ `nc_share_update` | ❌ |
| Get a single share | ✅ | ❌ |
| Email shares (type 4) | ✅ | ❌ |
| Circle shares (type 7) | ✅ | ❌ |
| Deck-card shares (type 12) | ✅ | ❌ |
| Minute-granular link expiry (`expires_in_minutes`) | ✅ | ❌ (date-granular `--expire`) |

### 3.9 Platform / MCP-native features

- **Real MCP server**: streamable-HTTP + stdio transports, **14 resources** (browsable structured data URIs), tool annotations, deep links in responses.
- **Multi-user auth**: OAuth 2.1, **Login Flow v2** (server obtains per-user app passwords transparently), scope-based access control, dynamic client registration, progressive consent via elicitation.
- **Deployment**: Docker image (ghcr.io), Helm chart / Kubernetes, Compose profiles; managed hosting (Astrolabe Cloud).
- **Observability**: Prometheus metrics, tracing, readiness probes, profiling.
- **AI-inside-Nextcloud** integration path (Assistant via Astrolabe / Context Agent comparison).
- Keyword-only search mode, PACT contract testing, SAR redacted export.

---

## 4. Gaps in Both Projects

For completeness — features *neither* project covers:

- Users & Groups administration (create/disable users, group management) — the external repo has internal `users`/`groups` clients but no exposed admin tools
- Nextcloud Forms, Survey, Whiteboard, Photos app APIs
- Full-text search across all apps (external covers this partially via semantic search opt-in)
- Server-side settings / theming / branding
- Notes **restore/import** from the backup this skill can export
- Talk **breakout rooms**, **calls/WebRTC signaling**, and **webinars** (this skill's `API_AUDIT.md` tracks these as remaining Talk gaps)
- Email *sending* in this skill (external covers via Mail app)

---

## 5. Recommendation

The projects are complementary rather than competing:

- **Keep** this skill where a lightweight, auditable, zero-infrastructure CLI is needed (agent shells, throwaway automation, OpenClaw) — and lean into the **Talk depth**, which upstream shows no signs of adding.
- **Adopt ideas from upstream** cheaply: `share update`, email/circle share types, minute-granular expiry, deck card comments/attachments, calendar RRULE + attendees + availability, WebDAV copy/move/trash/versions/tags/comments, notes keyword search & append — all are plain REST/DAV calls that fit this skill's architecture without any infrastructure.
- **Adopt the external server** when the use case needs Mail, Collectives, Cookbook, News, Tables, semantic search, OCR, or multi-user OAuth.
