import { CONFIG } from "./config.js";
import { request, fetchRaw } from "./request.js";
import { ensureArray, xmlEscape } from "./utils.js";

export const Files = {
  async list(dirPath = "/") {
    const cleanPath = dirPath.startsWith("/") ? dirPath.slice(1) : dirPath;
    const endpoint = `/remote.php/dav/files/${CONFIG.user}/${cleanPath}`;

    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop>
    <d:resourcetype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
  </d:prop>
</d:propfind>`;

    const response = await request(endpoint, {
      method: "PROPFIND",
      headers: {
        Depth: "1",
        "Content-Type": "application/xml",
      },
      body: propfindBody,
    });

    if (
      !response["d:multistatus"] ||
      !response["d:multistatus"]["d:response"]
    ) {
      return [];
    }

    const responses = ensureArray(response["d:multistatus"]["d:response"]);
    const baseUrl = CONFIG.url.replace(/\/+$/, "");

    return responses
      .map((r) => {
        const href = r["d:href"];
        const propstats = ensureArray(r["d:propstat"]);
        if (!propstats[0] || !propstats[0]["d:prop"]) return null;
        const props = propstats[0]["d:prop"];

        const isDir =
          props["d:resourcetype"] &&
          props["d:resourcetype"]["d:collection"] !== undefined;
        const name = decodeURIComponent(
          href
            .split("/")
            .filter((p) => p)
            .pop(),
        );

        if (
          href.endsWith(encodeURIComponent(CONFIG.user) + "/" + cleanPath) ||
          href.endsWith(encodeURIComponent(CONFIG.user) + "/" + cleanPath + "/")
        ) {
          if (cleanPath !== "" && name === cleanPath.split("/").pop())
            return null;
        }

        const fileId =
          props["oc:fileid"] != null ? String(props["oc:fileid"]) : null;

        return {
          name: name,
          path: href,
          isDir: isDir,
          size: props["d:getcontentlength"],
          lastModified: props["d:getlastmodified"],
          fileId: fileId,
          internalLink: fileId ? `${baseUrl}/index.php/f/${fileId}` : null,
        };
      })
      .filter((f) => f);
  },

  async upload(filePath, content) {
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

    const segments = cleanPath.split("/").filter(Boolean);
    if (segments.length > 1) {
      let currentPath = "";
      for (const seg of segments.slice(0, -1)) {
        currentPath = currentPath ? `${currentPath}/${seg}` : seg;
        try {
          await request(`/remote.php/dav/files/${CONFIG.user}/${currentPath}`, {
            method: "MKCOL",
          });
        } catch (e) {
          if (e.status !== 405) throw e;
        }
      }
    }

    const endpoint = `/remote.php/dav/files/${CONFIG.user}/${cleanPath}`;

    await request(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: content,
    });

    return { path: filePath, status: "uploaded", size: content.length };
  },

  async get(filePath) {
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    const endpoint = `/remote.php/dav/files/${CONFIG.user}/${cleanPath}`;

    const response = await fetchRaw(endpoint, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(
        `Request failed: HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const content = await response.text();
    return { path: filePath, content, size: content.length };
  },

  async delete(filePath) {
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    const endpoint = `/remote.php/dav/files/${CONFIG.user}/${cleanPath}`;

    await request(endpoint, {
      method: "DELETE",
    });

    return { path: filePath, status: "deleted" };
  },

  async search(query) {
    const endpoint = `/remote.php/dav/`;
    const body = `<?xml version="1.0" encoding="utf-8"?>
<d:searchrequest xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:basicsearch>
    <d:select>
      <d:prop>
        <d:getlastmodified/>
        <d:getcontentlength/>
        <d:resourcetype/>
        <d:displayname/>
        <oc:fileid/>
      </d:prop>
    </d:select>
    <d:from>
      <d:scope>
        <d:href>/files/${CONFIG.user}</d:href>
        <d:depth>infinity</d:depth>
      </d:scope>
    </d:from>
    <d:where>
      <d:like>
        <d:prop>
          <d:displayname/>
        </d:prop>
        <d:literal>%${xmlEscape(query)}%</d:literal>
      </d:like>
    </d:where>
  </d:basicsearch>
</d:searchrequest>`;

    const response = await request(endpoint, {
      method: "SEARCH",
      headers: { "Content-Type": "application/xml" },
      body: body,
    });

    if (!response["d:multistatus"] || !response["d:multistatus"]["d:response"])
      return [];
    const responses = ensureArray(response["d:multistatus"]["d:response"]);
    const baseUrl = CONFIG.url.replace(/\/+$/, "");

    return responses
      .map((r) => {
        const href = r["d:href"];
        const propstats = ensureArray(r["d:propstat"]);
        if (!propstats[0] || !propstats[0]["d:prop"]) return null;
        const props = propstats[0]["d:prop"];

        const isDir =
          props["d:resourcetype"] &&
          props["d:resourcetype"]["d:collection"] !== undefined;
        const fileId =
          props["oc:fileid"] != null ? String(props["oc:fileid"]) : null;

        return {
          name:
            props["d:displayname"] || decodeURIComponent(href.split("/").pop()),
          path: href,
          isDir: isDir,
          size: props["d:getcontentlength"],
          lastModified: props["d:getlastmodified"],
          fileId: fileId,
          internalLink: fileId ? `${baseUrl}/index.php/f/${fileId}` : null,
        };
      })
      .filter((f) => f);
  },
};
