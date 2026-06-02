import { test } from "node:test";
import assert from "node:assert";
import {
  parseDateInput,
  xmlEscape,
  icalEscape,
  vcardEscape,
  ensureArray,
  matchByName,
  formatCalDavDate,
} from "../../src/utils.js";

test("parseDateInput parses ISO 8601 dates", () => {
  const d = parseDateInput("2026-04-15T17:00:00Z");
  assert.equal(d.toISOString(), "2026-04-15T17:00:00.000Z");
});

test("parseDateInput parses compact CalDAV dates", () => {
  const d = parseDateInput("20260415T170000Z");
  assert.equal(d.toISOString(), "2026-04-15T17:00:00.000Z");
});

test("parseDateInput rejects invalid month in compact format", () => {
  assert.throws(
    () => parseDateInput("20261315T170000Z"),
    /Invalid date/,
  );
});

test("parseDateInput rejects invalid day in compact format", () => {
  assert.throws(
    () => parseDateInput("20260432T170000Z"),
    /Invalid date/,
  );
});

test("parseDateInput rejects garbage input", () => {
  assert.throws(() => parseDateInput("not-a-date"), /Invalid date/);
});

test("xmlEscape escapes XML metacharacters", () => {
  assert.equal(
    xmlEscape("<script>alert('XSS')</script>"),
    "&lt;script&gt;alert(&apos;XSS&apos;)&lt;/script&gt;",
  );
  assert.equal(xmlEscape("a & b"), "a &amp; b");
  assert.equal(xmlEscape('"quoted"'), "&quot;quoted&quot;");
});

test("icalEscape escapes iCalendar special characters", () => {
  assert.equal(icalEscape("line1\nline2"), "line1\\nline2");
  assert.equal(icalEscape("a; b"), "a\\; b");
  assert.equal(icalEscape("a, b"), "a\\, b");
  assert.equal(icalEscape("a \\ b"), "a \\\\ b");
});

test("vcardEscape escapes vCard special characters", () => {
  assert.equal(vcardEscape("line1\nline2"), "line1\\nline2");
  assert.equal(vcardEscape("a; b"), "a\\; b");
  assert.equal(vcardEscape("a, b"), "a\\, b");
});

test("ensureArray handles various inputs", () => {
  assert.deepStrictEqual(ensureArray([1, 2]), [1, 2]);
  assert.deepStrictEqual(ensureArray(null), []);
  assert.deepStrictEqual(ensureArray(undefined), []);
  assert.deepStrictEqual(ensureArray("single"), ["single"]);
});

test("matchByName finds exact match", () => {
  const items = [{ displayname: "Work", url: "/cal/work/" }];
  assert.equal(matchByName(items, "Work").displayname, "Work");
});

test("matchByName finds case-insensitive match", () => {
  const items = [{ displayname: "Work", url: "/cal/work/" }];
  assert.equal(matchByName(items, "work").displayname, "Work");
});

test("matchByName finds slug match", () => {
  const items = [{ displayname: "Personal", url: "/cal/personal/" }];
  assert.equal(matchByName(items, "personal").displayname, "Personal");
});

test("formatCalDavDate produces compact UTC format", () => {
  const d = new Date("2026-04-15T17:00:00.000Z");
  assert.equal(formatCalDavDate(d), "20260415T170000Z");
});
