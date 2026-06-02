import { XMLParser } from "fast-xml-parser";
import { CONFIG, AUTH_HEADER } from "./config.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function request(endpoint, options = {}) {
  const url = new URL(endpoint, CONFIG.url).toString();
  const headers = {
    Authorization: AUTH_HEADER,
    "User-Agent": "OpenClaw-Nextcloud-Skill",
    ...options.headers,
  };

  if (endpoint.startsWith("/ocs/") || endpoint.includes("/spreed/api/")) {
    headers["OCS-APIRequest"] = "true";
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      // Node 22+ fetch strips Authorization on cross-origin redirects by default
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      let bodyText;
      try {
        bodyText = await response.text();
      } catch {
        bodyText = "(could not read response body)";
      }
      const err = new Error(
        `HTTP ${response.status}: ${response.statusText}\nResponse: ${bodyText.substring(0, 500)}${bodyText.length > 500 ? "..." : ""}`,
      );
      err.status = response.status;
      err.responseBody = bodyText;
      throw err;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else if (contentType && contentType.includes("xml")) {
      const text = await response.text();
      return parser.parse(text);
    } else {
      return await response.text();
    }
  } catch (error) {
    const wrapped = new Error(`Request failed: ${error.message}`);
    if (error.status !== undefined) wrapped.status = error.status;
    if (error.responseBody !== undefined)
      wrapped.responseBody = error.responseBody;
    throw wrapped;
  }
}

export async function fetchRaw(endpoint, options = {}) {
  const url = new URL(endpoint, CONFIG.url).toString();
  const headers = {
    Authorization: AUTH_HEADER,
    "User-Agent": "OpenClaw-Nextcloud-Skill",
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
}
