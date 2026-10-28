import { test } from "node:test";
import assert from "node:assert";

// Set dummy env vars before importing Deck
process.env.NEXTCLOUD_URL = "https://example.com";
process.env.NEXTCLOUD_USER = "test";
process.env.NEXTCLOUD_TOKEN = "test";

const { Deck } = await import("../../src/deck.js");

test("_normalizeColor accepts hex with or without #", () => {
  assert.equal(Deck._normalizeColor("ff0000"), "ff0000");
  assert.equal(Deck._normalizeColor("#FF0000"), "ff0000");
});

test("_normalizeColor returns fallback for empty values", () => {
  assert.equal(Deck._normalizeColor(undefined), "0082c9");
  assert.equal(Deck._normalizeColor(""), "0082c9");
  assert.equal(Deck._normalizeColor(null, "abc123"), "abc123");
});

test("_normalizeColor rejects non-hex colors", () => {
  assert.throws(() => Deck._normalizeColor("teal"), /Invalid color/);
  assert.throws(() => Deck._normalizeColor("#FFF"), /Invalid color/);
});

test("_toDeckIso converts dates and clears on none", () => {
  assert.equal(Deck._toDeckIso("2026-11-05T09:00:00Z"), "2026-11-05T09:00:00.000Z");
  assert.equal(Deck._toDeckIso("2026-11-05"), new Date("2026-11-05").toISOString());
  assert.equal(Deck._toDeckIso("none"), null);
  assert.equal(Deck._toDeckIso("clear"), null);
  assert.equal(Deck._toDeckIso(""), null);
  assert.equal(Deck._toDeckIso(undefined), undefined);
});

test("_toDeckIso rejects garbage", () => {
  assert.throws(() => Deck._toDeckIso("sometime"), /Invalid date/);
});

const items = [
  { id: 1, title: "Backlog" },
  { id: 2, title: "In Progress" },
  { id: 3, title: "Done" },
];

test("_resolveEntity resolves by id, exact name, unique substring", () => {
  assert.equal(Deck._resolveEntity(items, "2", "Stack").title, "In Progress");
  assert.equal(Deck._resolveEntity(items, "done", "Stack").id, 3);
  assert.equal(Deck._resolveEntity(items, "progress", "Stack").id, 2);
});

test("_resolveEntity errors list available options", () => {
  assert.throws(
    () => Deck._resolveEntity(items, "99", "Stack"),
    /Stack '99' not found\. Available: 1 "Backlog", 2 "In Progress", 3 "Done"/,
  );
  assert.throws(
    () => Deck._resolveEntity(items, "unknown", "Stack"),
    /not found\. Available/,
  );
});

test("_resolveEntity rejects ambiguous substring matches", () => {
  const dup = [
    { id: 1, title: "Review PRs" },
    { id: 2, title: "Review Docs" },
  ];
  assert.throws(
    () => Deck._resolveEntity(dup, "review", "Stack"),
    /matches multiple Stacks/,
  );
});

test("_resolveEntity handles empty list and empty ref", () => {
  assert.throws(() => Deck._resolveEntity([], "x", "Board"), /Available: \(none\)/);
  assert.throws(() => Deck._resolveEntity(items, "", "Stack"), /not found/);
});

test("_cardSummary flattens labels and assigned users", () => {
  const card = {
    id: 7,
    title: "T",
    stackId: 3,
    order: 5,
    duedate: "2026-11-01T00:00:00+00:00",
    overdue: 1,
    done: null,
    archived: false,
    labels: [
      { id: 1, title: "urgent", color: "ff0000" },
      { id: 2, title: "docs", color: "00ff00" },
    ],
    assignedUsers: [
      { participant: { uid: "alice", displayname: "Alice" } },
      { participant: { uid: "bob" } },
    ],
  };
  const s = Deck._cardSummary(card);
  assert.equal(s.id, 7);
  assert.deepEqual(s.labels, ["urgent", "docs"]);
  assert.deepEqual(s.assignedUsers, ["alice", "bob"]);
  assert.equal(s.overdue, 1);
});

test("_cardSummary tolerates missing relations", () => {
  const s = Deck._cardSummary({ id: 1, title: "X", stackId: 1, order: 0 });
  assert.deepEqual(s.labels, []);
  assert.deepEqual(s.assignedUsers, []);
});
