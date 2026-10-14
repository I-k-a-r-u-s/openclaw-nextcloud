import { test, describe } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// Import config to trigger .env loading before credential check
await import("../../src/config.js");

const hasCredentials =
  process.env.NEXTCLOUD_URL &&
  process.env.NEXTCLOUD_USER &&
  process.env.NEXTCLOUD_TOKEN;

// Skip all CLI tests if credentials are not available
test("CLI Integration Tests", { skip: !hasCredentials }, async () => {
  const timestamp = Date.now();
  const scriptPath = join(process.cwd(), "scripts", "nextcloud.js");
  let testRoomToken = null;

  // Create a test room first
  const createRoomCmd = `node ${scriptPath} talk create --name "CLI Test Room ${timestamp}" --type group`;
  const createResult = JSON.parse(execSync(createRoomCmd).toString());
  assert.ok(createResult.status === "success");
  testRoomToken = createResult.data.token;

  await describe("Talk CLI Commands", async () => {
    await test("talk get-settings", async () => {
      const cmd = `node ${scriptPath} talk get-settings --token ${testRoomToken}`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
      assert.equal(result.data.token, testRoomToken);
    });

    await test("talk update-settings --notification-level", async () => {
      const cmd = `node ${scriptPath} talk update-settings --token ${testRoomToken} --notification-level 1`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
    });

    await test("talk update-settings --read-only", async () => {
      const cmd = `node ${scriptPath} talk update-settings --token ${testRoomToken} --read-only 1`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
    });

    await test("talk update-settings --favorite", async () => {
      const cmd = `node ${scriptPath} talk update-settings --token ${testRoomToken} --favorite 1`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
    });

    await test("talk update-settings --listable (open conversation)", async () => {
      const cmd = `node ${scriptPath} talk update-settings --token ${testRoomToken} --listable 1`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
    });

    await test("talk update-settings --default-permissions", async () => {
      const cmd = `node ${scriptPath} talk update-settings --token ${testRoomToken} --default-permissions 128`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
    });

    await test("talk update-settings --public (guest join)", async () => {
      const cmd = `node ${scriptPath} talk update-settings --token ${testRoomToken} --public 1`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
    });
  });

  await describe("Talk participants, polls & avatars", async () => {
    // The settings tests above left the room read-only and public; both
    // block poll creation (403), so restore writable state first.
    await test("preflight: clear read-only and public flags", async () => {
      const cmd = `node ${scriptPath} talk update-settings --token ${testRoomToken} --read-only 0 --public 0`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
    });

    await test("talk participants lists the room creator", async () => {
      const cmd = `node ${scriptPath} talk participants --token ${testRoomToken}`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
      assert.ok(Array.isArray(result.data));
      assert.ok(
        result.data.some((p) => p.actorId === process.env.NEXTCLOUD_USER),
      );
    });

    let pollId = null;

    await test("talk create-poll", async () => {
      const cmd = `node ${scriptPath} talk create-poll --token ${testRoomToken} --question "Favorite color ${timestamp}" --options "Red,Blue"`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
      pollId = result.data.id;
      assert.ok(pollId);
      assert.equal(result.data.question, `Favorite color ${timestamp}`);
      assert.equal(result.data.options.length, 2);
    });

    await test("talk vote-poll is reflected in get-poll", async () => {
      const voteCmd = `node ${scriptPath} talk vote-poll --token ${testRoomToken} --poll-id ${pollId} --option-ids 1`;
      const voteResult = JSON.parse(execSync(voteCmd).toString());
      assert.ok(voteResult.status === "success");

      const getCmd = `node ${scriptPath} talk get-poll --token ${testRoomToken} --poll-id ${pollId}`;
      const poll = JSON.parse(execSync(getCmd).toString()).data;
      assert.ok(sumVotes(poll) >= 1, `expected a vote, got: ${JSON.stringify(poll).slice(0, 400)}`);
    });

    await test("talk unvote-poll clears the vote", async () => {
      const cmd = `node ${scriptPath} talk unvote-poll --token ${testRoomToken} --poll-id ${pollId}`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");

      const getCmd = `node ${scriptPath} talk get-poll --token ${testRoomToken} --poll-id ${pollId}`;
      const poll = JSON.parse(execSync(getCmd).toString()).data;
      assert.equal(sumVotes(poll), 0);
    });

    await test("talk close-poll", async () => {
      const cmd = `node ${scriptPath} talk close-poll --token ${testRoomToken} --poll-id ${pollId}`;
      const result = JSON.parse(execSync(cmd).toString());
      assert.ok(result.status === "success");
      assert.equal(result.data.status, "closed");
    });

    await test("conversation avatar set/get/delete roundtrip", async () => {
      const dir = mkdtempSync(join(tmpdir(), "nc-avatar-test-"));
      try {
        const pngPath = join(dir, "avatar.png");
        writeFileSync(
          pngPath,
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64",
          ),
        );

        const setCmd = `node ${scriptPath} talk set-avatar --token ${testRoomToken} --file ${pngPath}`;
        const setResult = JSON.parse(execSync(setCmd).toString());
        assert.ok(setResult.status === "success");

        const dlPath = join(dir, "avatar-dl.png");
        const getCmd = `node ${scriptPath} talk get-avatar --token ${testRoomToken} --output ${dlPath}`;
        const getResult = JSON.parse(execSync(getCmd).toString());
        assert.ok(getResult.status === "success");
        // Server re-encodes avatars, so verify it is a PNG of the same
        // 1x1 dimensions rather than comparing bytes.
        const buf = readFileSync(dlPath);
        assert.equal(
          buf.slice(0, 8).toString("hex"),
          "89504e470d0a1a0a",
          "downloaded avatar is not a PNG",
        );
        assert.equal(buf.readUInt32BE(16), 1);
        assert.equal(buf.readUInt32BE(20), 1);

        const delCmd = `node ${scriptPath} talk delete-avatar --token ${testRoomToken}`;
        const delResult = JSON.parse(execSync(delCmd).toString());
        assert.ok(delResult.status === "success");

        // Servers report "no custom avatar" either as 404 or by serving the
        // generated SVG placeholder (200 + fallback flag).
        const getAfter = JSON.parse(execSync(getCmd).toString()).data;
        assert.ok(
          getAfter.error || getAfter.fallback,
          "expected fallback/404 avatar after delete",
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // Cleanup: delete the test room
  const deleteCmd = `node ${scriptPath} talk delete --token ${testRoomToken}`;
  execSync(deleteCmd);
});

// showPoll exposes tallies as voteCounts (array), votes (optionId -> count)
// or votes (optionId -> voter list) depending on server version; sum
// whatever is present.
function sumVotes(poll) {
  if (Array.isArray(poll.voteCounts))
    return poll.voteCounts.reduce((a, b) => a + b, 0);
  if (poll.votes && typeof poll.votes === "object") {
    return Object.values(poll.votes).reduce(
      (a, v) =>
        a + (Array.isArray(v) ? v.length : typeof v === "number" ? v : 0),
      0,
    );
  }
  return 0;
}
