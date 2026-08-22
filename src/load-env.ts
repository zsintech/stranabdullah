import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const root = process.cwd();

/** Preserve vars already set in the shell (e.g. CONTENT_SOURCE=seed npm run dev). */
const fromShell = { ...process.env };

for (const file of [".env", ".env.local"]) {
  const filePath = path.join(root, file);
  if (existsSync(filePath)) {
    dotenv.config({ path: filePath, override: file === ".env.local", quiet: true });
  }
}

for (const [key, value] of Object.entries(fromShell)) {
  if (value !== undefined) process.env[key] = value;
}
