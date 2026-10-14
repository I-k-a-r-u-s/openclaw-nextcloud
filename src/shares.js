import { CONFIG } from "./config.js";
import { request } from "./request.js";

const OCS_HEADERS = { Accept: "application/json" };

function unwrap(envelope) {
  const meta = envelope && envelope.ocs && envelope.ocs.meta;
  if (!meta || meta.status !== "ok") {
    throw new Error(
      `OCS error ${meta && meta.statuscode}: ${meta && meta.message}`,
    );
  }
  return envelope.ocs.data;
}

function normalize(s) {
  const baseUrl = CONFIG.url.replace(/\/+$/, "");
  return {
    id: s.id,
    path: s.path,
    shareType: s.share_type,
    shareWith: s.share_with || null,
    permissions: s.permissions,
    token: s.token || null,
    url: s.url || (s.token ? `${baseUrl}/s/${s.token}` : null),
    expireDate: s.expiration || null,
  };
}

export const Shares = {
  async list({ path = null } = {}) {
    let endpoint = "/ocs/v2.php/apps/files_sharing/api/v1/shares";
    if (path) {
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      endpoint += `?path=${encodeURIComponent(cleanPath)}`;
    }
    const envelope = await request(endpoint, {
      method: "GET",
      headers: OCS_HEADERS,
    });
    const data = unwrap(envelope) || [];
    return (Array.isArray(data) ? data : [data]).map((s) => normalize(s));
  },

  async createLink({
    path,
    permissions = "read",
    password = null,
    expireDate = null,
  }) {
    if (!path) throw new Error("Missing path for share");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    const permMap = {
      read: 1,
      edit: 15,
    };
    const perms = permMap[permissions];
    if (perms === undefined) {
      throw new Error(
        `Unknown --permissions '${permissions}'. Use 'read' or 'edit'.`,
      );
    }

    const body = new URLSearchParams({
      path: cleanPath,
      shareType: "3",
      permissions: String(perms),
    });
    if (password) body.set("password", password);
    if (expireDate) body.set("expireDate", expireDate);

    const envelope = await request(
      "/ocs/v2.php/apps/files_sharing/api/v1/shares",
      {
        method: "POST",
        headers: {
          ...OCS_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    const s = unwrap(envelope);
    return { ...normalize(s), passwordProtected: !!password };
  },

  async createUserShare({
    path,
    user,
    permissions = "read",
    expireDate = null,
  }) {
    if (!path) throw new Error("Missing path for share");
    if (!user) throw new Error("Missing user to share with");

    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    const permMap = {
      read: 1,
      edit: 15,
      delete: 31,
    };
    const perms = permMap[permissions];
    if (perms === undefined) {
      throw new Error(
        `Unknown --permissions '${permissions}'. Use 'read', 'edit', or 'delete'.`,
      );
    }

    const body = new URLSearchParams({
      path: cleanPath,
      shareType: "0",
      shareWith: user,
      permissions: String(perms),
    });
    if (expireDate) body.set("expireDate", expireDate);

    const envelope = await request(
      "/ocs/v2.php/apps/files_sharing/api/v1/shares",
      {
        method: "POST",
        headers: {
          ...OCS_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    const s = unwrap(envelope);
    return normalize(s);
  },

  async createGroupShare({
    path,
    group,
    permissions = "read",
    expireDate = null,
  }) {
    if (!path) throw new Error("Missing path for share");
    if (!group) throw new Error("Missing group to share with");

    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    const permMap = {
      read: 1,
      edit: 15,
      delete: 31,
    };
    const perms = permMap[permissions];
    if (perms === undefined) {
      throw new Error(
        `Unknown --permissions '${permissions}'. Use 'read', 'edit', or 'delete'.`,
      );
    }

    const body = new URLSearchParams({
      path: cleanPath,
      shareType: "1",
      shareWith: group,
      permissions: String(perms),
    });
    if (expireDate) body.set("expireDate", expireDate);

    const envelope = await request(
      "/ocs/v2.php/apps/files_sharing/api/v1/shares",
      {
        method: "POST",
        headers: {
          ...OCS_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    const s = unwrap(envelope);
    return normalize(s);
  },

  async delete({ id }) {
    if (!id) throw new Error("Missing share id");
    const envelope = await request(
      `/ocs/v2.php/apps/files_sharing/api/v1/shares/${encodeURIComponent(id)}`,
      { method: "DELETE", headers: OCS_HEADERS },
    );
    unwrap(envelope);
    return { id, status: "deleted" };
  },

  // shareType 6 (remote/federated): share with a user on another Nextcloud
  // server. Requires Federated File Sharing to be enabled on both servers.
  async createRemoteShare({
    path,
    remoteUser,
    permissions = "read",
    expireDate = null,
  }) {
    if (!path) throw new Error("Missing path for share");
    if (!remoteUser)
      throw new Error(
        "Missing --remote-user (format: user@nextcloud.example.com)",
      );
    if (!remoteUser.includes("@"))
      throw new Error(
        "--remote-user must include the remote server, e.g. user@nextcloud.example.com",
      );

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const permMap = { read: 1, edit: 15, delete: 31 };
    const perms = permMap[permissions];
    if (perms === undefined) {
      throw new Error(
        `Unknown --permissions '${permissions}'. Use 'read', 'edit', or 'delete'.`,
      );
    }

    const body = new URLSearchParams({
      path: cleanPath,
      shareType: "6",
      shareWith: remoteUser,
      permissions: String(perms),
    });
    if (expireDate) body.set("expireDate", expireDate);

    const envelope = await request(
      "/ocs/v2.php/apps/files_sharing/api/v1/shares",
      {
        method: "POST",
        headers: {
          ...OCS_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    return normalize(unwrap(envelope));
  },

  // shareType 10 (room/Talk): share into a conversation. Nextcloud's Talk
  // share listener posts the shared file as a message in the room.
  async createChatShare({ path, roomToken, permissions = "read" }) {
    if (!path) throw new Error("Missing path for share");
    if (!roomToken) throw new Error("Missing --token (conversation token)");

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const permMap = { read: 1, edit: 15 };
    const perms = permMap[permissions];
    if (perms === undefined) {
      throw new Error(
        `Unknown --permissions '${permissions}'. Use 'read' or 'edit'.`,
      );
    }

    const body = new URLSearchParams({
      path: cleanPath,
      shareType: "10",
      shareWith: roomToken,
      permissions: String(perms),
    });

    const envelope = await request(
      "/ocs/v2.php/apps/files_sharing/api/v1/shares",
      {
        method: "POST",
        headers: {
          ...OCS_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      },
    );
    return { ...normalize(unwrap(envelope)), sharedToConversation: roomToken };
  },
};
