#!/usr/bin/env node

import fs from "node:fs";

// Load .env file
const envPath = ".env";
let url, user, token;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.substring(0, idx).trim();
      const value = trimmed.substring(idx + 1).trim();
      if (key === "NEXTCLOUD_URL") url = value;
      if (key === "NEXTCLOUD_USER") user = value;
      if (key === "NEXTCLOUD_TOKEN") token = value;
    }
  }
}

if (!url || !token) {
  console.error("Missing NEXTCLOUD_URL or NEXTCLOUD_TOKEN in .env file");
  process.exit(1);
}

const authHeader =
  "Basic " + Buffer.from(`${user}:${token}`).toString("base64");

async function checkEndpoints() {
  console.log(`Checking API versions for: ${url}`);
  console.log(`User: ${user}`);
  console.log("");

  // List of endpoints to test
  const endpoints = [
    "/ocs/v1.php/cloud/version",
    "/ocs/v1.php/apps/files",
    "/ocs/v2.php/cloud/version",
    "/ocs/v2.php/cloud/apps",
    "/ocs/v2.php/apps/files",
    "/ocs/v2.php/apps/files_sharing/api/v1/shares",
    "/ocs/v2.php/apps/spreed/api/v4/room",
    "/ocs/v2.php/apps/spreed/api/v4/room/list",
    "/ocs/v2.php/apps/spreed/api/v1/chat",
    "/ocs/v2.php/apps/spreed/api/v1/chat/list",
    "/ocs/v2.php/apps/spreed/api/v4/settings/conversation/test",
    "/ocs/v2.php/apps/spreed/api/v1/settings/conversation/test",
    "/ocs/v2.php/apps/spreed/api/v4/room/test",
    "/ocs/v2.php/apps/spreed/api/v1/room/test",
    "/remote.php/dav/files/",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${url}${endpoint}`, {
        headers: { "OCS-APIRequest": "true", Authorization: authHeader },
      });
      const contentType = response.headers.get("content-type") || "";
      let preview = "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        preview = JSON.stringify(data).substring(0, 100);
      } else {
        const text = await response.text();
        preview = text.substring(0, 200);
      }

      const status =
        response.status >= 200 && response.status < 300 ? "✓" : "✗";
      console.log(`${status} ${response.status} ${endpoint}`);
      if (preview) {
        console.log(`   ${preview.replace(/\n/g, " ")}...`);
      }
    } catch (error) {
      console.log(`✗ ERROR ${endpoint}`);
      console.log(`   ${error.message}`);
    }
  }
}

checkEndpoints();
