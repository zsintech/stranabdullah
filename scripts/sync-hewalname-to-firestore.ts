/**
 * Push Hewalname PDF proxy URLs into Firestore book records.
 * Run after import-hewalname-pdfs.ts --download-only
 */
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
process.env.CONTENT_SOURCE ??= "firestore";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminContentRepository } from "@/repositories";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapPath = path.join(__dirname, "../data/hewalname-pdf-map.json");

async function main() {
  if (!fs.existsSync(mapPath)) {
    console.error("Missing map file. Run: npx tsx scripts/import-hewalname-pdfs.ts --download-only");
    process.exit(1);
  }

  const mapping = JSON.parse(fs.readFileSync(mapPath, "utf8")) as Array<{
    slug: string;
    pdfUrl: string;
  }>;

  const repo = getAdminContentRepository();
  const books = await repo.listAll({ type: "book" });

  for (const row of mapping) {
    const item = books.find((b) => b.slug === row.slug);
    if (!item) {
      console.warn(`skip missing book: ${row.slug}`);
      continue;
    }

    const pdfUrl = row.pdfUrl.replace(/^http:/, "https:");
    await repo.update(
      item.id,
      {
        title: item.title,
        contentType: "book",
        documentUrl: `/media/books/${row.slug}.pdf`,
      },
      "sync-hewalname-pdfs",
    );

    // Patch hewalname source URL via direct firestore update would need schema change.
    // Store remote in documentUrl fallback handled by media route reading map file.
    console.log(`ok ${row.slug} → /media/books/${row.slug}.pdf`);
  }

  fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
  console.log(`Synced ${mapping.length} books.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
