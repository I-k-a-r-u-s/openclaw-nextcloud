import { test } from "node:test";
import assert from "node:assert";

// Set dummy env vars before importing Contacts
process.env.NEXTCLOUD_URL = "https://example.com";
process.env.NEXTCLOUD_USER = "test";
process.env.NEXTCLOUD_TOKEN = "test";

const { Contacts } = await import("../../src/contacts.js");

test("_parseVCard extracts all fields from a sample vCard", () => {
  const vcard = `BEGIN:VCARD
VERSION:3.0
UID:abc-123
FN:John Doe
N:Doe;John;;;
EMAIL;TYPE=WORK:john@example.com
EMAIL;TYPE=HOME:john.home@example.com
TEL;TYPE=WORK:+1234567890
TEL;TYPE=HOME:+0987654321
ADR;TYPE=WORK:;;123 Main St;Springfield;IL;62701;USA
ORG:Acme Corp
TITLE:Engineer
URL:https://example.com
ROLE:Developer
BDAY:1990-05-15
ANNIVERSARY:2015-06-20
NOTE:A note
END:VCARD`;

  const contact = Contacts._parseVCard(vcard);
  assert.equal(contact.uid, "abc-123");
  assert.equal(contact.fullName, "John Doe");
  assert.equal(contact.name, "Doe;John;;;");
  assert.equal(contact.organization, "Acme Corp");
  assert.equal(contact.title, "Engineer");
  assert.equal(contact.url, "https://example.com");
  assert.equal(contact.role, "Developer");
  assert.equal(contact.bday, "1990-05-15");
  assert.equal(contact.anniversary, "2015-06-20");
  assert.equal(contact.note, "A note");

  assert.equal(contact.emails.length, 2);
  assert.equal(contact.emails[0].value, "john@example.com");
  assert.ok(contact.emails[0].types.includes("TYPE=WORK"));

  assert.equal(contact.phones.length, 2);
  assert.equal(contact.phones[0].value, "+1234567890");

  assert.equal(contact.addresses.length, 1);
  assert.equal(contact.addresses[0].street, "123 Main St");
  assert.equal(contact.addresses[0].city, "Springfield");
  assert.equal(contact.addresses[0].region, "IL");
  assert.equal(contact.addresses[0].postalCode, "62701");
  assert.equal(contact.addresses[0].country, "USA");
});

test("_updateVCardField updates existing field preserving TYPE params", () => {
  const vcard =
    "BEGIN:VCARD\nVERSION:3.0\nEMAIL;TYPE=WORK:old@example.com\nEND:VCARD";
  const updated = Contacts._updateVCardField(vcard, "EMAIL", "new@example.com");
  assert.match(updated, /EMAIL;TYPE=WORK:new@example\.com/);
});

test("_updateVCardField inserts new field before END:VCARD", () => {
  const vcard = "BEGIN:VCARD\nVERSION:3.0\nFN:John\nEND:VCARD";
  const updated = Contacts._updateVCardField(vcard, "ORG", "Acme");
  assert.match(updated, /ORG:Acme/);
  assert.match(updated, /END:VCARD/);
});

test("_updateVCardField escapes vCard values", () => {
  const vcard = "BEGIN:VCARD\nVERSION:3.0\nFN:Old\nEND:VCARD";
  const updated = Contacts._updateVCardField(vcard, "NOTE", "Line\nBreak");
  assert.match(updated, /NOTE:Line\\nBreak/);
});

test("_foldVCardLine leaves short lines untouched", () => {
  const line = "A".repeat(74);
  assert.equal(Contacts._foldVCardLine(line), line);
});

test("_foldVCardLine folds long lines with leading-space continuations", () => {
  const original = "PHOTO;ENCODING=BASE64;TYPE=PNG:" + "A".repeat(200);
  const folded = Contacts._foldVCardLine(original);
  const lines = folded.split("\n");
  assert.ok(lines.length > 1);
  for (const line of lines) {
    assert.ok(line.length <= 75, `folded line too long: ${line.length}`);
  }
  for (const line of lines.slice(1)) {
    assert.ok(line.startsWith(" "));
  }
  // Unfolding must restore the exact original value.
  assert.equal(folded.replace(/\r?\n[ \t]/g, ""), original);
});

test("_removeVCardField removes folded PHOTO (LF and CRLF)", () => {
  const lf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:John",
    "PHOTO;ENCODING=BASE64;TYPE=PNG:AAAA",
    " BBBB",
    "END:VCARD",
  ].join("\n");
  const removedLF = Contacts._removeVCardField(lf, "PHOTO");
  assert.ok(!removedLF.includes("PHOTO"));
  assert.ok(!removedLF.includes("BBBB"));
  assert.match(removedLF, /FN:John/);
  assert.match(removedLF, /END:VCARD/);

  const crlf = lf.replace(/\n/g, "\r\n");
  const removedCRLF = Contacts._removeVCardField(crlf, "PHOTO");
  assert.ok(!removedCRLF.includes("PHOTO"));
  assert.ok(!removedCRLF.includes("BBBB"));
});

test("_parseVCard detects photo with v3 TYPE param", () => {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "UID:x-1",
    "FN:John",
    "PHOTO;ENCODING=B;TYPE=PNG:iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
    " AAAAD",
    "END:VCARD",
  ].join("\r\n");
  const contact = Contacts._parseVCard(vcard);
  assert.equal(contact.hasPhoto, true);
  assert.equal(contact.photoMime, "image/png");
});

test("_parseVCard detects photo with v4 data-URI", () => {
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    "UID:x-2",
    "FN:Jane",
    "PHOTO:data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
    "END:VCARD",
  ].join("\r\n");
  const contact = Contacts._parseVCard(vcard);
  assert.equal(contact.hasPhoto, true);
  assert.equal(contact.photoMime, "image/jpeg");
});

test("_parseVCard without photo reports hasPhoto false", () => {
  const vcard = "BEGIN:VCARD\nVERSION:3.0\nUID:x-3\nFN:No Photo\nEND:VCARD";
  const contact = Contacts._parseVCard(vcard);
  assert.equal(contact.hasPhoto, false);
  assert.equal(contact.photoMime, null);
});
