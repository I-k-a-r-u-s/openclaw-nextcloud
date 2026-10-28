import { test, describe } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { join } from "node:path";

// Import config to trigger .env loading before credential check
await import("../../src/config.js");

const hasCredentials =
  process.env.NEXTCLOUD_URL &&
  process.env.NEXTCLOUD_USER &&
  process.env.NEXTCLOUD_TOKEN;

// Deck must exist on the server; capabilities checked in the first test.
test("Deck CLI Integration Tests", { skip: !hasCredentials }, async () => {
  const timestamp = Date.now();
  const scriptPath = join(process.cwd(), "scripts", "nextcloud.js");
  const boardTitle = `CLI Deck Test ${timestamp}`;
  let boardId = null;
  let cardId = null;
  let labelId = null;

  const cli = (args) =>
    JSON.parse(execSync(`node ${scriptPath} ${args}`).toString());

  // Server normalizes ISO-8601 to a +00:00 suffix; compare instants, not strings.
  const sameInstant = (a, b) => new Date(a).getTime() === new Date(b).getTime();

  await describe("Deck boards & stacks", async () => {
    await test("deck create-board", async () => {
      const result = cli(
        `deck create-board --title "${boardTitle}" --color 00aa00`,
      );
      assert.equal(result.status, "success");
      boardId = result.data.id;
      assert.ok(boardId);
      assert.equal(result.data.color, "00aa00");
    });

    await test("deck boards lists the new board", async () => {
      const result = cli("deck boards");
      assert.equal(result.status, "success");
      assert.ok(result.data.some((b) => b.id === boardId));
    });

    await test("deck board resolves by title", async () => {
      const result = cli(`deck board --board "${boardTitle}"`);
      assert.equal(result.status, "success");
      assert.equal(result.data.id, boardId);
    });

    await test("deck create-stack / stacks", async () => {
      const created = cli(
        `deck create-stack --board ${boardId} --title "To Do" --order 99`,
      );
      assert.equal(created.status, "success");
      const listed = cli(`deck stacks --board ${boardId}`);
      assert.ok(listed.data.some((s) => s.id === created.data.id));
      // second stack as move target
      const second = cli(
        `deck create-stack --board ${boardId} --title "Later" --order 199`,
      );
      assert.equal(second.status, "success");
    });

    await test("unknown board yields structured error listing options", async () => {
      let err;
      try {
        execSync(
          `node ${scriptPath} deck board --board "zz no such board"`,
          { stdio: ["ignore", "pipe", "pipe"] },
        );
      } catch (e) {
        err = e;
      }
      assert.ok(err, "expected non-zero exit");
      const payload = JSON.parse(err.stderr.toString());
      assert.equal(payload.status, "error");
      assert.match(payload.message, /not found\. Available/);
    });
  });

  await describe("Deck cards", async () => {
    await test("deck create + list", async () => {
      const created = cli(
        `deck create --board ${boardId} --stack "To Do" --title "Integration card" --content "body" --due 2099-01-01`,
      );
      assert.equal(created.status, "success");
      cardId = created.data.id;
      assert.ok(sameInstant(created.data.duedate, "2099-01-01T00:00:00Z"));

      const listed = cli(`deck list --board ${boardId} --stack "To Do"`);
      assert.ok(
        listed.data[0].cards.some((c) => c.id === cardId),
        "card should appear in stack listing",
      );
    });

    await test("deck edit merges fields (title changes, due survives, then clears)", async () => {
      const edited = cli(
        `deck edit --board ${boardId} --card ${cardId} --title "Integration card v2"`,
      );
      assert.equal(edited.data.title, "Integration card v2");
      assert.ok(
        sameInstant(edited.data.duedate, "2099-01-01T00:00:00Z"),
        "untouched duedate must survive a title-only edit",
      );

      const cleared = cli(
        `deck edit --board ${boardId} --card ${cardId} --due none`,
      );
      assert.equal(cleared.data.duedate, null);
    });

    await test("deck label create/assign/unassign", async () => {
      const label = cli(
        `deck create-label --board ${boardId} --title "int-label" --color ff8800`,
      );
      assert.equal(label.status, "success");
      labelId = label.data.id;

      const assigned = cli(
        `deck assign-label --board ${boardId} --card ${cardId} --label int-label`,
      );
      assert.ok(assigned.data.labels.includes("int-label"));

      const unassigned = cli(
        `deck unassign-label --board ${boardId} --card ${cardId} --label ${labelId}`,
      );
      assert.deepEqual(unassigned.data.labels, []);
    });

    await test("deck assign/unassign user", async () => {
      const user = process.env.NEXTCLOUD_USER;
      const assigned = cli(
        `deck assign --board ${boardId} --card ${cardId} --user ${user}`,
      );
      assert.ok(assigned.data.assignedUsers.includes(user));

      const unassigned = cli(
        `deck unassign --board ${boardId} --card ${cardId} --user ${user}`,
      );
      assert.deepEqual(unassigned.data.assignedUsers, []);
    });

    await test("deck move between stacks", async () => {
      const moved = cli(
        `deck move --board ${boardId} --card ${cardId} --to-stack "Later"`,
      );
      assert.equal(moved.status, "success");
      assert.equal(moved.data.title, "Integration card v2");

      const listed = cli(`deck list --board ${boardId} --stack "Later"`);
      assert.ok(
        listed.data[0].cards.some((c) => c.id === cardId),
        "card should be in the target stack after move",
      );
    });

    await test("deck complete/uncomplete", async () => {
      const done = cli(`deck complete --card ${cardId}`);
      assert.ok(done.data.done, "done timestamp expected");
      const undone = cli(`deck uncomplete --card ${cardId}`);
      assert.equal(undone.data.done, null);
    });

    await test("deck archive/unarchive", async () => {
      const archived = cli(`deck archive --card ${cardId}`);
      assert.equal(archived.data.archived, true);
      const restored = cli(`deck unarchive --card ${cardId}`);
      assert.equal(restored.data.archived, false);
    });

    await test("deck delete removes card from listing", async () => {
      const deleted = cli(`deck delete --board ${boardId} --card ${cardId}`);
      assert.equal(deleted.data.status, "deleted");
      const listed = cli(`deck list --board ${boardId}`);
      const ids = listed.data.flatMap((s) => s.cards.map((c) => c.id));
      assert.ok(!ids.includes(cardId));
    });
  });

  await describe("Deck board lifecycle & cleanup", async () => {
    await test("delete-board then undo-delete-board restores it", async () => {
      const deleted = cli(`deck delete-board --board ${boardId}`);
      assert.equal(deleted.data.status, "deleted");
      const restored = cli(`deck undo-delete-board --board ${boardId}`);
      assert.equal(restored.data.status, "restored");
    });

    await test("cleanup: delete board", async () => {
      const deleted = cli(`deck delete-board --board ${boardId}`);
      assert.equal(deleted.data.status, "deleted");
      const listed = cli("deck boards");
      assert.ok(!listed.data.some((b) => b.id === boardId));
    });
  });
});
