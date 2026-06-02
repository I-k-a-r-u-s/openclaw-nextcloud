import fs from "node:fs";
import process from "node:process";

function loadEnv() {
  const envPath = ".env";
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const idx = trimmed.indexOf("=");
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

export const CONFIG = {
  url: process.env.NEXTCLOUD_URL,
  user: process.env.NEXTCLOUD_USER,
  token: process.env.NEXTCLOUD_TOKEN,
};

export function validateConfig() {
  if (!CONFIG.url || !CONFIG.user || !CONFIG.token) {
    console.error(
      JSON.stringify({
        status: "error",
        message:
          "Missing configuration. Set NEXTCLOUD_URL, NEXTCLOUD_USER, and NEXTCLOUD_TOKEN.",
      }),
    );
    process.exit(1);
  }

  const parsed = (() => {
    try {
      return new URL(CONFIG.url);
    } catch {
      return null;
    }
  })();

  if (!parsed) {
    console.error(
      JSON.stringify({
        status: "error",
        message: `Invalid NEXTCLOUD_URL: '${CONFIG.url}'`,
      }),
    );
    process.exit(1);
  }

  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";

  if (
    parsed.protocol !== "https:" &&
    !isLocalhost &&
    process.env.OPENCLAW_ALLOW_HTTP !== "1"
  ) {
    console.error(
      JSON.stringify({
        status: "error",
        message: `Refusing to send credentials over '${parsed.protocol}//' to '${parsed.host}'. Use https:// or set OPENCLAW_ALLOW_HTTP=1 to override (not recommended).`,
      }),
    );
    process.exit(1);
  }
}

export const AUTH_HEADER =
  "Basic " + Buffer.from(`${CONFIG.user}:${CONFIG.token}`).toString("base64");
