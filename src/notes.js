import { request } from "./request.js";

export const Notes = {
  async list() {
    const data = await request("/index.php/apps/notes/api/v1/notes", {
      headers: { Accept: "application/json" },
    });
    return data.map((n) => ({
      id: n.id,
      title: n.title,
      modified: n.modified,
      category: n.category,
    }));
  },

  async get(id) {
    return await request(`/index.php/apps/notes/api/v1/notes/${id}`, {
      headers: { Accept: "application/json" },
    });
  },

  async create(title, content, category = "") {
    if (!title || typeof title !== "string" || title.trim() === "") {
      throw new Error("Title is required for creating a note.");
    }
    if (!content || typeof content !== "string") {
      throw new Error("Content is required for creating a note.");
    }

    const payload = { title, content };
    if (category) {
      payload.category = category;
    }

    const data = await request("/index.php/apps/notes/api/v1/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    return {
      id: data.id,
      title: data.title,
      modified: data.modified,
      category: data.category,
      content: data.content,
    };
  },

  async update(id, title, content, category) {
    if (!id) throw new Error("Note ID is required for update.");

    const payload = {};
    if (title !== undefined) payload.title = title;
    if (content !== undefined) payload.content = content;
    if (category !== undefined) payload.category = category;

    if (Object.keys(payload).length === 0) {
      throw new Error(
        "Nothing to update. Provide title, content, or category.",
      );
    }

    const data = await request(`/index.php/apps/notes/api/v1/notes/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    return data;
  },

  async delete(id) {
    if (!id) throw new Error("Note ID is required for deletion.");

    await request(`/index.php/apps/notes/api/v1/notes/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });

    return { success: true, id };
  },

  async listCategories() {
    try {
      const data = await request("/index.php/apps/notes/api/v1/categories", {
        headers: { Accept: "application/json" },
      });
      return data.ocs?.data || [];
    } catch (e) {
      if (e.message.includes("404")) {
        return {
          error: "Categories API not available in this Nextcloud version",
        };
      }
      throw e;
    }
  },

  async createCategory(name) {
    const data = await request("/index.php/apps/notes/api/v1/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ category: name }),
    });
    return data.ocs?.data || { name };
  },

  async deleteCategory(name) {
    try {
      await request(
        `/index.php/apps/notes/api/v1/categories/${encodeURIComponent(name)}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );
      return { success: true, name };
    } catch (e) {
      if (e.message.includes("404")) {
        return {
          error: "Categories API not available in this Nextcloud version",
        };
      }
      throw e;
    }
  },

  async getNoteHistory(id) {
    try {
      const data = await request(
        `/index.php/apps/notes/api/v1/notes/${id}/history`,
        {
          headers: { Accept: "application/json" },
        },
      );
      return data.ocs?.data || [];
    } catch (e) {
      if (e.message.includes("404")) {
        return {
          error: "Note history API not available in this Nextcloud version",
        };
      }
      throw e;
    }
  },

  async getBackup() {
    try {
      const data = await request(
        "/index.php/apps/notes/api/v1/notes?format=backup",
        {
          headers: { Accept: "application/json" },
        },
      );
      return data.ocs?.data || [];
    } catch (e) {
      if (e.message.includes("404")) {
        return { error: "Backup API not available in this Nextcloud version" };
      }
      throw e;
    }
  },
};
