<p align="center">
  <img width="400" alt="openclaw-nextcloud logo" src="https://github.com/user-attachments/assets/c337351e-4000-4521-b0d5-776f55b95772" />
</p>

# OpenClaw Nextcloud Skill

> **Fork notice:** This repository is a maintained fork of [keithvassallomt/openclaw-nextcloud](https://github.com/keithvassallomt/openclaw-nextcloud), extended with substantially broader API coverage. Additions over upstream include:
>
> - **Talk** — reactions (add/remove/list), polls (create/get/close/publish/results), conversation & guest settings (public, listable, default-permissions, favorite, notification level, read-only, password), `talk get`, file upload-to-chat
> - **Shares** — user, group, remote (federated), and chat shares (`create-user`, `create-group`, `create-remote`, `create-chat`) in addition to public links
> - **Notes** — category management, per-note history, export backup
> - **Calendar/Tasks** — calendar color get/set
> - **Contacts** — extended vCard fields (BDAY, ANNIVERSARY, URL, ROLE, ADR, typed TEL/EMAIL)
> - **Engineering** — modular `src/` architecture (same esbuild bundle output), `.env` support, unit + integration tests
>
> See `API_AUDIT.md` for per-endpoint coverage details.

A Node.js CLI tool for interacting with Nextcloud services including notes, files, calendars, tasks, contacts, shares, and Talk conversations.

## Features

- **Notes** - Create, read, update, and delete notes; manage categories; view note history; export a backup
- **Files** - Upload, download, list, search, and delete files via WebDAV
- **Calendar** - Manage calendar events via CalDAV, including calendar display color
- **Tasks** - Create, manage, and complete tasks/todos, including calendar display color
- **Contacts** - Contact management via CardDAV with extended vCard fields (birthday, anniversary, URL, role, address, typed phone/email), plus contact photos
- **Deck** - Kanban boards, stacks, and cards: create/edit/move/complete/archive cards, labels, user assignments, due dates
- **Shares** - Public link, user, group, remote (federated), and chat shares
- **Chat/Conversations** - Manage Talk conversations, messages, reactions, polls, conversation settings, participants, bots, and file sharing into chats

**Note on Call Permissions:** The `--call-permissions` setting was removed as the underlying Nextcloud Talk API endpoint (`/permissions/call`) is no-op since Nextcloud Talk 20. Call permissions must be configured manually in the Nextcloud UI.

**Note on Calendar Permissions:** For calendar event/task creation to work, the user's default calendar must have write permissions. The skill automatically uses the "Personal" calendar if available, otherwise falls back to the first available calendar.

## Prerequisites

- Node.js 22 or higher (uses the native `fetch` API)
- A Nextcloud instance with API access
- An app password for your Nextcloud account

## Installation

```bash
git clone https://github.com/I-k-a-r-u-s/openclaw-nextcloud.git
cd openclaw-nextcloud
```

The skill is pre-bundled with all dependencies in `scripts/nextcloud.js` - no npm install required.

## Development

The project uses a bundled architecture:

- **`src/`** - Source code, split into modules (`src/index.js` is the CLI entry; per-service modules like `src/talk.js`, `src/caldav.js`) — edit these
- **`scripts/nextcloud.js`** - Bundled output with all dependencies (run this)

To make changes:

```bash
npm install              # Install dev dependencies (first time only)
# Edit files in src/
npm run build            # Bundle src/index.js into scripts/nextcloud.js
npm test                 # Unit tests run offline; integration tests need a live Nextcloud instance (see TESTING.md)
```

Source and bundle should always be committed together - the bundle allows users/agents to run the skill without npm install.

## Configuration
Store these values in environment variables, or in a `.env` file in the working directory (loaded automatically at startup).

```env
NEXTCLOUD_URL=https://your-nextcloud-instance.com
NEXTCLOUD_USER=your_username
NEXTCLOUD_TOKEN=your_app_password
```

**Generating an App Password:**
1. Log into your Nextcloud instance
2. Go to Settings → Security
3. Under "Devices & sessions", enter a name for the app and click "Create new app password"
4. Copy the generated password to your `.env` file

## Usage

```bash
node scripts/nextcloud.js <command> <subcommand> [options]
```

### Notes

```bash
# List all notes
node scripts/nextcloud.js notes list

# Create a note
node scripts/nextcloud.js notes create --title "My Note" --content "Note content" --category "Personal"

# Get a specific note
node scripts/nextcloud.js notes get --id 123

# Update a note
node scripts/nextcloud.js notes edit --id 123 --title "Updated Title" --content "New content"

# Delete a note
node scripts/nextcloud.js notes delete --id 123

# List / create / delete categories
node scripts/nextcloud.js notes list-categories
node scripts/nextcloud.js notes create-category --name "Work"
node scripts/nextcloud.js notes delete-category --name "Work"

# View a note's version history
node scripts/nextcloud.js notes history --id 123

# Export a backup of all notes (optionally write to a file)
node scripts/nextcloud.js notes backup
node scripts/nextcloud.js notes backup --output notes-backup.json
```

### Files

```bash
# List files in a directory
node scripts/nextcloud.js files list --path "Documents/"

# Upload a file (parent directories are created automatically if missing)
node scripts/nextcloud.js files upload --path "Documents/Reports/test.txt" --content "Hello World"

# Download a file
node scripts/nextcloud.js files get --path "Documents/test.txt"

# Search for files
node scripts/nextcloud.js files search --query "report"

# Delete a file
node scripts/nextcloud.js files delete --path "Documents/test.txt"
```

`files list` and `files search` results include a `fileId` (when the server returns one) and a synthesized `internalLink` like `<NEXTCLOUD_URL>/index.php/f/<fileId>` that opens the file directly in the Nextcloud web UI.

### Shares (links, users, groups, remote, chat)

```bash
# Create a public link share for a file or folder
node scripts/nextcloud.js shares create-link --path "/Documents/Reports" \
  --permissions read \
  --password "Secret123" \
  --expire "2026-04-15"

# List all shares
node scripts/nextcloud.js shares list

# List shares for a specific path
node scripts/nextcloud.js shares list --path "/Documents/Reports"

# Share with a user
node scripts/nextcloud.js shares create-user --path "/Documents/Reports" --user alice --permissions edit

# Share with a group
node scripts/nextcloud.js shares create-group --path "/Documents/Reports" --group staff

# Share with a user on a remote (federated) Nextcloud server
node scripts/nextcloud.js shares create-remote --path "/Documents/Reports" --remote-user alice@othercloud.example

# Share a file into a Talk conversation (auto-posts the share message to the chat)
node scripts/nextcloud.js shares create-chat --path "/Documents/Reports" --token ABC123

# Delete a share by ID
node scripts/nextcloud.js shares delete --id 29
```

`--permissions read` (default) is read-only; `--permissions edit` grants create/read/update/delete on the shared resource. `--password` and `--expire` are optional (link shares). Remote shares require federation to be enabled on both servers; `--remote-user` is `user@server`.

### Calendar

```bash
# List available calendars
node scripts/nextcloud.js calendars list

# List events in a date range
node scripts/nextcloud.js calendar list --from "2026-02-01T00:00:00Z" --to "2026-02-28T23:59:59Z"

# Create an event (with optional location)
node scripts/nextcloud.js calendar create --summary "Team Meeting" --start "2026-02-05T10:00:00Z" --end "2026-02-05T11:00:00Z" --location "Conference Room B"

# Update an event
node scripts/nextcloud.js calendar edit --uid event-uid --summary "Updated Meeting" --location "Zoom"

# Delete an event
node scripts/nextcloud.js calendar delete --uid event-uid

# Get / set the calendar's display color
node scripts/nextcloud.js calendar get-color
node scripts/nextcloud.js calendar set-color --color "#FF5500"
```

`--calendar` and `--addressbook` accept the display name (case-insensitive),
the URL slug, or the full collection URL — so all of `Personal`, `personal`,
and `/remote.php/dav/calendars/<user>/personal/` resolve to the same calendar.
Date inputs accept either ISO 8601 (`2026-02-05T10:00:00Z`) or the compact
CalDAV form (`20260205T100000Z`).

### Tasks

```bash
# List all tasks
node scripts/nextcloud.js tasks list

# Create a task
node scripts/nextcloud.js tasks create --title "Buy groceries" --due "2026-02-05T17:00:00Z" --priority 1

# Complete a task
node scripts/nextcloud.js tasks complete --uid task-uid

# Delete a task
node scripts/nextcloud.js tasks delete --uid task-uid

# Get / set the task calendar's display color
node scripts/nextcloud.js tasks get-color
node scripts/nextcloud.js tasks set-color --color "#00AA44"
```

### Contacts

```bash
# List address books
node scripts/nextcloud.js addressbooks list

# List all contacts
node scripts/nextcloud.js contacts list

# Search contacts
node scripts/nextcloud.js contacts search --query "john"

# Create a contact
node scripts/nextcloud.js contacts create --name "John Doe" --email "john@example.com" --phone "+1234567890"

# Extended vCard fields: birthday, anniversary, URL, role, address, typed phone/email
node scripts/nextcloud.js contacts create --name "Jane Doe" \
  --bday "1990-01-01" --anniversary "2015-06-20" \
  --url "https://example.com" --role "CTO" \
  --address "Main Street|Springfield|CA|90210" \
  --phone "+1234567890" --phone-type work

# Add a photo (png/jpg/jpeg/gif/webp/bmp) when creating
node scripts/nextcloud.js contacts create --name "John Doe" --photo ./photo.jpg

# Get a specific contact (reports hasPhoto / photoMime)
node scripts/nextcloud.js contacts get --uid contact-uid

# Update a contact (photo updates replace the old one)
node scripts/nextcloud.js contacts edit --uid contact-uid --email "newemail@example.com"
node scripts/nextcloud.js contacts edit --uid contact-uid --photo ./new-photo.jpg

# Download a contact's photo
node scripts/nextcloud.js contacts photo --uid contact-uid --output john.jpg

# Delete a contact
node scripts/nextcloud.js contacts delete --uid contact-uid
```

### Deck (kanban boards)

```bash
# Boards
node scripts/nextcloud.js deck boards
node scripts/nextcloud.js deck board --board "Project Alpha"
node scripts/nextcloud.js deck create-board --title "Project Alpha" --color "#e06060"
node scripts/nextcloud.js deck delete-board --board "Project Alpha"
node scripts/nextcloud.js deck undo-delete-board --board 42   # numeric id, trashed boards are not listed

# Stacks (columns)
node scripts/nextcloud.js deck stacks --board "Project Alpha"
node scripts/nextcloud.js deck create-stack --board "Project Alpha" --title "To Do"
node scripts/nextcloud.js deck delete-stack --board "Project Alpha" --stack "To Do"

# Cards
node scripts/nextcloud.js deck list --board "Project Alpha" --stack "To Do"
node scripts/nextcloud.js deck create --board "Project Alpha" --stack "To Do" \
  --title "Write the report" --content "markdown ok" --due 2026-11-05
node scripts/nextcloud.js deck edit --board "Project Alpha" --card 123 --title "Write the final report"
node scripts/nextcloud.js deck edit --board "Project Alpha" --card 123 --due none   # clear due date
node scripts/nextcloud.js deck move --board "Project Alpha" --card 123 --to-stack "In Progress"
node scripts/nextcloud.js deck complete --card 123
node scripts/nextcloud.js deck archive --card 123
node scripts/nextcloud.js deck delete --board "Project Alpha" --card 123

# Labels & assignments
node scripts/nextcloud.js deck create-label --board "Project Alpha" --title urgent --color ff0000
node scripts/nextcloud.js deck assign-label --board "Project Alpha" --card 123 --label urgent
node scripts/nextcloud.js deck assign --board "Project Alpha" --card 123 --user alice
node scripts/nextcloud.js deck unassign --board "Project Alpha" --card 123 --user alice
```

`--board`, `--stack`, and `--label` accept a numeric id or a title (exact
case-insensitive, else unique substring); misses return a structured error
listing the available options. `--content` is Markdown. Deck deletions are
soft deletes (board/card trash); `deck delete-board` replies with the numeric
id for `undo-delete-board`. Cards report `overdue` and `done` automatically.

### Chat/Conversations (Talk API)

```bash
# List all conversations / get a single conversation
node scripts/nextcloud.js talk list
node scripts/nextcloud.js talk get --token ABC123

# Create a new conversation
node scripts/nextcloud.js talk create --name "Project Team" --type group

# List messages in a conversation
node scripts/nextcloud.js talk messages --token ABC123 --limit 50

# Send a message (optionally as a reply)
node scripts/nextcloud.js talk send --token ABC123 --message "Hello team!"
node scripts/nextcloud.js talk send --token ABC123 --message "Replying" --reply-to 1567

# Edit or delete a message
node scripts/nextcloud.js talk edit-message --token ABC123 --message-id 1567 --message "Fixed typo"
node scripts/nextcloud.js talk delete-message --token ABC123 --message-id 1567

# Add a participant to a conversation
node scripts/nextcloud.js talk add-participant --token ABC123 --user alice

# List participants (exposes each attendee ID used by the commands below)
node scripts/nextcloud.js talk participants --token ABC123

# Join / leave a conversation yourself
node scripts/nextcloud.js talk join --token ABC123
node scripts/nextcloud.js talk leave --token ABC123

# Remove a participant (moderator/owner; attendee ID from `talk participants`)
node scripts/nextcloud.js talk remove-participant --token ABC123 --participant 42

# Promote / demote a moderator
node scripts/nextcloud.js talk promote --token ABC123 --attendee 42
node scripts/nextcloud.js talk demote --token ABC123 --attendee 42

# Set/add/remove a per-attendee permission bitmask (set is the default method)
node scripts/nextcloud.js talk set-participant-permissions --token ABC123 --attendee 42 --permissions 128
node scripts/nextcloud.js talk set-participant-permissions --token ABC123 --attendee 42 --permissions 1 --method add

# Conversation avatar (set accepts png/jpg/jpeg)
node scripts/nextcloud.js talk set-avatar --token ABC123 --file ./logo.png
node scripts/nextcloud.js talk get-avatar --token ABC123 --output avatar.png
node scripts/nextcloud.js talk delete-avatar --token ABC123

# Share content into a conversation as a file
# (uploads to the conversation's Talk/ folder, then posts the share)
node scripts/nextcloud.js talk upload-file --token ABC123 --file "reports/digest.txt" --content "Weekly digest..."

# List bots (add --token to list bots in one conversation)
node scripts/nextcloud.js talk list-bots

# Enable / disable a bot in a conversation
node scripts/nextcloud.js talk enable-bot --token ABC123 --bot-id 5
node scripts/nextcloud.js talk disable-bot --token ABC123 --bot-id 5
```

### Reactions

```bash
# Add / remove a reaction on a message
node scripts/nextcloud.js talk add-reaction --token ABC123 --message-id 1567 --emoji "🎉"
node scripts/nextcloud.js talk delete-reaction --token ABC123 --message-id 1567 --emoji "🎉"

# List reactions on a message
node scripts/nextcloud.js talk list-reactions --token ABC123 --message-id 1567
```

### Polls

```bash
# Create a poll (comma-separated options)
node scripts/nextcloud.js talk create-poll --token ABC123 --question "Lunch?" --options "Pizza,Sushi,Salad"

# Vote / unvote (option IDs are 1-based positions in the option list)
node scripts/nextcloud.js talk vote-poll --token ABC123 --poll-id 42 --option-ids 1,2
node scripts/nextcloud.js talk unvote-poll --token ABC123 --poll-id 42

# Get a poll (includes vote tallies) / view results / close
node scripts/nextcloud.js talk get-poll --token ABC123 --poll-id 42
node scripts/nextcloud.js talk get-poll-results --token ABC123 --poll-id 42
node scripts/nextcloud.js talk close-poll --token ABC123 --poll-id 42
```

**Note:** polls are created with `resultMode` 0 (results visible to participants once they've voted) and `maxVotes` 1 (single choice). There is no separate "publish" endpoint in the Talk API — `get-poll` already returns the tally.

### Conversation Settings

Read settings with `talk get-settings` / `talk get-guest-settings`, and update them with `talk update-settings` / `talk update-guest-settings`:

```bash
# Update notification level
node scripts/nextcloud.js talk update-settings --token ABC123 --notification-level 1

# Set read-only mode
node scripts/nextcloud.js talk update-settings --token ABC123 --read-only 1

# Favorite a conversation
node scripts/nextcloud.js talk update-settings --token ABC123 --favorite 1

# Enable guest join via link
node scripts/nextcloud.js talk update-settings --token ABC123 --public 1

# Make conversation searchable for regular users
node scripts/nextcloud.js talk update-settings --token ABC123 --listable 1

# Set default permissions for new participants
node scripts/nextcloud.js talk update-settings --token ABC123 --default-permissions 128
```

**Available Settings:**

| Setting | Values | Description |
|---------|--------|-------------|
| `notification-level` | `0`, `1`, `2`, `3` | Default, Always notify, Notify on mention, Never notify |
| `read-only` | `0`, `1` | Read-write or read-only |
| `favorite` | `0`, `1` | Remove from or add to favorites |
| `public` | `0`, `1` | Disable or enable guest join via link |
| `listable` | `0`, `1`, `2` | Participants only, Regular users only, Everyone |
| `default-permissions` | Integer | Combined permission flags (e.g., `128` for chat messages) |

**Bot Setup Required:** The Talk API exposes only listing, enabling, and disabling bots — registration, editing, and removal have no OCS endpoints and must be done by an admin on the server terminal with `occ talk:bot:install` / `occ talk:bot:remove`:

```bash
./occ talk:bot:install \
  --feature webhook --feature response \
  "OpenClaw Bot" "your-shared-secret-123" \
  "https://your-webhook-endpoint.com/nextcloud" \
  "Bot for OpenClaw AI assistant"
```

Get the bot ID from the output or list existing bots:
```bash
./occ talk:bot:list
```

Optionally set `NEXTCLOUD_BOT_ID` in your environment to enable auto-enable behavior.

**Permissions:** You need moderator/owner permissions to enable/disable bots in rooms. The bot's webhook URL must be reachable from your Nextcloud server.

## Output Format

All commands return JSON output:

```json
{
  "status": "success",
  "data": [...]
}
```

On error:

```json
{
  "status": "error",
  "message": "Error description"
}
```

## API Protocols

This tool uses the following Nextcloud APIs:

| Service | Protocol | Endpoint |
|---------|----------|----------|
| Notes | REST | `/index.php/apps/notes/api/v1/notes` |
| Deck | REST | `/index.php/apps/deck/api/v1.0/` |
| Files | WebDAV | `/remote.php/dav/files/` |
| Calendar/Tasks | CalDAV | `/remote.php/dav/calendars/` |
| Contacts | CardDAV | `/remote.php/dav/addressbooks/` |
| Shares | OCS | `/ocs/v2.php/apps/files_sharing/api/v1/shares` |
| Talk | Talk API | `/ocs/v2.php/apps/spreed/api/` |

## Dependencies

- Native `fetch` (Node.js 22+) - HTTP client
- [fast-xml-parser](https://www.npmjs.com/package/fast-xml-parser) - XML parsing
- [date-fns](https://www.npmjs.com/package/date-fns) - Date formatting

## Security & Trust

This skill executes a bundled JavaScript file (`scripts/nextcloud.js`) on your machine and is given a credential for your Nextcloud account. Because that's a non-trivial trust ask, here's what the skill does and how you can verify it:

**What it can access**

- The Nextcloud instance at `NEXTCLOUD_URL` — no other endpoints. There is no telemetry, no analytics, no auto-update, no third-party calls. You can confirm this by `grep -E 'fetch\(|http[s]?://' scripts/nextcloud.js`; every URL is built from `CONFIG.url` (i.e. `NEXTCLOUD_URL`) or relative API paths.
- The environment variables `NEXTCLOUD_URL`, `NEXTCLOUD_USER`, `NEXTCLOUD_TOKEN`. No other env vars are read.
- No filesystem access beyond the Node module loader and the standard `fs` for reading inputs you pass it.

**Credentials**

- Always use a Nextcloud **app password** (Settings → Security → "Devices & sessions"), not your account password. App passwords have account-level scope but can be revoked individually from the Nextcloud UI.
- The token is sent as a Basic Auth header to the configured Nextcloud instance. **The script enforces HTTPS for `NEXTCLOUD_URL`** at startup and refuses to run over plain `http://` (except `localhost`/`127.0.0.1`/`[::1]` for local development). The check can be overridden with `OPENCLAW_ALLOW_HTTP=1`, but this is strongly discouraged outside isolated dev environments.

**Static analysis**

A static analyser scanning this skill will likely flag rules in the family of `suspicious.env_credential_access` — code that reads an environment variable and then makes a network call. That signal is **expected**: every authenticated API client matches it, including this one. The pattern is constrained as follows, and these constraints are what to audit:

- The credential is read from `NEXTCLOUD_TOKEN` only. No other env var is consulted for credential material.
- The credential is sent only to URLs derived from `NEXTCLOUD_URL`. There are no hard-coded hosts in the source (`grep -rE 'http[s]?://' src/` returns nothing).
- HTTPS is enforced at startup (see above), so the credential cannot be sent in cleartext without an explicit opt-in.
- There is no telemetry, analytics, auto-update, or third-party callback. The script makes one outbound destination — your Nextcloud — and exits.

**Auditing the bundle**

`scripts/nextcloud.js` is the output of running `esbuild` over `src/` plus the two declared dependencies. To verify the bundle matches the source:

```bash
npm install
npm run build
git diff scripts/nextcloud.js   # should report no changes
```

If the diff is non-empty, the committed bundle does not match the source — please open an issue.

**Reducing privilege**

- Run on a per-user basis; no `sudo` is required or appropriate.
- For first-time evaluation, point `NEXTCLOUD_URL` at a throwaway test account.
- Treat `NEXTCLOUD_TOKEN` like any other credential: don't commit it, don't paste it into shared chats, and rotate it on any suspicion of compromise.

## Contributors

Thanks to:

- [@schemann](https://github.com/schemann) — `fileId` / `internalLink` on file listings, auto-MKCOL on upload, public-link shares (`shares list` / `create-link` / `delete`).
- [@KssimiClaw](https://github.com/KssimiClaw) — fix for `files search` 501 by routing the WebDAV `SEARCH` request to the DAV root.

## License

MIT
