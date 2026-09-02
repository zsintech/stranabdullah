/**
 * Upload local photos from public/brand/photos into Storage + Firestore drafts.
 *
 * Usage:
 *   npx tsx scripts/upload-photos.ts
 *   npx tsx scripts/upload-photos.ts --dry-run
 */
import "../src/load-env";
process.env.CONTENT_SOURCE = "firestore";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storeAdminUpload } from "@/lib/admin-upload";
import { kuDigits } from "@/lib/format";
import { allowedAdminEmails } from "@/lib/admin-session";
import { slugify } from "@/lib/slug";
import { getAdminContentRepository, isUsingSeedFallback } from "@/repositories";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const photosDir = path.join(__dirname, "../public/brand/photos");
const dryRun = process.argv.includes("--dry-run");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function mimeOf(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function photoSlug(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const wa = base.match(
    /^WhatsApp Image (\d{4}-\d{2}-\d{2}) at (\d+)\.(\d+)\.(\d+) (AM|PM)(?: \((\d+)\))?$/i,
  );
  if (wa) {
    const [, date, h, m, s, ampm, n] = wa;
    let hour = Number(h);
    if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
    const time = `${String(hour).padStart(2, "0")}${m}${s}`;
    return n ? `photo-${date}-${time}-${n}` : `photo-${date}-${time}`;
  }
  return slugify(`photo-${base}`);
}

async function main() {
  if (!fs.existsSync(photosDir)) {
    console.error(`Missing folder: ${photosDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(photosDir)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  if (!files.length) {
    console.error(`No image files in ${photosDir}`);
    process.exit(1);
  }

  const repo = getAdminContentRepository();
  if (isUsingSeedFallback()) {
    throw new Error("Firestore is not available; refusing to write photos into seed fallback.");
  }

  const actor = allowedAdminEmails()[0] || "upload-photos";
  const existing = await repo.listAll({ type: "photo" });
  const usedSlugs = new Set(existing.map((item) => item.slug));
  const usedCovers = existing
    .map((item) => `${item.media.coverImage?.cachedUrl || ""} ${item.media.coverImage?.remoteUrl || ""}`)
    .join("\n")
    .toLowerCase();

  console.log(`photos on disk: ${files.length}`);
  console.log(`photos already in CMS: ${existing.length}`);
  if (dryRun) console.log("[dry-run]");

  let uploaded = 0;
  let skipped = 0;
  let useStorage = !dryRun;

  for (const filename of files) {
    const slug = photoSlug(filename);
    const already =
      usedSlugs.has(slug) || usedCovers.includes(filename.toLowerCase().replace(/\s+/g, "_"));
    if (already || (filename === "salah-rashid.png" && existing.some((item) => /salah|سەڵاح|صلاح/i.test(`${item.slug} ${item.title}`)))) {
      console.log(`skip: ${filename} (${slug})`);
      skipped += 1;
      continue;
    }

    const n = uploaded + 1;
    const title = `وێنە ${kuDigits(n)}`;
    const localUrl = `/brand/photos/${filename.split("/").map(encodeURIComponent).join("/")}`;

    if (dryRun) {
      console.log(`[dry-run] ${filename} → ${slug} (${title})`);
      uploaded += 1;
      continue;
    }

    let url = localUrl;
    if (useStorage) {
      try {
        const buffer = fs.readFileSync(path.join(photosDir, filename));
        url = await storeAdminUpload({
          buffer,
          mimetype: mimeOf(filename),
          originalname: filename,
        });
      } catch (error) {
        useStorage = false;
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`Storage unavailable (${reason.split(".")[0]}). Using public/brand/photos URLs.`);
      }
    }

    const item = await repo.create(
      {
        slug,
        title,
        summary: "",
        contentType: "photo",
        language: "ku",
        status: "draft",
        tags: ["needs-caption"],
        coverUrl: url,
        coverAlt: title,
        homeGallery: false,
      },
      actor,
    );

    usedSlugs.add(item.slug);
    console.log(`ok: ${filename} → /admin/items/${item.id}`);
    uploaded += 1;
  }

  console.log(`done. uploaded=${uploaded} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
