/**
 * Post a photo through the admin UI (Playwright) — same flow as a human admin.
 *
 * Usage:
 *   ADMIN_E2E_PASSWORD='...' npx tsx scripts/admin-post-photo.ts
 *   ADMIN_E2E_URL=http://localhost:3001 ADMIN_E2E_PASSWORD='...' npx tsx scripts/admin-post-photo.ts
 */
import "../src/load-env";

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { allowedAdminEmails } from "@/lib/admin-session";

const baseUrl = (process.env.ADMIN_E2E_URL || "http://localhost:3001").replace(/\/$/, "");
const password = process.env.ADMIN_E2E_PASSWORD;
const email = process.env.ADMIN_E2E_EMAIL || allowedAdminEmails()[0];
const imagePath =
  process.env.ADMIN_E2E_IMAGE ||
  path.join(process.cwd(), "data/upload-test/salah-rashid.png");
const title =
  process.env.ADMIN_E2E_TITLE ||
  "لەگەڵ سەڵاح رەشید، وەزیری مافی مرۆڤ";
const summary =
  process.env.ADMIN_E2E_SUMMARY ||
  "لەگەڵ برای بەڕێز سەڵاح رەشید وەزیری مافی مرۆڤ لە کابینەی سێیەمی حکومەتی هەرێم";

async function main() {
  if (!email) throw new Error("ADMIN_ALLOWED_EMAILS is not set.");
  if (!password) throw new Error("Set ADMIN_E2E_PASSWORD for login.");
  if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);

  console.log(`Admin E2E → ${baseUrl}`);
  console.log(`Email: ${email}`);
  console.log(`Image: ${imagePath}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${baseUrl}/admin/login?next=/admin/items/new?type=photo`, {
    waitUntil: "networkidle",
  });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/items\/new/, { timeout: 20000 });

  await page.fill("#title", title);
  await page.fill("#summary", summary);
  await page.setInputFiles("#cover", imagePath);

  const statusPublished = page.locator('input[name="status"][value="published"]');
  if (await statusPublished.isVisible()) await statusPublished.check();

  await page.click('button[name="intent"][value="publish"]');
  await page.waitForTimeout(3000);

  const url = page.url();
  const flash = (await page.locator(".admin-flash").first().textContent().catch(() => "")) || "";
  const failed = url.includes("/items/new") || flash.includes("سەرکەوتوو نەبوو") || flash.includes("bucket");
  if (failed) {
    console.error(`\nUpload failed. URL: ${url}`);
    console.error(`Flash: ${flash.trim()}`);
    await browser.close();
    process.exit(1);
  }

  await page.waitForURL(/\/admin\/items\/[^/]+$/, { timeout: 60000 }).catch(() => undefined);
  console.log(`\nSaved: ${page.url()}`);
  if (flash) console.log(`Flash: ${flash.trim()}`);

  await browser.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
