import { test } from "node:test";
import assert from "node:assert";

// Set dummy env vars before importing CalDAV
process.env.NEXTCLOUD_URL = "https://example.com";
process.env.NEXTCLOUD_USER = "test";
process.env.NEXTCLOUD_TOKEN = "test";

const { CalDAV } = await import("../../src/caldav.js");

test("_updateProperty updates existing property", () => {
  const vcal = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Old Title\nEND:VEVENT\nEND:VCALENDAR";
  const updated = CalDAV._updateProperty(vcal, "SUMMARY", "New Title");
  assert.match(updated, /SUMMARY:New Title/);
  assert.doesNotMatch(updated, /SUMMARY:Old Title/);
});

test("_updateProperty inserts new property before END:VEVENT", () => {
  const vcal = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:123\nEND:VEVENT\nEND:VCALENDAR";
  const updated = CalDAV._updateProperty(vcal, "LOCATION", "Berlin");
  assert.match(updated, /LOCATION:Berlin/);
  assert.match(updated, /END:VEVENT/);
});

test("_updateProperty preserves property parameters", () => {
  const vcal = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDUE;TZID=Europe/London:20260415T170000Z\nEND:VEVENT\nEND:VCALENDAR";
  const updated = CalDAV._updateProperty(vcal, "DUE", "20260416T170000Z");
  assert.match(updated, /DUE;TZID=Europe\/London:20260416T170000Z/);
});

test("_updateProperty escapes iCalendar values", () => {
  const vcal = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Old\nEND:VEVENT\nEND:VCALENDAR";
  const updated = CalDAV._updateProperty(vcal, "SUMMARY", "Line\nBreak");
  assert.match(updated, /SUMMARY:Line\\nBreak/);
});

test("_updateProperty returns unchanged when value is null", () => {
  const vcal = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Old\nEND:VEVENT\nEND:VCALENDAR";
  const updated = CalDAV._updateProperty(vcal, "SUMMARY", null);
  assert.equal(updated, vcal);
});
