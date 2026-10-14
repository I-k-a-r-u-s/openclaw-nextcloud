import { CONFIG } from "./config.js";
import { request, fetchRaw } from "./request.js";
import { ensureArray, guessImageMime } from "./utils.js";
import fs from "node:fs";

export const Talk = {
  async listConversations() {
    const data = await request("/ocs/v2.php/apps/spreed/api/v4/room", {
      headers: { Accept: "application/json" },
    });
    return ensureArray(data.ocs.data);
  },

  async getConversation(token) {
    if (!token) throw new Error("Conversation token is required.");
    const data = await request(`/ocs/v2.php/apps/spreed/api/v4/room/${token}`, {
      headers: { Accept: "application/json" },
    });
    return data.ocs.data;
  },

  async createConversation(
    roomName,
    roomType = "group",
    invite = null,
    options = {},
  ) {
    if (!roomName || roomName.trim() === "") {
      throw new Error("Room name is required for creating a conversation.");
    }

    const typeMap = {
      group: 2,
      public: 3,
      "note-to-self": 6,
    };

    const payload = {
      roomName: roomName.trim(),
      roomType: typeMap[roomType] || 2,
    };

    if (invite) payload.invite = invite;
    if (options.description) payload.description = options.description;
    if (options.password) payload.password = options.password;

    const data = await request("/ocs/v2.php/apps/spreed/api/v4/room", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return data.ocs.data;
  },

  async deleteConversation(token) {
    if (!token) throw new Error("Conversation token is required for deletion.");
    await request(`/ocs/v2.php/apps/spreed/api/v4/room/${token}`, {
      method: "DELETE",
    });
    return { token, status: "deleted" };
  },

  async listMessages(token, options = {}) {
    if (!token) throw new Error("Conversation token is required.");

    const params = new URLSearchParams({
      lookIntoFuture:
        options.lookIntoFuture !== undefined
          ? String(options.lookIntoFuture)
          : "0",
      limit: options.limit !== undefined ? String(options.limit) : "50",
      setReadMarker: options.setReadMarker !== false ? "1" : "0",
    });

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}?${params}`,
      {
        headers: { Accept: "application/json" },
      },
    );
    return ensureArray(data.ocs.data);
  },

  async sendMessage(token, message, replyTo = null) {
    if (!token) throw new Error("Conversation token is required.");
    if (!message || message.trim() === "") {
      throw new Error("Message content is required.");
    }

    const payload = { message: message.trim() };
    if (replyTo) payload.replyTo = replyTo;

    const data = await request(`/ocs/v2.php/apps/spreed/api/v1/chat/${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return data.ocs.data;
  },

  async deleteMessage(token, messageId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!messageId) throw new Error("Message ID is required.");
    await request(`/ocs/v2.php/apps/spreed/api/v1/chat/${token}/${messageId}`, {
      method: "DELETE",
    });
    return { messageId, status: "deleted" };
  },

  async editMessage(token, messageId, message) {
    if (!token) throw new Error("Conversation token is required.");
    if (!messageId) throw new Error("Message ID is required.");
    if (!message || message.trim() === "") {
      throw new Error("Message content is required.");
    }

    const payload = { message: message.trim() };
    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/${messageId}`,
      {
        method: "PUT",
        headers: { Accept: "application/json" },
        body: JSON.stringify(payload),
      },
    );
    return data.ocs.data;
  },

  async listBots(token = null) {
    const endpoint = token
      ? `/ocs/v2.php/apps/spreed/api/v1/bot/${token}`
      : "/ocs/v2.php/apps/spreed/api/v1/bot/admin";

    const data = await request(endpoint, {
      headers: { Accept: "application/json" },
    });
    return ensureArray(data.ocs.data);
  },

  async addParticipant(token, user, source = "users") {
    if (!token) throw new Error("Conversation token is required.");
    if (!user) throw new Error("User is required.");

    const payload = {
      newParticipant: user,
      source: source,
    };

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    return data.ocs.data;
  },

  async enableBotInConversation(token, botId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!botId) throw new Error("Bot ID is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v1/bot/${token}/${botId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    );
    return { token, botId, status: data.ocs.meta.status };
  },

  async disableBotInConversation(token, botId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!botId) throw new Error("Bot ID is required.");

    await request(`/ocs/v2.php/apps/spreed/api/v1/bot/${token}/${botId}`, {
      method: "DELETE",
    });
    return { token, botId, status: "disabled" };
  },

  async uploadFileToConversation(token, filePath, fileContent) {
    if (!token) throw new Error("Conversation token is required.");
    if (!filePath) throw new Error("File path is required.");
    if (fileContent === undefined || fileContent === null) {
      throw new Error("File content is required.");
    }

    const encodedFilePath = encodeURIComponent(filePath);
    const fileEndpoint = `/remote.php/dav/files/${CONFIG.user}/Talk/${encodedFilePath}`;

    // Upload file to Talk folder
    await request(fileEndpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: fileContent,
    });

    // Get file ID via PROPFIND
    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop><oc:fileid/></d:prop>
</d:propfind>`;

    let fileId = "unknown";
    try {
      const propResponse = await request(fileEndpoint, {
        method: "PROPFIND",
        headers: { Depth: "0", "Content-Type": "application/xml" },
        body: propfindBody,
      });

      if (propResponse["d:multistatus"]?.["d:response"]) {
        const responses = ensureArray(
          propResponse["d:multistatus"]["d:response"],
        );
        const propstats = ensureArray(responses[0]?.["d:propstat"]);
        fileId = propstats[0]?.["d:prop"]?.["oc:fileid"] || "unknown";
      }
    } catch (e) {
      console.error("File ID lookup error:", e.message);
    }

    // Share in conversation if fileId found
    let shared = false;
    if (fileId !== "unknown") {
      try {
        await request(`/ocs/v2.php/apps/spreed/api/v1/chat/${token}/share`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            objectType: "file",
            objectId: String(fileId),
          }),
        });
        shared = true;
      } catch (e) {
        console.error("Share in conversation error:", e.message);
      }
    }

    return {
      token,
      filePath,
      status: "uploaded",
      fileId,
      message: shared
        ? "File uploaded and shared in conversation."
        : "File uploaded to Talk folder but could not be shared in conversation.",
    };
  },

  async addReaction(token, messageId, emoji) {
    if (!token) throw new Error("Conversation token is required.");
    if (!messageId) throw new Error("Message ID is required.");
    if (!emoji) throw new Error("Emoji is required.");

    await request(
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/message/${messageId}/reaction/${encodeURIComponent(emoji)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    return { token, messageId, emoji, status: "added" };
  },

  async deleteReaction(token, messageId, emoji) {
    if (!token) throw new Error("Conversation token is required.");
    if (!messageId) throw new Error("Message ID is required.");
    if (!emoji) throw new Error("Emoji is required.");

    await request(
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/message/${messageId}/reaction/${encodeURIComponent(emoji)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      },
    );

    return { token, messageId, emoji, status: "removed" };
  },

  async listReactions(token, messageId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!messageId) throw new Error("Message ID is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v1/chat/${token}/message/${messageId}/reactions`,
      {
        headers: { Accept: "application/json" },
      },
    );

    return data.ocs?.data || [];
  },

  // Talk's poll API lives under v1 (see spreed routesPollController.php).
  async createPoll(token, question, options) {
    if (!token) throw new Error("Conversation token is required.");
    if (!question) throw new Error("Poll question is required.");
    if (!options || !Array.isArray(options) || options.length < 2) {
      throw new Error("Poll requires at least two options.");
    }

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v1/poll/${token}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          question: question,
          options: options,
          // current Talk requires resultMode/maxVotes (renamed from
          // voteMode/voteMax); 0 = anonymous, maxVotes 1 = single choice
          resultMode: 0,
          maxVotes: 1,
        }),
      },
    );

    return data.ocs?.data || {};
  },

  async getPoll(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v1/poll/${token}/${pollId}`,
      { headers: { Accept: "application/json" } },
    );

    return data.ocs?.data || {};
  },

  async closePoll(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");

    await request(`/ocs/v2.php/apps/spreed/api/v1/poll/${token}/${pollId}`, {
      method: "DELETE",
    });

    return { token, pollId, status: "closed" };
  },

  // There is no separate "results" endpoint: showPoll returns vote counts
  // plus per-voter details (when the vote mode allows it).
  async getPollResults(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v1/poll/${token}/${pollId}`,
      { headers: { Accept: "application/json" } },
    );

    return data.ocs?.data || {};
  },

  async getSettings(token) {
    // Get room details which include most settings
    const data = await request(`/ocs/v2.php/apps/spreed/api/v4/room/${token}`, {
      headers: { Accept: "application/json" },
    });
    return data.ocs?.data || {};
  },

  async updateSettings(token, settings) {
    // Update room settings via the correct endpoints
    // Only supported settings can be updated via user app password:
    // - favorite: use /favorite endpoint (POST/DELETE)
    // - notificationLevel: use /notify endpoint (POST)
    // - read-only: use /read-only endpoint (PUT)
    // - password: use /password endpoint (PUT)
    // - public: use /public endpoint (POST/DELETE)

    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      let result;
      switch (key) {
        case "favorite":
          result = await request(
            `/ocs/v2.php/apps/spreed/api/v4/room/${token}/favorite`,
            { method: value ? "POST" : "DELETE" },
          );
          break;
        case "notificationLevel":
          result = await request(
            `/ocs/v2.php/apps/spreed/api/v4/room/${token}/notify`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ level: value }),
            },
          );
          break;
        case "readOnly":
          result = await request(
            `/ocs/v2.php/apps/spreed/api/v4/room/${token}/read-only`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state: value }),
            },
          );
          break;
        case "password":
          result = await request(
            `/ocs/v2.php/apps/spreed/api/v4/room/${token}/password`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: value }),
            },
          );
          break;
        case "public":
          result = await request(
            `/ocs/v2.php/apps/spreed/api/v4/room/${token}/public`,
            { method: value ? "POST" : "DELETE" },
          );
          break;
        case "listable":
          result = await request(
            `/ocs/v2.php/apps/spreed/api/v4/room/${token}/listable`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scope: value }),
            },
          );
          break;
        case "defaultPermissions":
          result = await request(
            `/ocs/v2.php/apps/spreed/api/v4/room/${token}/permissions/default`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ permissions: value }),
            },
          );
          break;
        case "muted":
        default:
          result = {
            error: `Setting '${key}' cannot be updated via user app password API`,
          };
          break;
      }
      results.push({ setting: key, result });
    }

    return results;
  },

  async getGuestSettings(token) {
    // Get room details for guest-related settings
    const data = await request(`/ocs/v2.php/apps/spreed/api/v4/room/${token}`, {
      headers: { Accept: "application/json" },
    });
    return data.ocs?.data || {};
  },

  async updateGuestSettings(token, settings) {
    // Guest settings are updated via the same endpoints as regular settings
    // but with different semantics (applies to guests, not the user)
    return this.updateSettings(token, settings);
  },

  // ---- Participant management ----

  async listParticipants(token) {
    if (!token) throw new Error("Conversation token is required.");
    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants`,
      { headers: { Accept: "application/json" } },
    );
    // v4 servers paginate as { items, pending }; older ones return a plain array.
    const payload = data.ocs?.data;
    if (Array.isArray(payload)) return payload;
    return ensureArray(payload?.items ?? []);
  },

  async joinConversation(token) {
    if (!token) throw new Error("Conversation token is required.");
    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants/active`,
      { method: "POST", headers: { Accept: "application/json" } },
    );
    return data.ocs?.data ?? { token, status: "joined" };
  },

  async leaveConversation(token) {
    if (!token) throw new Error("Conversation token is required.");
    await request(
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/participants/active`,
      { method: "DELETE", headers: { Accept: "application/json" } },
    );
    return { token, status: "left" };
  },

  async removeParticipant(token, participantAttendeeId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!participantAttendeeId)
      throw new Error("Participant attendee ID is required.");
    await request(`/ocs/v2.php/apps/spreed/api/v4/room/${token}/attendees`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ attendee: participantAttendeeId }),
    });
    return { token, participant: participantAttendeeId, status: "removed" };
  },

  async promoteParticipant(token, attendeeId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!attendeeId) throw new Error("Attendee ID is required.");
    await request(`/ocs/v2.php/apps/spreed/api/v4/room/${token}/moderators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ attendee: attendeeId }),
    });
    return { token, attendee: attendeeId, status: "promoted" };
  },

  async demoteParticipant(token, attendeeId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!attendeeId) throw new Error("Attendee ID is required.");
    await request(`/ocs/v2.php/apps/spreed/api/v4/room/${token}/moderators`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ attendee: attendeeId }),
    });
    return { token, attendee: attendeeId, status: "demoted" };
  },

  async updateParticipantPermissions(
    token,
    attendeeId,
    method = "set",
    permissions,
  ) {
    if (!token) throw new Error("Conversation token is required.");
    if (!attendeeId) throw new Error("Attendee ID is required.");
    if (permissions === undefined || permissions === null)
      throw new Error("Permissions bitmask is required.");
    if (!["set", "add", "remove"].includes(method))
      throw new Error("Method must be one of: set, add, remove.");
    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/room/${token}/attendees/permissions`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ attendee: attendeeId, method, permissions }),
      },
    );
    return data.ocs?.data ?? {
      token,
      attendee: attendeeId,
      method,
      permissions,
      status: "updated",
    };
  },

  // ---- Poll voting ----
  // Voting (and unvoting, via an empty option list) is a POST to the poll
  // resource itself (spreed Poll#votePoll route).

  async votePoll(token, pollId, optionIds) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");
    if (!Array.isArray(optionIds) || optionIds.length === 0)
      throw new Error("At least one option ID is required (use unvote to clear).");
    await request(
      `/ocs/v2.php/apps/spreed/api/v1/poll/${token}/${pollId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ optionIds }),
      },
    );
    return { token, pollId, voted: optionIds, status: "recorded" };
  },

  async unvotePoll(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");
    await request(
      `/ocs/v2.php/apps/spreed/api/v1/poll/${token}/${pollId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ optionIds: [] }),
      },
    );
    return { token, pollId, status: "vote-removed" };
  },

  // ---- Conversation avatars ----

  async getAvatar(token, outputPath = null) {
    if (!token) throw new Error("Conversation token is required.");
    const response = await fetchRaw(
      `/ocs/v2.php/apps/spreed/api/v1/room/${token}/avatar`,
    );
    if (response.status === 404) {
      return { token, error: "No avatar set for this conversation." };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("svg")
        ? "svg"
        : "jpg";
    const buffer = Buffer.from(await response.arrayBuffer());
    const file = outputPath || `avatar-${token}.${ext}`;
    fs.writeFileSync(file, buffer);
    // Servers without a custom avatar answer 200 with a generated SVG
    // placeholder instead of 404 (custom uploads are restricted to png/jpeg).
    const fallback = contentType.includes("svg");
    return {
      token,
      path: file,
      contentType,
      bytes: buffer.length,
      ...(fallback
        ? { fallback: true, note: "Generated placeholder; no custom avatar set." }
        : {}),
    };
  },

  async setAvatar(token, filePath) {
    if (!token) throw new Error("Conversation token is required.");
    if (!filePath) throw new Error("File path is required.");
    if (!fs.existsSync(filePath))
      throw new Error(`File not found: ${filePath}`);
    const mime = guessImageMime(filePath);
    if (!mime) throw new Error("Avatar must be a png/jpg/jpeg image.");
    const buffer = fs.readFileSync(filePath);
    const form = new FormData();
    // AvatarController::uploadAvatar() reads getUploadedFile('file').
    form.append(
      "file",
      new Blob([buffer], { type: mime }),
      filePath.split("/").pop(),
    );
    // No explicit Content-Type: fetch sets the multipart boundary itself.
    await request(`/ocs/v2.php/apps/spreed/api/v1/room/${token}/avatar`, {
      method: "POST",
      body: form,
    });
    return { token, file: filePath, status: "avatar-uploaded" };
  },

  async deleteAvatar(token) {
    if (!token) throw new Error("Conversation token is required.");
    await request(`/ocs/v2.php/apps/spreed/api/v1/room/${token}/avatar`, {
      method: "DELETE",
    });
    return { token, status: "avatar-deleted" };
  },

  // NOTE: Bot registration/edit/removal has NO OCS API endpoints (verified
  // against spreed routesBotController.php: only list/enable/disable/send/
  // react exist). Bots must be installed via the admin terminal:
  //   ./occ talk:bot:install ... / ./occ talk:bot:remove <name>
};
