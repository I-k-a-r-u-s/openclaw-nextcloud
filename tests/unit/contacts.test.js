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
