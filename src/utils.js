import process from "node:process";

export function output(data) {
  console.log(
    JSON.stringify(
      {
        status: "success",
        data,
      },
      null,
      2,
    ),
  );
}

export function errorOutput(message) {
  const errorObj = {
    status: "error",
    message: message.message || String(message),
  };

  if (message.responseBody) {
    errorObj.responseBody = message.responseBody;
  }

  if (message.status) {
    errorObj.httpStatus = message.status;
  }

  console.error(JSON.stringify(errorObj, null, 2));
  process.exit(1);
}

export function ensureArray(item) {
  if (Array.isArray(item)) return item;
  if (item === undefined || item === null) return [];
  return [item];
}

export function matchByName(items, name) {
  if (!name) return null;
  const exact = items.find((i) => i.displayname === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  const ci = items.find(
    (i) => i.displayname && i.displayname.toLowerCase() === lower,
  );
  if (ci) return ci;
  const slug = lower
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .pop();
  if (slug) {
    const bySlug = items.find((i) => {
      const itemSlug = (i.url || "")
        .replace(/\/+$/, "")
        .split("/")
        .filter(Boolean)
        .pop();
      return itemSlug && itemSlug.toLowerCase() === slug;
    });
    if (bySlug) return bySlug;
  }
  return (
    items.find(
      (i) =>
        i.url &&
        (i.url === name || i.url.endsWith(name) || name.endsWith(i.url)),
    ) || null
  );
}

export function parseDateInput(str) {
  const compact = String(str).match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/,
  );
  if (compact) {
    const [, y, mo, d, h = "00", mi = "00", s = "00", z = ""] = compact;
    const month = parseInt(mo, 10);
    const day = parseInt(d, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(
        `Invalid date '${str}'. Use ISO 8601 (2026-04-15T17:00:00Z) or CalDAV compact format (20260415T170000Z).`,
      );
    }
    const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${z}`);
    if (!isNaN(date.getTime())) return date;
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date '${str}'. Use ISO 8601 (2026-04-15T17:00:00Z) or CalDAV compact format (20260415T170000Z).`,
    );
  }
  return date;
}

export function xmlEscape(str) {
  return String(str).replace(/[&<>"']/g, (c) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return map[c];
  });
}

export function icalEscape(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function vcardEscape(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function formatCalDavDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
