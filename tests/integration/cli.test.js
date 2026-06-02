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

// Skip all CLI tests if credentials are not available
test("CLI Integration Tests", { skip: !hasCredentials }, async () => {
  const timestamp = Date.now();
  const scriptPath = join(process.cwd(), "scripts", "nextcloud.js");
  let testRoomToken = null;

  // Create a test room first
  const createRoomCmd = `node ${scriptPath} talk create "CLI Test Room ${timestamp}" --type group`;
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

  // Cleanup: delete the test room
  const deleteCmd = `node ${scriptPath} talk delete --token ${testRoomToken}`;
  execSync(deleteCmd);
});
