import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";

const envPath = new URL("../web/.env", import.meta.url);
let current = "";
try {
  current = await fs.readFile(envPath, "utf8");
} catch {}

const existing = current.match(/^GOOGLE_APPS_SCRIPT_SECRET=(.+)$/m)?.[1]?.trim();
const requestedEndpoint = process.argv[2]?.trim();
if (
  requestedEndpoint &&
  !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(requestedEndpoint)
) {
  throw new Error("The Apps Script URL must be an HTTPS /exec URL");
}
const endpoint =
  requestedEndpoint ??
  current.match(/^GOOGLE_APPS_SCRIPT_URL=(.*)$/m)?.[1]?.trim() ??
  "";
const secret = existing || randomBytes(32).toString("hex");

await fs.writeFile(
  envPath,
  `GOOGLE_APPS_SCRIPT_URL=${endpoint}\nGOOGLE_APPS_SCRIPT_SECRET=${secret}\n`,
  { mode: 0o600 },
);

console.log("API secret is ready in web/.env");
