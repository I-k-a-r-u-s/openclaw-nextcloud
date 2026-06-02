#!/usr/bin/env node

import { parseArgs } from "node:util";
import { formatISO, addDays } from "date-fns";
import { Notes } from "./notes.js";
import { Files } from "./files.js";
import { CalDAV } from "./caldav.js";
import { Shares } from "./shares.js";
import { Talk } from "./talk.js";
import { Contacts } from "./contacts.js";
import { output, errorOutput } from "./utils.js";
import { validateConfig } from "./config.js";

const COMMON_OPTIONS = {
  id: { type: "string" },
  title: { type: "string" },
  content: { type: "string" },
  category: { type: "string" },
  name: { type: "string" },
  path: { type: "string" },
  query: { type: "string" },
  uid: { type: "string" },
  calendar: { type: "string" },
  addressbook: { type: "string" },
  due: { type: "string" },
  priority: { type: "string" },
  description: { type: "string" },
  location: { type: "string" },
  start: { type: "string" },
  end: { type: "string" },
  from: { type: "string" },
  to: { type: "string" },
  summary: { type: "string" },
  color: { type: "string" },
  type: { type: "string" },
  permissions: { type: "string" },
  password: { type: "string" },
  expire: { type: "string" },
  user: { type: "string" },
  group: { type: "string" },
  token: { type: "string" },
  limit: { type: "string" },
  "look-into-future": { type: "string" },
  message: { type: "string" },
  "reply-to": { type: "string" },
  "message-id": { type: "string" },
  emoji: { type: "string" },
  question: { type: "string" },
  options: { type: "string" },
  "poll-id": { type: "string" },
  "bot-id": { type: "string" },
  file: { type: "string" },
  source: { type: "string" },
  invite: { type: "string" },
  muted: { type: "string" },
  "notification-level": { type: "string" },
  "read-only": { type: "string" },
  listable: { type: "string" },
  favorite: { type: "string" },
  output: { type: "string" },
  email: { type: "string" },
  "email-type": { type: "string" },
  phone: { type: "string" },
  "phone-type": { type: "string" },
  organization: { type: "string" },
  note: { type: "string" },
  bday: { type: "string" },
  anniversary: { type: "string" },
  url: { type: "string" },
  role: { type: "string" },
  address: { type: "string" },
};

async function main() {
  validateConfig();

  const args = process.argv.slice(2);
  const command = args[0];
  const subCommand = args[1];
  const flagArgs = args.slice(2);

  if (!command) {
    console.log(
      "Usage: node index.js <notes|files|calendar|calendars|tasks|talk|contacts|addressbooks|shares> <subcommand> [options]",
    );
    return;
  }

  let values;
  try {
    const parsed = parseArgs({
      args: flagArgs,
      options: COMMON_OPTIONS,
      allowPositionals: false,
    });
    values = parsed.values;
  } catch (e) {
    errorOutput(new Error(`Invalid arguments: ${e.message}`));
    return;
  }

  try {
    switch (command) {
      case "notes":
        await handleNotes(subCommand, values);
        break;
      case "files":
        await handleFiles(subCommand, values);
        break;
      case "calendar":
        await handleCalendar(subCommand, values);
        break;
      case "tasks":
        await handleTasks(subCommand, values);
        break;
      case "calendars":
        await handleCalendars(subCommand, values);
        break;
      case "addressbooks":
        await handleAddressBooks(subCommand, values);
        break;
      case "shares":
        await handleShares(subCommand, values);
        break;
      case "talk":
        await handleTalk(subCommand, values);
        break;
      case "contacts":
        await handleContacts(subCommand, values);
        break;
      default:
        console.log(
          "Usage: node index.js <notes|files|calendar|calendars|tasks|talk|contacts|addressbooks|shares> <subcommand> [options]",
        );
    }
  } catch (err) {
    errorOutput(err);
  }
}

async function handleNotes(subCommand, values) {
  switch (subCommand) {
    case "list":
      output(await Notes.list());
      break;
    case "get": {
      if (!values.id) throw new Error("Missing --id");
      output(await Notes.get(values.id));
      break;
    }
    case "create": {
      if (!values.title || !values.content) {
        throw new Error("Missing --title or --content arguments");
      }
      output(await Notes.create(values.title, values.content, values.category));
      break;
    }
    case "edit": {
      if (!values.id) throw new Error("Missing --id");
      output(
        await Notes.update(
          values.id,
          values.title,
          values.content,
          values.category,
        ),
      );
      break;
    }
    case "delete": {
      if (!values.id) throw new Error("Missing --id");
      output(await Notes.delete(values.id));
      break;
    }
    case "list-categories":
      output(await Notes.listCategories());
      break;
    case "create-category": {
      if (!values.name) throw new Error("Missing --name");
      output(await Notes.createCategory(values.name));
      break;
    }
    case "delete-category": {
      if (!values.name) throw new Error("Missing --name");
      output(await Notes.deleteCategory(values.name));
      break;
    }
    case "history": {
      if (!values.id) throw new Error("Missing --id");
      output(await Notes.getNoteHistory(values.id));
      break;
    }
    case "backup": {
      const backup = await Notes.getBackup();
      if (values.output) {
        const fs = await import("node:fs");
        fs.writeFileSync(values.output, JSON.stringify(backup, null, 2));
        output({ status: "backup-written", path: values.output });
      } else {
        output(backup);
      }
      break;
    }
    default:
      throw new Error("Unknown notes command");
  }
}

async function handleFiles(subCommand, values) {
  switch (subCommand) {
    case "list":
      output(await Files.list(values.path || "/"));
      break;
    case "search": {
      if (!values.query) throw new Error("Missing --query");
      output(await Files.search(values.query));
      break;
    }
    case "upload": {
      if (!values.path) throw new Error("Missing --path");
      if (values.content === undefined) throw new Error("Missing --content");
      output(await Files.upload(values.path, values.content));
      break;
    }
    case "get": {
      if (!values.path) throw new Error("Missing --path");
      output(await Files.get(values.path));
      break;
    }
    case "delete": {
      if (!values.path) throw new Error("Missing --path");
      output(await Files.delete(values.path));
      break;
    }
    default:
      throw new Error("Unknown files command");
  }
}

async function handleCalendar(subCommand, values) {
  switch (subCommand) {
    case "list": {
      const start = values.from || formatISO(new Date());
      const end = values.to || formatISO(addDays(new Date(), 7));
      output(await CalDAV.getEvents(start, end));
      break;
    }
    case "create": {
      if (!values.summary) throw new Error("Missing --summary");
      if (!values.start) throw new Error("Missing --start");
      if (!values.end) throw new Error("Missing --end");
      output(
        await CalDAV.createEvent(
          values.summary,
          values.start,
          values.end,
          values.calendar,
          values.description,
          values.location,
        ),
      );
      break;
    }
    case "edit": {
      if (!values.uid) throw new Error("Missing --uid");
      const updates = {};
      if (values.summary !== undefined) updates.summary = values.summary;
      if (values.start !== undefined) updates.start = values.start;
      if (values.end !== undefined) updates.end = values.end;
      if (values.description !== undefined)
        updates.description = values.description;
      if (values.location !== undefined) updates.location = values.location;
      output(await CalDAV.updateEvent(values.uid, values.calendar, updates));
      break;
    }
    case "delete": {
      if (!values.uid) throw new Error("Missing --uid");
      output(await CalDAV.deleteEvent(values.uid, values.calendar));
      break;
    }
    case "get-color": {
      const calendar = await CalDAV.getCalendar(values.calendar, "VEVENT");
      output(await CalDAV.getCalendarColor(calendar.url));
      break;
    }
    case "set-color": {
      if (!values.color) throw new Error("Missing --color");
      const calendar = await CalDAV.getCalendar(values.calendar, "VEVENT");
      output(await CalDAV.setCalendarColor(calendar.url, values.color));
      break;
    }
    default:
      throw new Error("Unknown calendar command");
  }
}

async function handleTasks(subCommand, values) {
  switch (subCommand) {
    case "list":
      output(await CalDAV.getTodos(values.calendar));
      break;
    case "create": {
      if (!values.title) throw new Error("Missing --title");
      output(
        await CalDAV.createTask(
          values.title,
          values.calendar,
          values.due,
          values.priority,
          values.description,
        ),
      );
      break;
    }
    case "edit": {
      if (!values.uid) throw new Error("Missing --uid");
      const updates = {};
      if (values.title !== undefined) updates.title = values.title;
      if (values.due !== undefined) updates.dueDate = values.due;
      if (values.priority !== undefined) updates.priority = values.priority;
      if (values.description !== undefined)
        updates.description = values.description;
      output(await CalDAV.updateTask(values.uid, values.calendar, updates));
      break;
    }
    case "delete": {
      if (!values.uid) throw new Error("Missing --uid");
      output(await CalDAV.deleteTask(values.uid, values.calendar));
      break;
    }
    case "complete": {
      if (!values.uid) throw new Error("Missing --uid");
      output(await CalDAV.completeTask(values.uid, values.calendar));
      break;
    }
    case "get-color": {
      const calendar = await CalDAV.getCalendar(values.calendar, "VTODO");
      output(await CalDAV.getCalendarColor(calendar.url));
      break;
    }
    case "set-color": {
      if (!values.color) throw new Error("Missing --color");
      const calendar = await CalDAV.getCalendar(values.calendar, "VTODO");
      output(await CalDAV.setCalendarColor(calendar.url, values.color));
      break;
    }
    default:
      throw new Error("Unknown tasks command");
  }
}

async function handleCalendars(subCommand, values) {
  switch (subCommand) {
    case "list": {
      let componentType = null;
      if (values.type === "tasks") componentType = "VTODO";
      else if (values.type === "events") componentType = "VEVENT";
      const calendars = await CalDAV.findCalendars(componentType);
      output(
        calendars.map((c) => ({
          name: c.displayname,
          type: c.componentType === "VTODO" ? "tasks" : "events",
        })),
      );
      break;
    }
    default:
      throw new Error("Unknown calendars command");
  }
}

async function handleAddressBooks(subCommand, values) {
  switch (subCommand) {
    case "list": {
      const addressBooks = await Contacts.findAddressBooks();
      output(addressBooks.map((a) => ({ name: a.displayname })));
      break;
    }
    default:
      throw new Error("Unknown addressbooks command");
  }
}

async function handleShares(subCommand, values) {
  switch (subCommand) {
    case "create-link": {
      if (!values.path) throw new Error("Missing --path");
      output(
        await Shares.createLink({
          path: values.path,
          permissions: values.permissions || "read",
          password: values.password || null,
          expireDate: values.expire || null,
        }),
      );
      break;
    }
    case "list":
      output(await Shares.list({ path: values.path || null }));
      break;
    case "create-user": {
      if (!values.path) throw new Error("Missing --path");
      if (!values.user) throw new Error("Missing --user");
      output(
        await Shares.createUserShare({
          path: values.path,
          user: values.user,
          permissions: values.permissions || "read",
          expireDate: values.expire || null,
        }),
      );
      break;
    }
    case "create-group": {
      if (!values.path) throw new Error("Missing --path");
      if (!values.group) throw new Error("Missing --group");
      output(
        await Shares.createGroupShare({
          path: values.path,
          group: values.group,
          permissions: values.permissions || "read",
          expireDate: values.expire || null,
        }),
      );
      break;
    }
    case "delete": {
      if (!values.id) throw new Error("Missing --id");
      output(await Shares.delete({ id: values.id }));
      break;
    }
    default:
      throw new Error("Unknown shares command");
  }
}

function buildTalkSettings(values) {
  const settings = {};
  if (values.muted !== undefined)
    settings.muted = values.muted === "1" || values.muted === "true";
  if (values["notification-level"] !== undefined)
    settings.notificationLevel = values["notification-level"];
  if (values["read-only"] !== undefined)
    settings.readOnly =
      values["read-only"] === "1" || values["read-only"] === "true";
  if (values.listable !== undefined)
    settings.listable = values.listable === "1" || values.listable === "true";
  if (values.favorite !== undefined)
    settings.favorite = values.favorite === "1" || values.favorite === "true";
  if (values.password !== undefined) settings.password = values.password;
  return settings;
}

async function handleTalk(subCommand, values) {
  switch (subCommand) {
    case "list":
      output(await Talk.listConversations());
      break;
    case "create": {
      if (!values.name) throw new Error("Missing --name");
      const options = {};
      if (values.description) options.description = values.description;
      if (values.password) options.password = values.password;
      output(
        await Talk.createConversation(
          values.name,
          values.type || "group",
          values.invite || null,
          options,
        ),
      );
      break;
    }
    case "delete": {
      if (!values.token) throw new Error("Missing --token");
      output(await Talk.deleteConversation(values.token));
      break;
    }
    case "get": {
      if (!values.token) throw new Error("Missing --token");
      output(await Talk.getConversation(values.token));
      break;
    }
    case "messages": {
      if (!values.token) throw new Error("Missing --token");
      const limit = values.limit ? parseInt(values.limit, 10) : 50;
      const lookIntoFuture = values["look-into-future"]
        ? parseInt(values["look-into-future"], 10)
        : 0;
      output(
        await Talk.listMessages(values.token, {
          limit,
          lookIntoFuture,
          setReadMarker: true,
        }),
      );
      break;
    }
    case "send": {
      if (!values.token) throw new Error("Missing --token");
      if (!values.message) throw new Error("Missing --message");
      const replyTo = values["reply-to"]
        ? parseInt(values["reply-to"], 10)
        : null;
      output(await Talk.sendMessage(values.token, values.message, replyTo));
      break;
    }
    case "delete-message": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["message-id"]) throw new Error("Missing --message-id");
      output(
        await Talk.deleteMessage(
          values.token,
          parseInt(values["message-id"], 10),
        ),
      );
      break;
    }
    case "edit-message": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["message-id"]) throw new Error("Missing --message-id");
      if (!values.message) throw new Error("Missing --message");
      output(
        await Talk.editMessage(
          values.token,
          parseInt(values["message-id"], 10),
          values.message,
        ),
      );
      break;
    }
    case "add-participant": {
      if (!values.token) throw new Error("Missing --token");
      if (!values.user) throw new Error("Missing --user");
      output(
        await Talk.addParticipant(
          values.token,
          values.user,
          values.source || "users",
        ),
      );
      break;
    }
    case "enable-bot": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["bot-id"]) throw new Error("Missing --bot-id");
      output(
        await Talk.enableBotInConversation(
          values.token,
          parseInt(values["bot-id"], 10),
        ),
      );
      break;
    }
    case "disable-bot": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["bot-id"]) throw new Error("Missing --bot-id");
      output(
        await Talk.disableBotInConversation(
          values.token,
          parseInt(values["bot-id"], 10),
        ),
      );
      break;
    }
    case "upload-file": {
      if (!values.token) throw new Error("Missing --token");
      if (!values.file) throw new Error("Missing --file");
      if (values.content === undefined) throw new Error("Missing --content");
      output(
        await Talk.uploadFileToConversation(
          values.token,
          values.file,
          values.content,
        ),
      );
      break;
    }
    case "add-reaction": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["message-id"]) throw new Error("Missing --message-id");
      if (!values.emoji) throw new Error("Missing --emoji");
      output(
        await Talk.addReaction(
          values.token,
          parseInt(values["message-id"], 10),
          values.emoji,
        ),
      );
      break;
    }
    case "delete-reaction": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["message-id"]) throw new Error("Missing --message-id");
      if (!values.emoji) throw new Error("Missing --emoji");
      output(
        await Talk.deleteReaction(
          values.token,
          parseInt(values["message-id"], 10),
          values.emoji,
        ),
      );
      break;
    }
    case "list-reactions": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["message-id"]) throw new Error("Missing --message-id");
      output(
        await Talk.listReactions(
          values.token,
          parseInt(values["message-id"], 10),
        ),
      );
      break;
    }
    case "create-poll": {
      if (!values.token) throw new Error("Missing --token");
      if (!values.question) throw new Error("Missing --question");
      if (!values.options) throw new Error("Missing --options");
      const opts = values.options.split(",").map((o) => o.trim());
      output(await Talk.createPoll(values.token, values.question, opts));
      break;
    }
    case "get-poll": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["poll-id"]) throw new Error("Missing --poll-id");
      output(await Talk.getPoll(values.token, values["poll-id"]));
      break;
    }
    case "close-poll": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["poll-id"]) throw new Error("Missing --poll-id");
      output(await Talk.closePoll(values.token, values["poll-id"]));
      break;
    }
    case "publish-poll": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["poll-id"]) throw new Error("Missing --poll-id");
      output(await Talk.publishPoll(values.token, values["poll-id"]));
      break;
    }
    case "get-poll-results": {
      if (!values.token) throw new Error("Missing --token");
      if (!values["poll-id"]) throw new Error("Missing --poll-id");
      output(await Talk.getPollResults(values.token, values["poll-id"]));
      break;
    }
    case "list-bots": {
      const token = values.token || null;
      output(await Talk.listBots(token));
      break;
    }
    case "get-settings": {
      if (!values.token) throw new Error("Missing --token");
      output(await Talk.getSettings(values.token));
      break;
    }
    case "update-settings": {
      if (!values.token) throw new Error("Missing --token");
      output(
        await Talk.updateSettings(values.token, buildTalkSettings(values)),
      );
      break;
    }
    case "get-guest-settings": {
      if (!values.token) throw new Error("Missing --token");
      output(await Talk.getGuestSettings(values.token));
      break;
    }
    case "update-guest-settings": {
      if (!values.token) throw new Error("Missing --token");
      output(
        await Talk.updateGuestSettings(values.token, buildTalkSettings(values)),
      );
      break;
    }
    default:
      throw new Error("Unknown talk command");
  }
}

async function handleContacts(subCommand, values) {
  switch (subCommand) {
    case "list":
      output(await Contacts.list(values.addressbook));
      break;
    case "get": {
      if (!values.uid) throw new Error("Missing --uid");
      output(await Contacts.get(values.uid, values.addressbook));
      break;
    }
    case "search": {
      if (!values.query) throw new Error("Missing --query");
      output(await Contacts.search(values.query, values.addressbook));
      break;
    }
    case "create": {
      if (!values.name) throw new Error("Missing --name");
      const options = {};
      if (values.email) options.email = values.email;
      if (values["email-type"]) options.emailType = values["email-type"];
      if (values.phone) options.phone = values.phone;
      if (values["phone-type"]) options.phoneType = values["phone-type"];
      if (values.organization) options.organization = values.organization;
      if (values.title) options.title = values.title;
      if (values.note) options.note = values.note;
      if (values.bday) options.bday = values.bday;
      if (values.anniversary) options.anniversary = values.anniversary;
      if (values.url) options.url = values.url;
      if (values.role) options.role = values.role;
      if (values.address) options.address = values.address;
      output(await Contacts.create(values.name, values.addressbook, options));
      break;
    }
    case "edit": {
      if (!values.uid) throw new Error("Missing --uid");
      const updates = {};
      if (values.name !== undefined) updates.fullName = values.name;
      if (values.email !== undefined) updates.email = values.email;
      if (values.phone !== undefined) updates.phone = values.phone;
      if (values.organization !== undefined)
        updates.organization = values.organization;
      if (values.title !== undefined) updates.title = values.title;
      if (values.note !== undefined) updates.note = values.note;
      if (values.bday !== undefined) updates.bday = values.bday;
      if (values.anniversary !== undefined)
        updates.anniversary = values.anniversary;
      if (values.url !== undefined) updates.url = values.url;
      if (values.role !== undefined) updates.role = values.role;
      if (values.address !== undefined) updates.address = values.address;
      output(await Contacts.update(values.uid, values.addressbook, updates));
      break;
    }
    case "delete": {
      if (!values.uid) throw new Error("Missing --uid");
      output(await Contacts.delete(values.uid, values.addressbook));
      break;
    }
    default:
      throw new Error("Unknown contacts command");
  }
}

main();
