import { test } from "node:test";
import assert from "node:assert";

// Set dummy env vars before importing request module
process.env.NEXTCLOUD_URL = "https://example.com";
process.env.NEXTCLOUD_USER = "testuser";
process.env.NEXTCLOUD_TOKEN = "testtoken";

const { request } = await import("../../src/request.js");

test("request parses JSON response", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h === "content-type" ? "application/json" : null),
      },
      text: async () => '{"status":"ok"}',
      json: async () => ({ status: "ok" }),
    };
  };

  const result = await request("/test");
  assert.deepStrictEqual(result, { status: "ok" });

  global.fetch = originalFetch;
});

test("request parses XML response", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) =>
          h === "content-type" ? "application/xml; charset=utf-8" : null,
      },
      text: async () =>
        '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/test</d:href></d:response></d:multistatus>',
    };
  };

  const result = await request("/test");
  assert.equal(result["d:multistatus"]["d:response"]["d:href"], "/test");

  global.fetch = originalFetch;
});

test("request returns text for unknown content type", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h === "content-type" ? "text/plain" : null),
      },
      text: async () => "plain text response",
    };
  };

  const result = await request("/test");
  assert.equal(result, "plain text response");

  global.fetch = originalFetch;
});

test("request throws on HTTP error with status and responseBody", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: {
        get: () => null,
      },
      text: async () => "Resource not found",
    };
  };

  try {
    await request("/test");
    assert.fail("Expected error");
  } catch (e) {
    assert.equal(e.status, 404);
    assert.match(e.message, /HTTP 404/);
    assert.ok(e.responseBody.includes("Resource not found"));
  }

  global.fetch = originalFetch;
});

test("request includes Authorization and User-Agent headers", async () => {
  const originalFetch = global.fetch;
  let capturedHeaders;
  global.fetch = async (url, options) => {
    capturedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h === "content-type" ? "application/json" : null),
      },
      text: async () => "{}",
      json: async () => ({}),
    };
  };

  await request("/test");
  assert.ok(capturedHeaders.Authorization.startsWith("Basic "));
  assert.equal(capturedHeaders["User-Agent"], "OpenClaw-Nextcloud-Skill");

  global.fetch = originalFetch;
});

test("request includes OCS-APIRequest for OCS endpoints", async () => {
  const originalFetch = global.fetch;
  let capturedHeaders;
  global.fetch = async (url, options) => {
    capturedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h === "content-type" ? "application/json" : null),
      },
      text: async () => '{"ocs":{"meta":{"status":"ok"},"data":{}}}',
      json: async () => ({ ocs: { meta: { status: "ok" }, data: {} } }),
    };
  };

  await request("/ocs/v2.php/apps/test");
  assert.equal(capturedHeaders["OCS-APIRequest"], "true");

  global.fetch = originalFetch;
});
