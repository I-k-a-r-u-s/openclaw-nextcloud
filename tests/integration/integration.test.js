import { test, describe } from "node:test";
import assert from "node:assert";

// Import config to trigger .env loading before credential check
await import("../../src/config.js");

const hasCredentials =
  process.env.NEXTCLOUD_URL &&
  process.env.NEXTCLOUD_USER &&
  process.env.NEXTCLOUD_TOKEN;

// Skip all integration tests if credentials are not available
test("Integration tests", { skip: !hasCredentials }, async () => {
  // Set env vars and import modules
  const { Notes } = await import("../../src/notes.js");
  const { Files } = await import("../../src/files.js");
  const { CalDAV } = await import("../../src/caldav.js");
  const { Contacts } = await import("../../src/contacts.js");
  const { Talk } = await import("../../src/talk.js");
  const { Shares } = await import("../../src/shares.js");

  const timestamp = Date.now();
  let testRoomToken = null;
  let testContactUid = null;
  let testTaskUid = null;
  let testEventUid = null;
  let testNoteId = null;
  let testShareId = null;

  await describe("Notes", async () => {
    await test("list notes", async () => {
      const result = await Notes.list();
      assert.ok(Array.isArray(result));
    });

    await test("create note", async () => {
      const result = await Notes.create(
        `Test Note ${timestamp}`,
        "Test content",
      );
      assert.ok(result.id);
      testNoteId = result.id;
    });

    await test("get note", async () => {
      if (!testNoteId) return;
      const result = await Notes.get(testNoteId);
      assert.equal(result.title, `Test Note ${timestamp}`);
    });

    await test("edit note", async () => {
      if (!testNoteId) return;
      const result = await Notes.update(testNoteId, `Updated ${timestamp}`);
      assert.equal(result.title, `Updated ${timestamp}`);
    });

    await test("delete note", async () => {
      if (!testNoteId) return;
      const result = await Notes.delete(testNoteId);
      assert.equal(result.success, true);
    });
  });

  await describe("Files", async () => {
    const testPath = `test-file-${timestamp}.txt`;

    await test("list root", async () => {
      const result = await Files.list("/");
      assert.ok(Array.isArray(result));
    });

    await test("upload file", async () => {
      const result = await Files.upload(testPath, "Hello, Nextcloud!");
      assert.equal(result.status, "uploaded");
    });

    await test("get file", async () => {
      const result = await Files.get(testPath);
      assert.equal(result.content, "Hello, Nextcloud!");
    });

    await test("search file", async () => {
      const result = await Files.search(`test-file-${timestamp}`);
      assert.ok(Array.isArray(result));
    });

    await test("delete file", async () => {
      const result = await Files.delete(testPath);
      assert.equal(result.status, "deleted");
    });
  });

  await describe("Calendars", async () => {
    let testCalendarName = null;

    await test("list calendars", async () => {
      const result = await CalDAV.findCalendars();
      assert.ok(Array.isArray(result));
      // Use the user's Personal calendar for testing
      // This is typically guaranteed to be writable
      const personalCal = result.find(
        (c) =>
          c.displayname === "Personal" || c.displayname === "Personal (me)",
      );
      testCalendarName =
        personalCal?.displayname || result[0]?.displayname || null;
    });

    await test("create event", async () => {
      if (!testCalendarName) {
        this.skip();
        return;
      }
      const start = new Date(Date.now() + 3600000).toISOString();
      const end = new Date(Date.now() + 7200000).toISOString();
      const result = await CalDAV.createEvent(
        `Test Event ${timestamp}`,
        start,
        end,
        testCalendarName,
        "Test description",
        "Test location",
      );
      assert.equal(result.status, "created");
      testEventUid = result.uid;
    });

    await test("list events", async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 86400000).toISOString();
      const result = await CalDAV.getEvents(start, end);
      assert.ok(Array.isArray(result));
    });

    await test("delete event", async () => {
      if (!testEventUid) return;
      const result = await CalDAV.deleteEvent(testEventUid);
      assert.equal(result.status, "deleted");
    });
  });

  await describe("Tasks", async () => {
    await test("list tasks", async () => {
      const result = await CalDAV.getTodos();
      assert.ok(Array.isArray(result));
    });

    await test("create task", async () => {
      const result = await CalDAV.createTask(
        `Test Task ${timestamp}`,
        null,
        null,
        null,
        "Test task description",
      );
      assert.equal(result.status, "created");
      testTaskUid = result.uid;
    });

    await test("complete task", async () => {
      if (!testTaskUid) return;
      const result = await CalDAV.completeTask(testTaskUid);
      assert.equal(result.status, "completed");
    });

    await test("delete task", async () => {
      if (!testTaskUid) return;
      const result = await CalDAV.deleteTask(testTaskUid);
      assert.equal(result.status, "deleted");
    });
  });

  await describe("Contacts", async () => {
    await test("list address books", async () => {
      const result = await Contacts.findAddressBooks();
      assert.ok(Array.isArray(result));
    });

    await test("create contact", async () => {
      const result = await Contacts.create(`Test Contact ${timestamp}`, null, {
        email: `test${timestamp}@example.com`,
        phone: "+1234567890",
        organization: "Test Corp",
        title: "Tester",
      });
      assert.equal(result.status, "created");
      testContactUid = result.uid;
    });

    await test("get contact", async () => {
      if (!testContactUid) return;
      const result = await Contacts.get(testContactUid);
      assert.ok(result.fullName.includes(`Test Contact ${timestamp}`));
    });

    await test("search contact", async () => {
      const result = await Contacts.search(`Test Contact ${timestamp}`);
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
    });

    await test("delete contact", async () => {
      if (!testContactUid) return;
      const result = await Contacts.delete(testContactUid);
      assert.equal(result.status, "deleted");
    });
  });

  await describe("Talk", async () => {
    await test("list conversations", async () => {
      const result = await Talk.listConversations();
      assert.ok(Array.isArray(result));
    });

    await test("create conversation", async () => {
      const result = await Talk.createConversation(
        `Test Room ${timestamp}`,
        "group",
      );
      assert.ok(result.token);
      testRoomToken = result.token;
    });

    await test("get conversation", async () => {
      if (!testRoomToken) return;
      const result = await Talk.getConversation(testRoomToken);
      assert.equal(result.name, `Test Room ${timestamp}`);
    });

    await test("send message", async () => {
      if (!testRoomToken) return;
      const result = await Talk.sendMessage(
        testRoomToken,
        "Hello from test suite!",
      );
      assert.ok(result);
    });

    await test("get conversation settings", async () => {
      if (!testRoomToken) return;
      const result = await Talk.getSettings(testRoomToken);
      assert.ok(result);
      assert.ok(result.token === testRoomToken);
    });

    await test("update settings - notification level", async () => {
      if (!testRoomToken) return;
      const result = await Talk.updateSettings(testRoomToken, {
        notificationLevel: "1",
      });
      assert.ok(Array.isArray(result));
    });

    await test("update settings - read only", async () => {
      if (!testRoomToken) return;
      const result = await Talk.updateSettings(testRoomToken, {
        readOnly: "1",
      });
      assert.ok(Array.isArray(result));
    });

    await test("update settings - favorite", async () => {
      if (!testRoomToken) return;
      const result = await Talk.updateSettings(testRoomToken, {
        favorite: "1",
      });
      assert.ok(Array.isArray(result));
    });

    await test("update settings - listable (open conversation)", async () => {
      if (!testRoomToken) return;
      const result = await Talk.updateSettings(testRoomToken, {
        listable: "1",
      });
      assert.ok(Array.isArray(result));
    });

    await test("update settings - listable (open conversation)", async () => {
      if (!testRoomToken) return;
      const result = await Talk.updateSettings(testRoomToken, {
        listable: "1",
      });
      assert.ok(Array.isArray(result));
    });

    await test("update settings - default permissions", async () => {
      if (!testRoomToken) return;
      const result = await Talk.updateSettings(testRoomToken, {
        defaultPermissions: "128", // Post chat message
      });
      assert.ok(Array.isArray(result));
    });

    await test("update settings - public (guest join)", async () => {
      if (!testRoomToken) return;
      const result = await Talk.updateSettings(testRoomToken, {
        public: "1",
      });
      assert.ok(Array.isArray(result));
    });

    await test("list messages", async () => {
      if (!testRoomToken) return;
      const result = await Talk.listMessages(testRoomToken, { limit: 10 });
      assert.ok(Array.isArray(result));
    });

    await test("delete conversation", async () => {
      if (!testRoomToken) return;
      const result = await Talk.deleteConversation(testRoomToken);
      assert.equal(result.status, "deleted");
    });
  });

  await describe("Shares", async () => {
    await test("list shares", async () => {
      const result = await Shares.list();
      assert.ok(Array.isArray(result));
    });
  });
});
