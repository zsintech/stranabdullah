import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const root = process.cwd();

for (const file of [".env", ".env.local"]) {
  const filePath = path.join(root, file);
  if (existsSync(filePath)) {
    dotenv.config({ path: filePath, override: file === ".env.local", quiet: true });
  }
}
