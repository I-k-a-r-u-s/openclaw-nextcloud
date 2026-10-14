# Nextcloud API Audit Document

**Project:** OpenClaw Nextcloud CLI Skill  
**Date:** 2026-10-14 (re-audit; original audit 2026-05-31)  
**Source:** Modular `src/` tree (`src/index.js`, `src/talk.js`, `src/notes.js`, `src/files.js`, `src/caldav.js`, `src/contacts.js`, `src/shares.js`) — formerly the monolithic `index.js` (split in `6929fc0`)  
**Reference:** https://nextcloud-talk.readthedocs.io/en/latest/

---

## Executive Summary

The current implementation covers **6 major service areas** with varying levels of API completeness. The codebase implements core CRUD operations for Notes, Files (WebDAV), CalDAV (events & tasks), CardDAV (contacts incl. photos), and provides broad coverage of the Talk API surface (chat, reactions, full poll lifecycle incl. voting, room settings, participant management, conversation avatars, bots) alongside Shares (link/user/group/remote/chat).

**Overall Coverage Estimate (updated 2026-10-14, post implementation sprint):**
- **Notes API:** ~95% complete (categories, history, and export backup implemented since the original audit)
- **Files API:** ~60% complete (unchanged)
- **CalDAV API:** ~80% complete (calendar color get/set added)
- **CardDAV API:** ~90% complete (extended vCard fields + PHOTO upload/download added 2026-10-14)
- **Talk API v4:** ~75% complete (reactions, full poll lifecycle incl. voting, room settings, chat file sharing, participant management, and conversation avatars added; remaining = breakout rooms, calls, webinar — see 2.5/2.6/2.9)
- **Shares API:** ~65% complete (remote/federated + chat shares added 2026-10-14; email shares remain)

---

## 1. Fully Implemented Features

### 1.1 Notes API (`/index.php/apps/notes/api/v1/`)
**Status:** ✅ Complete  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/notes` | `Notes.list()` |
| GET | `/notes/{id}` | `Notes.get(id)` |
| POST | `/notes` | `Notes.create(title, content, category)` |
| PUT | `/notes/{id}` | `Notes.update(id, title, content, category)` |
| DELETE | `/notes/{id}` | `Notes.delete(id)` |
| GET | `/categories` | `Notes.listCategories()` |
| POST | `/categories` | `Notes.createCategory(name)` |
| DELETE | `/categories/{name}` | `Notes.deleteCategory(name)` |
| GET | `/notes/{id}/history` | `Notes.getNoteHistory(id)` |
| GET | `/notes?format=backup` | `Notes.getBackup()` |

**Features:**
- Full CRUD operations on notes
- Support for title, content, and category fields
- Modified timestamp handling
- JSON response parsing
- Category list/create/delete, per-note history listing, and full export backup (added 2026-06; export-only — no restore/import yet). All three degrade gracefully with a structured error when the server returns 404

---

### 1.2 Shares API (`/ocs/v2.php/apps/files_sharing/api/v1/`)
**Status:** ✅ Core Functionality Complete  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/shares` | `Shares.list({path})` |
| POST | `/shares` | `Shares.createLink()`, `Shares.createUserShare()`, `Shares.createGroupShare()`, `Shares.createRemoteShare()` (shareType 6), `Shares.createChatShare()` (shareType 10) |
| DELETE | `/shares/{id}` | `Shares.delete(id)` |

**Features:**
- Public link shares with optional password protection and expiration
- User-to-user shares
- Group-to-user shares
- Remote (federated) shares — `user@server`, optional permissions/expiration (added 2026-10-14)
- Chat shares into Talk conversations — server auto-posts the share message (added 2026-10-14)
- Permission mapping (read: 1, edit: 15, delete: 31)
- OCS envelope unwrapping with error handling

---

### 1.3 Talk API v4 - Basic Conversation Management
**Status:** ✅ Basic Operations Implemented  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/spreed/api/v4/room` | `Talk.listConversations()` |
| GET | `/spreed/api/v4/room/{token}` | `Talk.getConversation(token)` |
| POST | `/spreed/api/v4/room` | `Talk.createConversation()` |
| DELETE | `/spreed/api/v4/room/{token}` | `Talk.deleteConversation(token)` |

**Features:**
- List conversations (group, public, note-to-self types)
- Create conversations with optional invite, description, password
- Get conversation details
- Delete conversations

---

### 1.4 Talk API v4 - Chat Management
**Status:** ✅ Core Chat Operations Implemented  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/spreed/api/v1/chat/{token}` | `Talk.listMessages()` |
| POST | `/spreed/api/v1/chat/{token}` | `Talk.sendMessage()` |
| DELETE | `/spreed/api/v1/chat/{token}/{messageId}` | `Talk.deleteMessage()` |
| PUT | `/spreed/api/v1/chat/{token}/{messageId}` | `Talk.editMessage()` |
| POST | `/spreed/api/v1/chat/{token}/share` | `Talk.uploadFileToConversation()` (WebDAV `PUT` to `Talk/` folder + share) |

**Features:**
- Message listing with pagination and read markers
- Send messages with reply-to support
- Edit and delete messages
- Upload files to the conversation's `Talk/` WebDAV folder and share them into the chat (`talk upload-file`)
- URL parameter handling (lookIntoFuture, limit, setReadMarker)

---

### 1.5 Files API (WebDAV - Core Operations)
**Status:** ✅ Core CRUD Operations Implemented  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| PROPFIND | `/remote.php/dav/files/{user}/` | `Files.list()` |
| SEARCH | `/remote.php/dav/files/{user}/` | `Files.search()` |
| PUT | `/remote.php/dav/files/{user}/{path}` | `Files.upload()` |
| GET | `/remote.php/dav/files/{user}/{path}` | `Files.get()` |
| DELETE | `/remote.php/dav/files/{user}/{path}` | `Files.delete()` |

**Features:**
- Directory listing with depth support
- File search using basicsearch XML
- Upload with multipart path creation
- Download files by path
- Delete files
- Response parsing with fast-xml-parser for XML responses

---

### 1.6 CalDAV - Event Management
**Status:** ✅ Core Event Operations Implemented  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| PROPFIND | `/remote.php/dav/calendars/{user}/` | `CalDAV.findCalendars()` |
| REPORT | `/remote.php/dav/calendars/{user}/{calendar}/` | `CalDAV.getEvents()` |
| PUT | Calendar resource | `CalDAV.createEvent()`, `CalDAV.updateEvent()` |
| DELETE | Calendar resource | `CalDAV.deleteEvent()` |
| PROPFIND | Calendar collection | `CalDAV.getCalendarColor()` (`cal:calendar-color`) |
| PROPPATCH | Calendar collection | `CalDAV.setCalendarColor()` (`cal:calendar-color`) |

**Features:**
- Calendar discovery with component filtering (VEVENT, VTODO)
- Time-range filtered event queries
- Event creation with UID generation and DTSTAMP
- Event updates with ETag handling
- Event deletion
- iCalendar parsing via regex (summary, description, location, dtstart, dtend)
- Calendar display color get/set (`calendar get-color` / `set-color`, added 2026-06)

---

### 1.7 CalDAV - Task Management
**Status:** ✅ Core Task Operations Implemented  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| REPORT | `/remote.php/dav/calendars/{user}/` | `CalDAV.getTodos()` |
| PUT | Calendar resource | `CalDAV.createTask()`, `CalDAV.updateTask()` |
| DELETE | Calendar resource | `CalDAV.deleteTask()` |
| PUT | Calendar resource | `CalDAV.completeTask()` |

**Features:**
- Task filtering by status (NEEDS-ACTION, COMPLETED, etc.)
- Task due date and priority handling
- Task completion status management
- Task CRUD operations with ETag support
- iCalendar VTODO parsing
- Task calendar display color get/set (`tasks get-color` / `set-color`)

---

### 1.8 CardDAV - Contact Management
**Status:** ✅ Core Contact Operations Implemented  
**Endpoints Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| PROPFIND | `/remote.php/dav/addressbooks/users/{user}/` | `Contacts.findAddressBooks()` |
| REPORT | Address book | `Contacts.list()`, `Contacts.search()` |
| PUT | Address book resource | `Contacts.create()`, `Contacts.update()` |
| DELETE | Address book resource | `Contacts.delete()` |

**Features:**
- Address book discovery
- vCard parsing via regex (FN, N, TEL, EMAIL, ORG, TITLE, NOTE, BDAY, ANNIVERSARY, URL, ROLE, ADR)
- Typed TEL/EMAIL/ADR values parsed on read via `getFieldWithTypes()`; extended fields (BDAY, ANNIVERSARY, URL, ROLE, ADR) writable on create/edit (added 2026-06)
- Contact creation with UID generation
- Contact update with ETag handling
- Contact deletion
- Full-text search in contacts

---

## 2. Partially Implemented Features

> **2026-10-14 note:** Sections 2.1 (Participants), 2.2 (Avatars), 2.3 (Reactions), 2.4 (Polls incl. voting) and 2.10 (Settings) are now **fully implemented**; they are kept in place to preserve section numbering across audits. 2.8 (Bots) is partial **by design** — the remaining endpoints do not exist in the API.

### 2.1 Talk API v4 - Participant Management
**Status:** ✅ Implemented (added 2026-10-14; live-verified against Nextcloud 34 / Talk). *List/join and route existence for remove/promote/demote/permissions were verified live; their happy paths (a second participant) only surfaced as logic-400s on self-targeting, since the test account is alone in the room.*  
> **2026-10-14 correction:** most paths in the original table were invented. Authoritative routes (spreed stable31 `routesRoomController.php`): add is `POST /room/{token}/participants` (not `/participants/participant`), self join/leave is `/participants/active` (no `/self` or `/auto`), remove attendee is `DELETE /room/{token}/attendees` with `{attendee:<attendeeId>}` body, promote/demote is `POST|DELETE /room/{token}/moderators` with `{attendee}`, and per-attendee permissions is `PUT /room/{token}/attendees/permissions` with `{attendee, method: set|add|remove, permissions}`.

**Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/spreed/api/v4/room/{token}/participants` | `Talk.addParticipant()` (`talk add-participant`) |
| GET | `/spreed/api/v4/room/{token}/participants` | `Talk.listParticipants()` (`talk participants`; handles both array and `{items,pending}` pagination shapes) |
| POST | `/spreed/api/v4/room/{token}/participants/active` | `Talk.joinConversation()` (`talk join`) |
| DELETE | `/spreed/api/v4/room/{token}/participants/active` | `Talk.leaveConversation()` (`talk leave`) |
| DELETE | `/spreed/api/v4/room/{token}/attendees` | `Talk.removeParticipant()` (`talk remove-participant --participant <attendeeId>`) |
| POST | `/spreed/api/v4/room/{token}/moderators` | `Talk.promoteParticipant()` (`talk promote --attendee`) |
| DELETE | `/spreed/api/v4/room/{token}/moderators` | `Talk.demoteParticipant()` (`talk demote --attendee`) |
| PUT | `/spreed/api/v4/room/{token}/attendees/permissions` | `Talk.updateParticipantPermissions()` (`talk set-participant-permissions --method set\|add\|remove --permissions <bitmask>`) |
| PUT | `/spreed/api/v1/bot/{token}/{botId}` | `Talk.enableBotInConversation()` |
| DELETE | `/spreed/api/v1/bot/{token}/{botId}` | `Talk.disableBotInConversation()` |

**Remaining:** none of practical use — self-participant info is derivable from `participants` output (entries carry `attendeeId`/`actorId`), and `/participants/inaccessible` is an internal UI concern.

---

### 2.2 Talk API v4 - Conversation Avatar Management
**Status:** ✅ Implemented (added 2026-10-14, live-verified upload → download → delete roundtrip)  
> **2026-10-14 correction:** the original audit's `v4` + `PUT` rows were wrong. Avatars live under **`/api/v1/room/{token}/avatar`** and upload is **POST** (not PUT); the multipart field name must be **`file`** (`AvatarController::uploadAvatar()` reads `getUploadedFile('file')` — using `avatar` yields HTTP 400 "No image file provided"). Only png/jpeg are accepted server-side.

**Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/spreed/api/v1/room/{token}/avatar` | `Talk.getAvatar()` — writes image to disk; structured "no avatar" on 404, `fallback:true` flag when the server serves its generated SVG placeholder (200) for rooms without a custom avatar |
| POST | `/spreed/api/v1/room/{token}/avatar` | `Talk.setAvatar()` — multipart upload, field `file` |
| DELETE | `/spreed/api/v1/room/{token}/avatar` | `Talk.deleteAvatar()` |

*Note:* the server re-encodes uploaded avatars, so a downloaded avatar is pixel-equivalent rather than byte-identical (verified on a 1×1 fixture).

---

### 2.3 Talk API v4 - Reaction Management
**Status:** ✅ Implemented (added 2026-06 in `92ac079`; exposed as `talk add-reaction` / `delete-reaction` / `list-reactions`)  
**Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/spreed/api/v1/chat/{token}/message/{messageId}/reaction/{emoji}` | `Talk.addReaction()` |
| DELETE | `/spreed/api/v1/chat/{token}/message/{messageId}/reaction/{emoji}` | `Talk.deleteReaction()` |
| GET | `/spreed/api/v1/chat/{token}/message/{messageId}/reactions` | `Talk.listReactions()` |

**Remaining (Not Implemented):**
| Method | Endpoint | Description | Complexity |
|--------|----------|-------------|------------|
| GET | `/spreed/api/v1/chat/{token}/message/{messageId}/reactions/{emoji}` | Check if user reacted | Low |

---

### 2.4 Talk API v4 - Poll Management
**Status:** ✅ Fully Implemented (lifecycle added 2026-06 in `bd1e52d`; voting added 2026-10-14 with route correction — live-verified)  
> **2026-10-14 correction:** the poll routes are under **`/api/v1/poll/…`, not v4**, and the v4-style paths with `?conversationId=` query params never existed (spreed stable31 `routesPollController.php`). Also, there was **never a `publish` or `results` endpoint**: `showPoll` returns the tally, so `publish-poll` (broken in the wild since it was added) has been **removed**, and `get-poll-results` remains as an alias of `get-poll`. Create body uses `resultMode`/`maxVotes` (the old `voteMode`/`voteMax` names are rejected by current servers).

**Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| POST | `/spreed/api/v1/poll/{token}` | `Talk.createPoll({question, options[], resultMode, maxVotes})` |
| GET | `/spreed/api/v1/poll/{token}/{pollId}` | `Talk.getPoll()` / `Talk.getPollResults()` (tallies + `votedSelf` + `numVoters`) |
| POST | `/spreed/api/v1/poll/{token}/{pollId}` | `Talk.votePoll()` — body `{optionIds:[…]}` (`talk vote-poll --option-ids 1,2`) |
| POST | `/spreed/api/v1/poll/{token}/{pollId}` | `Talk.unvotePoll()` — same route with empty `optionIds` (`talk unvote-poll`) |
| DELETE | `/spreed/api/v1/poll/{token}/{pollId}` | `Talk.closePoll()` |

*Verified live:* create → vote → tally reflects the vote → unvote clears it → close.

---

### 2.5 Talk API v4 - Breakout Rooms Management
**Status:** ⚠️ Not Implemented  
**Available Endpoints (Not Implemented):**
| Method | Endpoint | Description | Complexity |
|--------|----------|-------------|------------|
| POST | `/spreed/api/v4/breakout-rooms/{token}` | Configure breakout rooms | High |
| POST | `/spreed/api/v4/breakout-rooms/{token}/start` | Start breakout rooms | Low |
| POST | `/spreed/api/v4/breakout-rooms/{token}/stop` | Stop breakout rooms | Low |
| GET | `/spreed/api/v4/breakout-rooms/{token}` | Get breakout room configuration | Medium |
| POST | `/spreed/api/v4/breakout-rooms/{token}/room` | Create individual breakout room | High |
| PUT | `/spreed/api/v4/breakout-rooms/{token}/room/{roomId}` | Update breakout room | High |
| DELETE | `/spreed/api/v4/breakout-rooms/{token}/room/{roomId}` | Delete breakout room | High |
| POST | `/spreed/api/v4/breakout-rooms/{token}/room/{roomId}/participants` | Add participants to breakout room | Medium |

**Complexity Estimate:** **High**  
**Estimate Reasoning:**
- Complex nested room structures with participant assignments
- Multiple endpoint interactions for full workflow
- State management for room lifecycle (configured/started/stopped)
- Requires careful handling of parent-child room relationships

---

### 2.6 Talk API v4 - Call Management
**Status:** ⚠️ Not Implemented  
**Available Endpoints (Not Implemented):**
| Method | Endpoint | Description | Complexity |
|--------|----------|-------------|------------|
| POST | `/spreed/api/v4/call/{token}` | Join call | High |
| DELETE | `/spreed/api/v4/call/{token}` | Leave call | Low |
| PUT | `/spreed/api/v4/call/{token}/mute` | Mute self | Medium |
| PUT | `/spreed/api/v4/call/{token}/unmute` | Unmute self | Medium |
| PUT | `/spreed/api/v4/call/{token}/hold` | Place call on hold | Medium |
| PUT | `/spreed/api/v4/call/{token}/video-enable` | Enable video | Medium |
| PUT | `/spreed/api/v4/call/{token}/video-disable` | Disable video | Medium |
| GET | `/spreed/api/v4/call/{token}` | Get call state | High |
| DELETE | `/spreed/api/v4/call/{token}/participants/{participant}` | Kick participant from call | High |

**Complexity Estimate:** **High**  
**Estimate Reasoning:**
- Real-time call state management
- Participant list updates
- Video/audio state tracking
- Integration with signaling system (separate component)
- Requires WebSocket/HTTP streaming for call state

---

### 2.7 Talk API v4 - Call Recording Management
**Status:** ⚠️ Not Implemented  
**Available Endpoints (Not Implemented):**
| Method | Endpoint | Description | Complexity |
|--------|----------|-------------|------------|
| GET | `/spreed/api/v4/recording/{token}` | Get call recording info | Medium |
| POST | `/spreed/api/v4/recording/{token}/start` | Start recording | Low |
| POST | `/spreed/api/v4/recording/{token}/stop` | Stop recording | Low |
| DELETE | `/spreed/api/v4/recording/{token}` | Delete recording | Low |

**Complexity Estimate:** **Low**  
**Estimate Reasoning:**
- Simple start/stop/delete operations
- Recording metadata is JSON-based
- No complex data structures

---

### 2.8 Talk API v4 - Bot Management
**Status:** ⚠️ Partial **by design** — the implemented surface is the *entire* API (2026-10-14 finding)  
> **2026-10-14:** the original audit's registration/edit/icon endpoints **do not exist** (verified against spreed stable31 `routesBotController.php`, which matches the live server; unknown OCS routes return meta 998). The bot API exposes only: `GET /api/v1/bot/admin` (admin listing), `GET /api/v1/bot/{token}` (per-conversation listing), `POST|DELETE /api/v1/bot/{token}/{botId}` (enable/disable), plus webhook-driven send/react. **Registration, editing, removal, and icon management have no OCS endpoints** — they are admin-terminal-only: `occ talk:bot:install` / `occ talk:bot:remove`. Implementation code for register/edit/remove/icon was written during the 2026-10-14 sprint and *removed* once the routes file confirmed those endpoints never existed.

**Implemented:**
| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/spreed/api/v1/bot/admin` | `Talk.listBots()` (no `--token`; requires server admin) |
| GET | `/spreed/api/v1/bot/{token}` | `Talk.listBots(token)` |
| POST | `/spreed/api/v1/bot/{token}/{botId}` | `Talk.enableBotInConversation()` |
| DELETE | `/spreed/api/v1/bot/{token}/{botId}` | `Talk.disableBotInConversation()` |

**Remaining:** none API-reachable. Admin terminal (`occ`) is the only path for bot lifecycle management.

---

### 2.9 Talk API v4 - Webinar Management
**Status:** ⚠️ Not Implemented  
**Available Endpoints (Not Implemented):**
| Method | Endpoint | Description | Complexity |
|--------|----------|-------------|------------|
| PUT | `/spreed/api/v4/webinar/{token}` | Configure webinar settings | High |
| POST | `/spreed/api/v4/webinar/{token}/start` | Start webinar | Low |
| POST | `/spreed/api/v4/webinar/{token}/stop` | Stop webinar | Low |
| GET | `/spreed/api/v4/webinar/{token}` | Get webinar configuration | Medium |
| POST | `/spreed/api/v4/webinar/{token}/survey` | Send survey to attendees | Low |
| GET | `/spreed/api/v4/webinar/{token}/survey` | Get survey results | High |

**Complexity Estimate:** **High**  
**Estimate Reasoning:**
- Webinar configuration involves multiple settings (moderator, attendee permissions, etc.)
- Survey management requires data aggregation
- Webinar lifecycle state management

---

### 2.10 Talk API v4 - Settings Management
**Status:** ✅ Implemented (added 2026-06 in `509dc31` → `009af5e`)  
> **Correction:** the `/spreed/api/v4/settings/{token}` endpoints listed in the original audit **do not exist** (they return 404 — verified in `0253286`/`4f33642`). Settings are read from the room resource and written through dedicated room subresources.

**Implemented:**
| Method | Endpoint | Setting |
|--------|----------|---------|
| GET | `/spreed/api/v4/room/{token}` | `Talk.getSettings()` / `Talk.getGuestSettings()` (room JSON carries settings) |
| POST/DELETE | `/spreed/api/v4/room/{token}/favorite` | Favorite toggle |
| POST | `/spreed/api/v4/room/{token}/notify` | Notification level |
| PUT | `/spreed/api/v4/room/{token}/read-only` | Read-only state |
| PUT | `/spreed/api/v4/room/{token}/password` | Room password |
| POST/DELETE | `/spreed/api/v4/room/{token}/public` | Public/private |
| PUT | `/spreed/api/v4/room/{token}/listable` | Listable scope |
| PUT | `/spreed/api/v4/room/{token}/permissions/default` | Default permissions |

**Remaining:** per-user `muted` cannot be changed via the user app-password API (documented limitation in `Talk.updateSettings()`).

---

## 3. Not Implemented Features

### 3.1 Files API (WebDAV) - Advanced Features
**Status:** ❌ Not Implemented  
**Missing Endpoints:**

| Method | Endpoint | Description | Complexity | Priority |
|--------|----------|-------------|------------|----------|
| PROPFIND | `/remote.php/dav/files/{user}/trash-bin/` | List trash bin | Medium | Medium |
| MOVE | Trash bin resource | Restore trashed file | Medium | Medium |
| DELETE | `/remote.php/dav/files/{user}/trash-bin/{id}` | Permanently delete trashed file | Low | Low |
| GET | `/remote.php/dav/files/{user}/versions/` | List file versions | Medium | Low |
| PUT | Versions endpoint | Restore file version | High | Low |
| GET | `/remote.php/dav/meta/{id}` | Get file metadata (tags, ratings) | Low | Medium |
| POST | Favorites endpoint | Toggle favorites | Low | Medium |
| PROPFIND | `/remote.php/dav/files/{user}/` with `d:propfind` | Get specific properties only | Low | Medium |

**Complexity Estimate:** **Medium**  
**Estimate Reasoning:**
- Trash bin requires MOVE/DELETE operations on special endpoints
- Version management requires understanding of Nextcloud versioning system
- Favorites use special DAV properties
- Metadata (tags, ratings) uses additional apps API

---

### 3.2 Shares API - Additional Share Types
**Status:** ⚠️ Mostly Implemented (Remote + Chat ✅ 2026-10-14; Email still missing)  
> **2026-10-14 correction:** remote and chat shares do **not** have dedicated endpoints — they are ordinary `POST /ocs/v2.php/apps/files_sharing/api/v1/shares` calls with a different `shareType` (6 = remote, 10 = chat). The originally-audited `/remote.php/dav/share/` and `/share_chat` paths do not exist.

| Share Type | How | Description | Status |
|------------|-----|-------------|--------|
| Group Share | `shareType 1` | `Shares.createGroupShare()` (`shares create-group`) | ✅ |
| User Share | `shareType 0` | `Shares.createUserShare()` (`shares create-user`) | ✅ |
| Public Link | `shareType 3` | `Shares.createLink()` (`shares create-link`) | ✅ |
| **Remote Share** | `shareType 6`, `shareWith = user@server` | `Shares.createRemoteShare()` (`shares create-remote`); optional `--permissions` / `--expire` | ✅ 2026-10-14 — endpoint wiring verified live (structured 403 "Failed to create share" against a fake peer; full success needs federation enabled) |
| **Chat Share** | `shareType 10`, `shareWith = <roomToken>` | `Shares.createChatShare()` (`shares create-chat`) — server auto-posts the share message to the conversation and returns `sharedToConversation` | ✅ 2026-10-14 (live-verified) |
| **Email Share** | `shareType 4` (email registration flow) | Requires mail server integration + guest-app registration on the recipient side | ❌ still missing |

**Remaining complexity:** **High (email only)** — email shares need server mail configuration and the recipient-facing guest flow; there is no simple CLI-only path.

---

### 3.3 CalDAV - Additional Features
**Status:** ❌ Not Implemented (calendar color ✅ implemented 2026-06 — see 1.6/1.7)  
**Missing Features:**

| Feature | Description | Complexity | Priority |
|---------|-------------|------------|----------|
| Calendar scheduling (iCalendar RSVP) | Attendee RSVP handling (REQUEST/REPLY) | High | Low |
| Calendar alarm (VALARM) | Alarm notifications (AUDIO, DISPLAY, EMAIL) | Medium | Medium |
| Calendar free/busy queries | `/freebusy/{user}.ics` endpoint | Medium | Low |
| Calendar delegation | Delegate calendar management to another user | High | Low |
| Recurrence rule parsing | RRULE, RDATE, EXDATE handling | High | Medium |
| Calendar description via DAV props | Store calendar description in properties | Low | Low |
| Calendar timezone support | Calendar-specific timezone configuration | Medium | Medium |

**Complexity Estimate:** **High**  
**Estimate Reasoning:**
- Recurrence rules require full iCalendar parser (not just regex)
- Free/busy requires calendar aggregation
- Scheduling involves complex protocol flows

---

### 3.4 CardDAV - Additional Features
**Status:** ⚠️ PHOTO ✅ Implemented (2026-10-14, live-verified byte-identical download roundtrip); sync excluded from skill scope  

| Feature | Status | Notes |
|---------|--------|-------|
| vCard PHOTO field | ✅ 2026-10-14 | `contacts create/edit --photo <img>` (RFC 6350 folded base64, png/jpg/jpeg/gif/webp/bmp) and `contacts photo --uid X [--output f]`. `contacts get` reports `hasPhoto`/`photoMime` without dumping the payload. Parses both v3 (`ENCODING=BASE64\|b;TYPE=…`) and v4 (`data:image/…;base64,`) encodings; editing a photo replaces the old value |
| vCard photo thumbnails | — N/A | Thumbnails (PHOTO;VALUE=URI) are generated server-side by Sabre/Nextcloud previews; not a client API surface |
| vCard vCard4 support | — partial by design | The CLI writes vCard 3.0 (Sabre normalizes on save); the parser accepts both v3 and v4 PHOTO encodings, matching what mixed servers return |
| CardDAV sync collections | ❌ excluded | Deliberately excluded per product decision (2026-10-14): the skill is request/response oriented; sync-token state management would add persistence the CLI intentionally lacks |

*Implementation note:* raw vCard text extracted from DAV XML must be entity-decoded (`&#13;` → CR) before regex parsing or write-back; `utils.decodeNumericEntities()` does this in `findContactPath`, which also fixed a pre-existing bug where `contacts edit` PUT literal `&#13;` sequences back to the server (HTTP 415 on modern Sabre).

---

### 3.5 Notes API - Advanced Features
**Status:** ⚠️ Mostly Implemented (categories API, history viewing, export backup ✅ 2026-06 — see 1.1)  
**Missing Features:**

| Feature | Description | Complexity | Priority |
|---------|-------------|------------|----------|
| Note history restore | Restore a note from a history version | High | Low |
| Backup import/restore | Import notes from a backup export | Medium | Low |
| Note tagging | Custom tag system (beyond the built-in categories) | Medium | Low |
| Note attachments | Attach files to notes | High | Low |

**Complexity Estimate:** **Medium**  
**Estimate Reasoning:**
- Categories require separate endpoint management
- Attachments need WebDAV file handling
- History requires version tracking

---

### 3.6 Talk API v4 - Advanced Features
**Status:** ❌ Not Implemented  
**Missing Endpoints (Summary):**

| Category | Endpoints | Complexity | Priority |
|----------|-----------|------------|----------|
| **Avatar Management** | ✅ Implemented 2026-10-14 (`/api/v1/room/{token}/avatar`, GET/POST/DELETE) | — | Done |
| **Reaction Management** | ✅ Implemented 2026-06 (only "did I react" check remaining) | — | Done |
| **Poll Management** | ✅ Fully implemented incl. `vote`/`unvote` (2026-10-14; routes corrected v4→v1) | — | Done |
| **Participant Management** | ✅ Implemented 2026-10-14 (list/join/leave/remove/promote/demote/per-attendee permissions) | — | Done |
| **Breakout Rooms** | 7+ endpoints for room configuration | High | High |
| **Call Management** | 8+ endpoints for call control | High | High |
| **Call Recording** | 4 endpoints for recording lifecycle | Low | Low |
| **Bot Management** | ⚠️ Partial by design — API surface (list/enable/disable) exhausted; registration is `occ` terminal only | — | Done |
| **Webinar** | 6+ endpoints for webinar control | High | Medium |
| **Settings** | ✅ Implemented 2026-06 via room subresource endpoints | — | Done |

**Complexity Estimate:** **High**  
**Estimate Reasoning:**
- Breakout rooms and call management are complex state machines
- Multiple endpoint interactions for complete workflows
- Real-time features require WebSocket integration

---

## 4. Implementation Effort Summary

### 4.1 Priority Matrix

| Feature Area | Priority | Estimated Effort | Complexity |
|--------------|----------|------------------|------------|
| **High Priority** | | | |
| Breakout Rooms | 🔴 High | 2-3 days | High |
| Call Management | 🔴 High | 3-4 days | High |
| File Trash | 🟡 Medium | 1-2 days | Medium |
| ~~Talk Reactions~~ ✅ Done (2026-06) | — | — | — |
| ~~Poll Voting (`vote`/`unvote`)~~ ✅ Done (2026-10-14; v1 route correction) | — | — | — |
| ~~Participant Management~~ ✅ Done (2026-10-14) | — | — | — |
| **Medium Priority** | | | |
| ~~Bot Management~~ ⚠️ Done as far as the API allows (2026-10-14); registration = `occ` terminal | — | — | — |
| File Versions | 🟢 Low | 1-2 days | Medium |
| Calendar Free/Busy | 🟢 Low | 2 days | Medium |
| ~~Contact Photos~~ ✅ Done (2026-10-14) | — | — | — |
| **Low Priority** | | | |
| Calendar Recurrence | 🟢 Low | 2-3 days | High |
| ~~Remote Shares~~ ✅ Done (2026-10-14, `shareType 6` via OCS) | — | — | — |
| Notes Attachments | 🟢 Low | 2-3 days | High |
| Email Shares | 🟢 Low | 2-3 days | High |

---

### 4.2 Complexity Scoring Key

| Complexity | Definition | Examples |
|------------|------------|----------|
| **Low** | Single endpoint, simple JSON, no state | Avatar delete, reaction remove, message edit |
| **Medium** | Multiple endpoints, moderate state, some parsing | Participant management, bot registration, contact photo |
| **High** | Complex state machine, many endpoints, real-time | Call management, breakout rooms, recurrence parsing |

---

## 5. Recommendations

> **2026-10-14:** Talk Reactions and conversation settings (original Q2/Q3 items) are complete and removed below. Breakout rooms and call management were re-prioritized down — complex state machines with limited CLI value without real-time transport.  
> **2026-10-14 (impl sprint):** Participant Management, Poll Voting, Contact Photos, Conversation Avatars, and Remote + Chat Shares all landed the same day and are struck from the roadmap below.

### 5.1 Immediate Actions (Q4 2026)
1. ~~**Participant Management** (list/remove/promote/demote)~~ ✅ Done 2026-10-14
2. ~~**Poll Voting** (`vote`/`unvote`)~~ ✅ Done 2026-10-14
3. **File Trash Operations** - Basic file management gap (only remaining immediate item)

### 5.2 Short-Term Enhancements (2027 H1)
1. ~~**Contact Photos**~~ ✅ Done 2026-10-14
2. **File Versions** - Basic file version history
3. ~~**Conversation Avatars**~~ ✅ Done 2026-10-14
4. **Note History Restore** - Completes the Notes history/backup feature

### 5.3 Long-Term Roadmap (2027+)
1. **Breakout Rooms / Call Management** - Complex state machines, likely low CLI value without real-time transport
2. **Calendar Recurrence Parsing** - Advanced scheduling needs (would replace regex iCalendar handling)
3. ~~**Remote Shares**~~ ✅ Done 2026-10-14 (`shareType 6` via OCS + federation)
4. **Notes Attachments** - Enhanced note functionality

---

## 6. Conclusion

The current implementation provides **solid foundational coverage** of Nextcloud's core APIs. The CLI skill excels at basic CRUD operations for Notes, Files, CalDAV, CardDAV (including contact photos), and now covers most of the practical Talk API surface (chat, reactions, full poll lifecycle incl. voting, room settings, participant management, conversation avatars, bot enable/disable) alongside Shares (link/user/group/remote/chat).

**Key Gaps:**
- **Talk API:** Breakout rooms, call control, recording, webinar (all state-machine / real-time oriented; see 2.5/2.6/2.9)
- **Files API:** Missing trash, versions, favorites, and advanced sharing options
- **CalDAV/CardDAV:** Missing recurrence parsing, free/busy, alarms, and sync-token support (sync intentionally excluded)

**Strengths:**
- Well-structured module design with consistent error handling
- Comprehensive search/list operations across all services
- Proper ETag handling for optimistic concurrency
- Clean JSON output format suitable for automation

**Overall Assessment:** The implementation is production-ready for everyday workflows (notes, files, calendar, contacts, sharing, and Talk chat with reactions/polls); real-time and admin-oriented Talk features remain the main gap to full-featured Nextcloud clients.

---

## 7. Revision History

| Date | Notes |
|------|-------|
| 2026-05-31 | Original audit against monolithic `index.js` |
| 2026-10-14 | Re-audit against `src/` modules after the `feature/nextcloud-talk-integration` sprint: Notes categories/history/backup (`37d0e9b`), CardDAV extended vCard fields (`ad321eb`), CalDAV calendar colors (`11161b7`), Talk reactions (`92ac079`) and poll lifecycle (`bd1e52d`), conversation/guest settings via room subresource endpoints (`509dc31`, `009af5e`). Corrected the non-existent `/spreed/api/v4/settings/{token}` endpoint claims and bot API version (`v1`, not `v4`); re-prioritized the recommendations matrix |
| 2026-10-14 (impl sprint) | Implemented against a live Nextcloud 34 / Talk instance: participant management (2.1 ✅), conversation avatars (2.2 ✅), poll voting (2.4 ✅), remote + chat shares (3.2 ✅), contact PHOTO (3.4 ✅). **Route corrections:** polls live under `/api/v1/poll/{token}…` (the v4 paths, `publish` and `results` endpoints never existed — `publish-poll` removed; create body uses `resultMode`/`maxVotes`); avatar upload is `POST` with multipart field `file`; participants join/leave via `/participants/active`, remove via `DELETE /attendees`, permissions via `/attendees/permissions`. **Finding:** bot registration/edit/icon have **no OCS API** (verified vs spreed `routesBotController.php`) — `occ talk:bot:install` terminal only. Also fixed vCard XML-entity handling (`&#13;` decode) which had been corrupting `contacts edit` round-trips (HTTP 415) |
