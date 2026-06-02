import { CONFIG } from "./config.js";
import { request } from "./request.js";
import { ensureArray } from "./utils.js";

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
        options.lookIntoFuture !== undefined ? String(options.lookIntoFuture) : "0",
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
        const responses = ensureArray(propResponse["d:multistatus"]["d:response"]);
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
          body: JSON.stringify({ objectType: "file", objectId: String(fileId) }),
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

  async createPoll(token, question, options) {
    if (!token) throw new Error("Conversation token is required.");
    if (!question) throw new Error("Poll question is required.");
    if (!options || !Array.isArray(options) || options.length === 0) {
      throw new Error("Poll options are required (at least one option).");
    }

    const data = await request("/ocs/v2.php/apps/spreed/api/v4/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: token,
        question: question,
        options: options,
      }),
    });

    return data.ocs?.data || {};
  },

  async getPoll(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/poll/${pollId}?conversationId=${token}`,
      { headers: { Accept: "application/json" } },
    );

    return data.ocs?.data || {};
  },

  async closePoll(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");

    await request(
      `/ocs/v2.php/apps/spreed/api/v4/poll/${pollId}?conversationId=${token}`,
      { method: "DELETE" },
    );

    return { token, pollId, status: "closed" };
  },

  async publishPoll(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/poll/${pollId}/publish?conversationId=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );

    return data.ocs?.data || {};
  },

  async getPollResults(token, pollId) {
    if (!token) throw new Error("Conversation token is required.");
    if (!pollId) throw new Error("Poll ID is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/poll/${pollId}/results?conversationId=${token}`,
      { headers: { Accept: "application/json" } },
    );

    return data.ocs?.data || {};
  },

  async getSettings(token) {
    if (!token) throw new Error("Conversation token is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/settings/conversation/${token}`,
      { headers: { Accept: "application/json" } },
    );

    return data.ocs?.data || {};
  },

  async updateSettings(token, settings) {
    if (!token) throw new Error("Conversation token is required.");
    if (!settings || typeof settings !== "object") {
      throw new Error("Settings object is required.");
    }

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/settings/conversation/${token}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      },
    );

    return data.ocs?.data || {};
  },

  async getGuestSettings(token) {
    if (!token) throw new Error("Conversation token is required.");

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/settings/guest/${token}`,
      { headers: { Accept: "application/json" } },
    );

    return data.ocs?.data || {};
  },

  async updateGuestSettings(token, settings) {
    if (!token) throw new Error("Conversation token is required.");
    if (!settings || typeof settings !== "object") {
      throw new Error("Settings object is required.");
    }

    const data = await request(
      `/ocs/v2.php/apps/spreed/api/v4/settings/guest/${token}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      },
    );

    return data.ocs?.data || {};
  },
};
