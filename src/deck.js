import { request } from "./request.js";
import { parseDateInput } from "./utils.js";

const API = "/index.php/apps/deck/api/v1.0";
// Card done/undone exist only on Deck's internal (non-/api) routes; they
// accept app-password Basic auth just like the API routes (verified live).
const INTERNAL = "/index.php/apps/deck";

// Deck colors are 6-char hex without leading '#'.
function normalizeColor(color, fallback = "0082c9") {
  if (color === undefined || color === null || color === "") return fallback;
  const hex = String(color).trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(
      `Invalid color '${color}'. Use a 6-digit hex value like ff0000 or #ff0000.`,
    );
  }
  return hex.toLowerCase();
}

// Deck wants ISO-8601 dates in/out; "none"/"clear" unsets the due date.
function toDeckIso(value) {
  if (value === undefined) return undefined;
  if (["", "none", "null", "clear"].includes(String(value).toLowerCase()))
    return null;
  return new Date(parseDateInput(value)).toISOString();
}

// Resolve a "<id-or-name>" reference against entities with id/title fields
// (boards, stacks, labels). Numeric refs must exist; name refs must match
// exactly (case-insensitive) or uniquely as substring.
function resolveEntity(items, ref, kind) {
  const asNum = /^\d+$/.test(String(ref)) ? parseInt(ref, 10) : null;
  if (asNum !== null) {
    const byId = items.find((i) => i.id === asNum);
    if (byId) return byId;
  } else if (ref !== undefined && ref !== null && ref !== "") {
    const lower = String(ref).toLowerCase();
    const exact = items.find((i) => (i.title || "").toLowerCase() === lower);
    if (exact) return exact;
    const partial = items.filter((i) =>
      (i.title || "").toLowerCase().includes(lower),
    );
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      throw new Error(
        `'${ref}' matches multiple ${kind}s: ${partial.map((p) => `${p.id} "${p.title}"`).join(", ")}`,
      );
    }
  }
  const available =
    items.map((i) => `${i.id} "${i.title}"`).join(", ") || "(none)";
  throw new Error(
    `${kind} '${ref}' not found. Available: ${available}`,
  );
}

function cardSummary(card) {
  return {
    id: card.id,
    title: card.title,
    stackId: card.stackId,
    order: card.order,
    duedate: card.duedate,
    overdue: card.overdue,
    done: card.done,
    archived: card.archived,
    labels: (card.labels || []).map((l) => l.title),
    assignedUsers: (card.assignedUsers || []).map(
      (u) => u.participant?.uid ?? u.uid ?? u,
    ),
  };
}

export const Deck = {
  // ---- Boards ----

  async listBoards({ details = false } = {}) {
    const boards = await request(`${API}/boards?details=${details ? "true" : "false"}`, {
      headers: { Accept: "application/json" },
    });
    // Soft-deleted (trashed) boards are still served by GET /boards but 403
    // on read; hide them from listings like the Deck UI does.
    const live = boards.filter((b) => !b.deletedAt);
    if (details) return live;
    return live.map((b) => ({
      id: b.id,
      title: b.title,
      color: b.color,
      owner: b.owner?.uid ?? b.owner,
      archived: b.archived,
      labels: (b.labels || []).length,
      shared: b.shared,
    }));
  },

  async _allBoardSummaries() {
    const boards = await request(`${API}/boards`, {
      headers: { Accept: "application/json" },
    });
    // Exclude trashed boards (see listBoards).
    return boards.filter((b) => !b.deletedAt);
  },

  async resolveBoard(ref) {
    if (ref === undefined || ref === null || ref === "")
      throw new Error("A --board (id or title) is required.");
    // Numeric ids skip the listing when it does not contain them (e.g. a
    // shared board not in "all boards"? it would be; miss => structured error).
    const boards = await this._allBoardSummaries();
    const board = resolveEntity(boards, ref, "Board");
    return board;
  },

  async getBoard(ref) {
    const board = await this.resolveBoard(ref);
    return await request(`${API}/boards/${board.id}`, {
      headers: { Accept: "application/json" },
    });
  },

  async createBoard(title, color) {
    if (!title || !title.trim()) throw new Error("--title is required.");
    return await request(
      `${API}/boards`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ title: title.trim(), color: normalizeColor(color) }),
      },
    );
  },

  // Deck's PUT is a full update (title+color required): merge with current.
  async updateBoard(ref, { title, color, archived } = {}) {
    const board = await this.resolveBoard(ref);
    const current = await request(`${API}/boards/${board.id}`, {
      headers: { Accept: "application/json" },
    });
    return await request(`${API}/boards/${board.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: title !== undefined ? title : current.title,
        color: color !== undefined ? normalizeColor(color) : current.color,
        archived:
          archived !== undefined
            ? archived === "1" || archived === "true" || archived === true
            : current.archived,
      }),
    });
  },

  async deleteBoard(ref) {
    const board = await this.resolveBoard(ref);
    const deleted = await request(`${API}/boards/${board.id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    return {
      id: deleted.id,
      title: deleted.title,
      status: "deleted",
      note: "Soft delete — recoverable via deck undo-delete-board while in trash.",
    };
  },

  async undoDeleteBoard(ref) {
    // Trashed boards are excluded from listings, so only numeric ids can be
    // undone (the id is in `deck delete-board`'s response).
    if (!/^\d+$/.test(String(ref ?? "")))
      throw new Error(
        "undo-delete-board needs the numeric board id (trashed boards are not listed).",
      );
    const restored = await request(`${API}/boards/${ref}/undo_delete`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    return { id: restored.id, title: restored.title, status: "restored" };
  },

  // ---- Stacks ----

  async listStacks(ref) {
    const board = await this.resolveBoard(ref);
    return await request(`${API}/boards/${board.id}/stacks`, {
      headers: { Accept: "application/json" },
    });
  },

  async _stacksRaw(boardId) {
    return await request(`${API}/boards/${boardId}/stacks`, {
      headers: { Accept: "application/json" },
    });
  },

  async createStack(ref, title, order = 999) {
    const board = await this.resolveBoard(ref);
    if (!title || !title.trim()) throw new Error("--title is required.");
    // Deck requires order on create; default to the end of the board.
    return await request(`${API}/boards/${board.id}/stacks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ title: title.trim(), order: parseInt(order, 10) }),
    });
  },

  async deleteStack(ref, stackRef) {
    const board = await this.resolveBoard(ref);
    const stacks = await this._stacksRaw(board.id);
    const stack = resolveEntity(stacks, stackRef, "Stack");
    const deleted = await request(`${API}/boards/${board.id}/stacks/${stack.id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    return { id: deleted.id, title: deleted.title, status: "deleted" };
  },

  // ---- Cards ----

  async listCards(ref, stackRef = null) {
    const board = await this.resolveBoard(ref);
    let stacks = await this._stacksRaw(board.id);
    if (stackRef !== null && stackRef !== undefined && stackRef !== "") {
      const stack = resolveEntity(stacks, stackRef, "Stack");
      stacks = [stack];
    }
    return stacks.map((s) => ({
      id: s.id,
      title: s.title,
      order: s.order,
      cards: (s.cards || []).filter((c) => !c.archived).map(cardSummary),
    }));
  },

  // Locate a card across the board's stacks (card ids are board-global unique).
  async _findCard(ref, cardId) {
    const board = await this.resolveBoard(ref);
    if (!cardId) throw new Error("A --card (id) is required.");
    const id = parseInt(cardId, 10);
    const stacks = await this._stacksRaw(board.id);
    for (const s of stacks) {
      const card = (s.cards || []).find((c) => c.id === id);
      if (card) return { board, stack: s, card };
      const archived = (s.archivedCards || []).find((c) => c.id === id);
      if (archived) return { board, stack: s, card: archived };
    }
    throw new Error(
      `Card ${cardId} not found in board ${board.id} "${board.title}". Use deck list --board ${board.id}.`,
    );
  },

  async getCard(ref, cardId) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    const full = await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards/${card.id}`,
      { headers: { Accept: "application/json" } },
    );
    return full;
  },

  async createCard(ref, stackRef, { title, content, due, order } = {}) {
    const board = await this.resolveBoard(ref);
    if (!title || !title.trim()) throw new Error("--title is required.");
    const stacks = await this._stacksRaw(board.id);
    let stack;
    if (stackRef === undefined || stackRef === null || stackRef === "") {
      // "find or default to first" convention (like --calendar/--addressbook)
      if (!stacks.length)
        throw new Error(
          `Board ${board.id} "${board.title}" has no stacks. Create one first: deck create-stack --board ${board.id} --title "To Do"`,
        );
      stack = stacks[0];
    } else {
      stack = resolveEntity(stacks, stackRef, "Stack");
    }
    const body = {
      title: title.trim(),
      type: "plain",
      order: order !== undefined ? parseInt(order, 10) : 999,
    };
    if (content !== undefined) body.description = content;
    const duedate = toDeckIso(due);
    if (duedate !== undefined) body.duedate = duedate;
    const card = await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    return cardSummary(card);
  },

  // Deck's card PUT resets any omitted optional field (description -> "",
  // duedate -> null) and requires title/type/owner, so send a full merge of
  // the current card state plus the requested changes.
  async updateCard(
    ref,
    cardId,
    { title, content, due, order, type, color } = {},
  ) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    if (
      [title, content, due, order, type, color].every((v) => v === undefined)
    ) {
      throw new Error(
        "Nothing to update. Provide --title, --content, --due, --order, --type or --color.",
      );
    }
    const body = {
      title: title !== undefined ? title : card.title,
      type: type !== undefined ? type : card.type || "plain",
      owner: card.owner?.uid ?? card.owner ?? undefined,
      description: content !== undefined ? content : card.description || "",
      order: order !== undefined ? parseInt(order, 10) : card.order,
      duedate: card.duedate,
      startdate: card.startdate ?? null,
    };
    const duedate = toDeckIso(due);
    if (duedate !== undefined) body.duedate = duedate;
    if (color !== undefined) body.color = normalizeColor(color, card.color);

    const updated = await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards/${card.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    return cardSummary(updated);
  },

  // Deck's action endpoints (reorder/assign/label) answer with stale card
  // data (relations/stack not refreshed); always re-read for truthful output.
  async _refreshCard(boardId, stackId, cardId) {
    const full = await request(
      `${API}/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
      { headers: { Accept: "application/json" } },
    );
    return cardSummary(full);
  },

  async moveCard(ref, cardId, toStackRef, order) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    const stacks = await this._stacksRaw(board.id);
    const target = resolveEntity(stacks, toStackRef, "Stack");
    if (target.id === stack.id && order === undefined) {
      return cardSummary(card); // already there
    }
    // The /api reorder route's {stackId} PATH param shadows the body's target
    // stackId, so moves via it are silently no-ops. The internal flat route
    // (used by the web UI) takes the target stack from the body.
    await request(`${INTERNAL}/cards/${card.id}/reorder`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        stackId: target.id,
        order: order !== undefined ? parseInt(order, 10) : card.order,
      }),
    });
    return await this._refreshCard(board.id, target.id, card.id);
  },

  async completeCard(cardId) {
    if (!cardId) throw new Error("A --card (id) is required.");
    const card = await request(`${INTERNAL}/cards/${cardId}/done`, {
      method: "PUT",
      headers: { Accept: "application/json" },
    });
    return cardSummary(card);
  },

  async uncompleteCard(cardId) {
    if (!cardId) throw new Error("A --card (id) is required.");
    const card = await request(`${INTERNAL}/cards/${cardId}/undone`, {
      method: "PUT",
      headers: { Accept: "application/json" },
    });
    return cardSummary(card);
  },

  // archive/unarchive use the internal flat routes: archived cards are not
  // listed under a stack's `cards`, so stack-path resolution would fail.
  async archiveCard(cardId) {
    if (!cardId) throw new Error("A --card (id) is required.");
    const card = await request(`${INTERNAL}/cards/${cardId}/archive`, {
      method: "PUT",
      headers: { Accept: "application/json" },
    });
    return cardSummary(card);
  },

  async unarchiveCard(cardId) {
    if (!cardId) throw new Error("A --card (id) is required.");
    const card = await request(`${INTERNAL}/cards/${cardId}/unarchive`, {
      method: "PUT",
      headers: { Accept: "application/json" },
    });
    return cardSummary(card);
  },

  async deleteCard(ref, cardId) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards/${card.id}`,
      { method: "DELETE", headers: { Accept: "application/json" } },
    );
    return {
      id: card.id,
      title: card.title,
      status: "deleted",
      note: "Soft delete — the card moves to the board trash.",
    };
  },

  // ---- Labels ----

  async listLabels(ref) {
    const board = await this.resolveBoard(ref);
    const full = await request(`${API}/boards/${board.id}`, {
      headers: { Accept: "application/json" },
    });
    return (full.labels || []).map((l) => ({
      id: l.id,
      title: l.title,
      color: l.color,
    }));
  },

  async createLabel(ref, title, color) {
    const board = await this.resolveBoard(ref);
    if (!title || !title.trim()) throw new Error("--title is required.");
    return await request(`${API}/boards/${board.id}/labels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ title: title.trim(), color: normalizeColor(color) }),
    });
  },

  async updateLabel(ref, labelId, { title, color } = {}) {
    const board = await this.resolveBoard(ref);
    const labels = await this.listLabels(board.id);
    const label = labels.find((l) => l.id === parseInt(labelId, 10));
    if (!label)
      throw new Error(
        `Label ${labelId} not found. Available: ${labels.map((l) => `${l.id} "${l.title}"`).join(", ") || "(none)"}`,
      );
    if (title === undefined && color === undefined)
      throw new Error("Nothing to update. Provide --title or --color.");
    // label update also behaves as full update; keep current values as base.
    return await request(`${API}/boards/${board.id}/labels/${label.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: title !== undefined ? title : label.title,
        color: color !== undefined ? normalizeColor(color) : label.color,
      }),
    });
  },

  async deleteLabel(ref, labelId) {
    const board = await this.resolveBoard(ref);
    const labels = await this.listLabels(board.id);
    const label = labels.find((l) => l.id === parseInt(labelId, 10));
    if (!label)
      throw new Error(`Label ${labelId} not found in board ${board.id}.`);
    await request(`${API}/boards/${board.id}/labels/${label.id}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    return { id: label.id, title: label.title, status: "deleted" };
  },

  async _resolveLabelId(boardId, ref) {
    const labels = await this.listLabels(boardId);
    const label = resolveEntity(labels, ref, "Label");
    return label.id;
  },

  async assignLabel(ref, cardId, labelRef) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    const labelId = await this._resolveLabelId(board.id, labelRef);
    await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards/${card.id}/assignLabel`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ labelId }),
      },
    );
    return await this._refreshCard(board.id, stack.id, card.id);
  },

  async unassignLabel(ref, cardId, labelRef) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    const labelId = await this._resolveLabelId(board.id, labelRef);
    await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards/${card.id}/removeLabel`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ labelId }),
      },
    );
    return await this._refreshCard(board.id, stack.id, card.id);
  },

  // ---- Assignments ----

  async assignUser(ref, cardId, userId) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    if (!userId) throw new Error("--user is required.");
    await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards/${card.id}/assignUser`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ userId, type: 0 }),
      },
    );
    return await this._refreshCard(board.id, stack.id, card.id);
  },

  async unassignUser(ref, cardId, userId) {
    const { board, stack, card } = await this._findCard(ref, cardId);
    if (!userId) throw new Error("--user is required.");
    await request(
      `${API}/boards/${board.id}/stacks/${stack.id}/cards/${card.id}/unassignUser`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ userId, type: 0 }),
      },
    );
    return await this._refreshCard(board.id, stack.id, card.id);
  },

  // Pure helpers (exposed for unit tests, like Contacts._parseVCard).
  _normalizeColor: normalizeColor,
  _toDeckIso: toDeckIso,
  _resolveEntity: resolveEntity,
  _cardSummary: cardSummary,
};
