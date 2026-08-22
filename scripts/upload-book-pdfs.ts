/**
 * Upload local PDFs to storage and attach documentUrl to book records.
 *
 * Place files as: data/book-pdfs/{slug}.pdf
 * Example: data/book-pdfs/book-mikhak-2013.pdf
 *
 * Usage:
 *   npx tsx scripts/upload-book-pdfs.ts
 *   npx tsx scripts/upload-book-pdfs.ts --dry-run
 */
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
process.env.CONTENT_SOURCE ??= "firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storeAdminUpload } from "@/lib/admin-upload";
import { getAdminContentRepository } from "@/repositories";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfDir = path.join(__dirname, "../data/book-pdfs");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!fs.existsSync(pdfDir)) {
    console.error(`Missing folder: ${pdfDir}`);
    console.error("Create it and add PDFs named {slug}.pdf");
    process.exit(1);
  }

  const files = fs.readdirSync(pdfDir).filter((name) => name.toLowerCase().endsWith(".pdf"));
  if (!files.length) {
    console.error(`No PDF files in ${pdfDir}`);
    process.exit(1);
  }

  const repo = getAdminContentRepository();
  let uploaded = 0;
  let skipped = 0;

  for (const filename of files) {
    const slug = filename.replace(/\.pdf$/i, "");
    const buffer = fs.readFileSync(path.join(pdfDir, filename));
    const items = await repo.listAll({ type: "book" });
    const item = items.find((entry) => entry.slug === slug);
    if (!item) {
      console.warn(`skip: no book with slug "${slug}"`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would upload ${filename} → ${item.title}`);
      uploaded += 1;
      continue;
    }

    const url = await storeAdminUpload({
      buffer,
      mimetype: "application/pdf",
      originalname: filename,
    });

    await repo.update(
      item.id,
      {
        title: item.title,
        contentType: item.contentType,
        documentUrl: url,
      },
      "upload-book-pdfs",
    );

    console.log(`ok: ${slug} → ${url}`);
    uploaded += 1;
  }

  console.log(`done. uploaded=${uploaded} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
