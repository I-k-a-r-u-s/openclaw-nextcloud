# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw Nextcloud is a Node.js CLI skill that wraps Nextcloud APIs (Notes REST, WebDAV files, CalDAV calendars/tasks, CardDAV contacts, OCS Shares, Talk API) into a single command surface. It is distributed as a Claude Code Skill (see `SKILL.md`) that agents invoke via `Bash`.

This repo is a fork of `keithvassallomt/openclaw-nextcloud` with extended coverage (full Talk service incl. reactions/polls/settings, user & group shares, Notes categories/history/backup, CardDAV extended fields, CalDAV calendar colors) — see `README.md` and `API_AUDIT.md` for details.

## Build & Run

The project uses a **bundled architecture**: source lives in `src/` and is bundled with all dependencies into `scripts/nextcloud.js` so end users/agents can run the skill with no `npm install`.

```bash
npm install               # only needed for development (esbuild)
npm run build             # bundles src/index.js -> scripts/nextcloud.js (esbuild, ESM)
node scripts/nextcloud.js <command> <subcommand> [options]
```

**Always commit the `src/` changes and the rebuilt `scripts/nextcloud.js` together** — shipping only the source breaks the no-install promise that the skill depends on.

Tests: `npm test` runs `node --test tests/**/*.test.js`. Unit tests (`tests/unit/`) run offline; integration tests (`tests/integration/`) drive the CLI against a live Nextcloud instance and require `NEXTCLOUD_URL`, `NEXTCLOUD_USER`, `NEXTCLOUD_TOKEN` (or a `.env` file). There is no linter or typechecker configured. Also verify changes by running `node scripts/nextcloud.js <cmd>` against a live instance.

## Architecture

`src/` is a modular ESM codebase (split out of the original monolithic `index.js` in commit `6929fc0`), bundled by esbuild into `scripts/nextcloud.js`:

- **`src/index.js`** — CLI entry. Parses `argv` with `node:util` `parseArgs` against a flat `COMMON_OPTIONS` option table (no positionals allowed), then switches on `command`/`subCommand` into per-service handler functions (`handleNotes`, `handleFiles`, `handleCalendar`, `handleTasks`, `handleCalendars`, `handleAddressBooks`, `handleShares`, `handleTalk`, `handleContacts`, `handleDeck`).
- **`src/request.js`** — shared `request()`/`fetchRaw()` helpers over native `fetch` (Node 22+): Basic Auth, `OCS-APIRequest` header for OCS/Talk paths, content-type-aware response parsing (JSON / XML via `fast-xml-parser` / text), 30s timeout.
- **`src/config.js`** — reads `NEXTCLOUD_URL`/`NEXTCLOUD_USER`/`NEXTCLOUD_TOKEN`, loads `.env`, enforces HTTPS (`OPENCLAW_ALLOW_HTTP=1` override), exports `CONFIG` and `AUTH_HEADER`.
- **`src/notes.js`** — Notes REST API at `/index.php/apps/notes/api/v1/`: notes CRUD plus categories, per-note history, and backup export. Server-version-missing endpoints (404) degrade to a structured error message.
- **`src/files.js`** — WebDAV at `/remote.php/dav/files/{user}/`. Uses `PROPFIND` for listing, `SEARCH` (basicsearch XML) for queries, and `PUT`/`GET`/`DELETE` for file ops (auto-MKCOL parent dirs on upload).
- **`src/caldav.js`** — Calendar events (VEVENT) and tasks (VTODO) at `/remote.php/dav/calendars/{user}/`. Calendars are discovered via `findCalendars(componentType)` which filters by `cal:supported-calendar-component-set`. Events/tasks are fetched via `REPORT` queries and **parsed from raw iCalendar text using regex** (not a vCalendar library) — same for updates via `_updateProperty()`. Calendar display color via `cal:calendar-color` PROPFIND/PROPPATCH (`getCalendarColor`/`setCalendarColor`).
- **`src/contacts.js`** — CardDAV at `/remote.php/dav/addressbooks/users/{user}/`. vCards are likewise parsed and patched with regex (`_parseVCard`, `_updateVCardField`), with `getFieldWithTypes()` for type-parameterized TEL/EMAIL/ADR and support for BDAY/ANNIVERSARY/URL/ROLE.
- **`src/shares.js`** — OCS Shares API at `/ocs/v2.php/apps/files_sharing/api/v1/shares`: public link, user, and group shares with permission mapping (read: 1, edit: 15, delete: 31).
- **`src/talk.js`** — Talk API: rooms (`/spreed/api/v4/room`, incl. settings subresources `/favorite`, `/notify`, `/read-only`, `/password`, `/public`, `/listable`, `/permissions/default`, participant management via `/participants`, `/participants/active`, `/attendees`, `/moderators`, `/attendees/permissions`, and avatars under `/api/v1/room/{token}/avatar`), chat (`/spreed/api/v1/chat`, incl. share-to-chat), reactions (v1), polls (`/spreed/api/v1/poll/{token}/{pollId}` — vote = POST with `{optionIds}`, empty array unvotes), bots (`/spreed/api/v1/bot`).
- **`src/deck.js`** — Deck (kanban) API at `/index.php/apps/deck/api/v1.0`: boards, stacks, cards, labels, assignments. Gotchas: PUT card/board/label are **full updates** (module merges current state; omitted fields get reset); action endpoints (reorder/assign/label) return **stale** card data → module re-reads the card; the `/api` reorder route's path `{stackId}` shadows the body target, so card moves use the internal flat route `PUT /index.php/apps/deck/cards/{id}/reorder`; done/undone/archive/unarchive also live on internal flat routes (app-password auth works). `--board`/`--stack`/`--label` resolve id-or-title; soft-deleted (trashed) boards must be filtered from listings and can only be restored by numeric id.
- **`src/utils.js`** — `output()`/`errorOutput()` JSON envelopes and small shared helpers (`ensureArray`, `matchByName`, `formatCalDavDate`, `xmlEscape`, `decodeNumericEntities`, …).

Every code path either calls `output()` (success JSON to stdout) or `errorOutput()` (error JSON to stderr + `exit(1)`).

### Conventions to preserve when extending

- All output is **machine-readable JSON** (`{status, data}` or `{status, message}`) — never log free text to stdout.
- New entities go in their own module file in `src/` plus a `case` block in the relevant `handle*` switch in `src/index.js`; add any new flags to the `COMMON_OPTIONS` table (string-typed; boolean-ish flags are parsed as `"1"`/`"true"`).
- After any `src/` edit: `npm run build` and commit the regenerated `scripts/nextcloud.js`.
- For CalDAV/CardDAV writes: generate `crypto.randomUUID()` for the resource UID, `PUT` with `If-None-Match: *` for create and `If-Match: <etag>` for update.
- Calendar/address book selection follows a "find or default to first" pattern (`getCalendar`, `getAddressBook`); preserve this so the skill works without explicit `--calendar`/`--addressbook` flags.
- Not every endpoint exists on every server version (e.g. Talk `/settings/{token}` returns 404 — settings must go through the room resource subroutes). When adding endpoints with uncertain availability, catch 404 and return a structured "not available" error rather than crashing.

## Skill Behavior (SKILL.md)

`SKILL.md` is the agent-facing contract — it is loaded by Claude Code when the skill is invoked. Two behaviors there are load-bearing and should be respected by any agent working in this repo:

1. **Default calendar/address book memory** — the skill expects the agent to remember `default_task_calendar`, `default_event_calendar`, and `default_addressbook` across invocations rather than asking each time.
2. **No-markdown output** — when *presenting* skill results to the user, use plain text + emojis (output may be relayed to Telegram/WhatsApp). This applies to user-facing summaries, not to the JSON the CLI itself emits.
