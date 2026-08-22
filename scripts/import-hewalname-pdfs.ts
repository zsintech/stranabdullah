/**
 * Scrape PDF links from hewalname.com (Stran Abdullah, cat=109),
 * download them, upload to storage, and attach documentUrl to matching books.
 *
 * Usage:
 *   npx tsx scripts/import-hewalname-pdfs.ts
 *   npx tsx scripts/import-hewalname-pdfs.ts --dry-run
 *   npx tsx scripts/import-hewalname-pdfs.ts --download-only
 */
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
process.env.CONTENT_SOURCE ??= "firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { storeAdminUpload } from "@/lib/admin-upload";
import { getAdminContentRepository } from "@/repositories";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfDir = path.join(__dirname, "../data/book-pdfs");
const mapPath = path.join(__dirname, "../data/hewalname-pdf-map.json");

const AUTHOR_CATEGORY = "https://www.hewalname.com/ku/?cat=109";
const dryRun = process.argv.includes("--dry-run");
const downloadOnly = process.argv.includes("--download-only");

type HewalEntry = {
  postUrl: string;
  title: string;
  pdfs: Array<{ url: string; label: string }>;
};

type BookRow = { slug: string; title: string };

const TITLE_HINTS: Array<{ needles: string[]; slug: string; volumeKey?: string }> = [
  { needles: ["جدل", "دجلة"], slug: "book-jadal-kurdistani-2023" },
  { needles: ["مێخە", "سیاسەت"], slug: "book-mikhak-2013" },
  { needles: ["پێنجەم"], slug: "book-meseley-tutineke-5-2019", volumeKey: "5" },
  { needles: ["مەسەلەی", "توتنەکە", "٥"], slug: "book-meseley-tutineke-5-2019" },
  { needles: ["یەکەم"], slug: "book-meseley-tutineke-2011", volumeKey: "1" },
  { needles: ["مەسەلەی", "توتنەکە"], slug: "book-meseley-tutineke-2011" },
  { needles: ["یەکەم"], slug: "book-le-ghazetewe-2019", volumeKey: "1" },
  { needles: ["دووەم"], slug: "book-le-ghazetewe-2019", volumeKey: "2" },
  { needles: ["سێیەم"], slug: "book-le-ghazetewe-2019", volumeKey: "3" },
];

function normalize(text: string): string {
  return text
    .replace(/[\u0640\u200c\u200f]/g, "")
    .replace(/[كک]/g, "k")
    .replace(/[يیێ]/g, "y")
    .replace(/[أإآا]/g, "a")
    .replace(/[ةهەھ]/g, "h")
    .replace(/[ؤوۆ]/g, "w")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

function hintSlug(text: string): { slug: string; volumeKey?: string } | undefined {
  const n = normalize(text);
  for (const hint of TITLE_HINTS) {
    if (hint.needles.every((needle) => n.includes(normalize(needle))))
      return { slug: hint.slug, volumeKey: hint.volumeKey };
  }
  return undefined;
}

function scoreMatch(postTitle: string, bookTitle: string): number {
  const a = normalize(postTitle);
  const b = normalize(bookTitle);
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length);
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  let hits = 0;
  for (let i = 0; i < shorter.length - 8; i++) {
    const chunk = shorter.slice(i, i + 10);
    if (chunk.length >= 8 && longer.includes(chunk)) hits += 1;
  }
  return hits;
}

async function collectPostLinks(page: import("playwright").Page): Promise<string[]> {
  const links = new Set<string>();
  for (let paged = 1; paged <= 4; paged += 1) {
    const url = paged === 1 ? AUTHOR_CATEGORY : `${AUTHOR_CATEGORY}&paged=${paged}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const hrefs = await page.$$eval("article h2 a, .post h2 a, h2.entry-title a", (anchors) =>
      anchors.map((a) => (a as { href: string }).href).filter(Boolean),
    );
    for (const href of hrefs) links.add(href.split("#")[0]!);
    if (!hrefs.length) break;
  }
  return [...links];
}

async function extractPdfsFromPost(page: import("playwright").Page, postUrl: string): Promise<HewalEntry> {
  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(800);
  const title =
    (await page.locator("h1.entry-title, article h1, .post-title h1").first().textContent())?.trim() ||
    (await page.title()).split("–")[0]?.trim() ||
    postUrl;

  const pdfs = await page.$$eval("a[href]", (anchors) => {
    const out: Array<{ url: string; label: string }> = [];
    const seen = new Set<string>();
    for (const a of anchors) {
      const el = a as { href?: string; textContent?: string | null };
      const href = el.href;
      if (!href || seen.has(href)) continue;
      if (/\.pdf(\?|$)/i.test(href) || /wp-content\/uploads\/.*\.pdf/i.test(href)) {
        seen.add(href);
        out.push({ url: href, label: (el.textContent || "").trim() });
      }
    }
    return out;
  });

  return { postUrl, title, pdfs };
}

function pickBestBook(
  label: string,
  postTitle: string,
  books: BookRow[],
): { slug: string; score: number; volumeKey?: string } | null {
  const hinted = hintSlug(`${label} ${postTitle}`);
  if (hinted) return { slug: hinted.slug, score: 999, volumeKey: hinted.volumeKey };

  let best: { slug: string; score: number } | null = null;
  for (const book of books) {
    const score = Math.max(scoreMatch(label, book.title), scoreMatch(postTitle, book.title));
    if (!best || score > best.score) best = { slug: book.slug, score };
  }
  if (!best || best.score < 6) return null;
  return best;
}

async function downloadPdf(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) throw new Error(`File too small (${buffer.length} bytes)`);
  fs.writeFileSync(dest, buffer);
}

async function main() {
  fs.mkdirSync(pdfDir, { recursive: true });

  const repo = getAdminContentRepository();
  const books = (await repo.listAll({ type: "book" })).map((item) => ({
    slug: item.slug,
    title: item.title,
  }));

  console.log(`Loaded ${books.length} books from repository.`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "ckb-IQ",
  });
  const page = await context.newPage();

  console.log("Collecting Hewalname post links…");
  const postLinks = await collectPostLinks(page);
  console.log(`Found ${postLinks.length} posts.`);

  const entries: HewalEntry[] = [];
  for (const postUrl of postLinks) {
    try {
      const entry = await extractPdfsFromPost(page, postUrl);
      if (entry.pdfs.length) {
        entries.push(entry);
        console.log(`  PDF: ${entry.title.slice(0, 50)}… (${entry.pdfs.length} file(s))`);
      }
    } catch (error) {
      console.warn(`  skip ${postUrl}:`, error instanceof Error ? error.message : error);
    }
  }

  await browser.close();

  const mapping: Array<{
    slug: string;
    title: string;
    postUrl: string;
    pdfUrl?: string;
    volumes?: Array<{ key: string; label: string; pdfUrl: string }>;
    localFile?: string;
    uploadedUrl?: string;
  }> = [];

  const volumeUsed = new Set<string>();

  for (const entry of entries) {
    for (const pdf of entry.pdfs) {
      const match = pickBestBook(pdf.label || entry.title, entry.title, books);
      if (!match) {
        console.warn(`  no book match: ${entry.title} / ${pdf.label}`);
        continue;
      }

      const volumeKey =
        match.volumeKey ||
        (() => {
          const n = normalize(pdf.label);
          if (n.includes(normalize("یەکەم"))) return "1";
          if (n.includes(normalize("دووەم"))) return "2";
          if (n.includes(normalize("سێیەم"))) return "3";
          if (n.includes(normalize("چوارەم"))) return "4";
          if (n.includes(normalize("پێنجەم"))) return "5";
          return undefined;
        })();

      const dedupeKey = volumeKey ? `${match.slug}::${volumeKey}` : match.slug;
      if (volumeUsed.has(dedupeKey)) continue;
      volumeUsed.add(dedupeKey);

      const book = books.find((b) => b.slug === match.slug)!;
      let row = mapping.find((entryRow) => entryRow.slug === match.slug);
      if (!row) {
        row = {
          slug: match.slug,
          title: book.title,
          postUrl: entry.postUrl,
          volumes: [],
        };
        mapping.push(row);
      }

      if (volumeKey) {
        row.volumes ??= [];
        row.volumes.push({
          key: volumeKey,
          label: pdf.label || `بەرگی ${volumeKey}`,
          pdfUrl: pdf.url,
        });
        row.volumes.sort((a, b) => Number(a.key) - Number(b.key));
        if (!row.pdfUrl) row.pdfUrl = row.volumes[0]?.pdfUrl;
      } else {
        row.pdfUrl = pdf.url;
      }
    }
  }

  for (const row of mapping) {
    if (row.volumes?.length === 1) {
      row.pdfUrl = row.volumes[0]!.pdfUrl;
      delete row.volumes;
    }
  }

  fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
  console.log(`Mapped ${mapping.length} books → ${mapPath}`);

  if (dryRun) {
    console.log("Dry run — stopping before download/upload.");
    return;
  }

  let uploaded = 0;
  for (const row of mapping) {
    const downloads: Array<{ url: string; file: string }> = [];
    if (row.volumes?.length) {
      for (const vol of row.volumes) {
        const suffix = vol.key === row.volumes[0]?.key ? "" : `--${vol.key}`;
        downloads.push({ url: vol.pdfUrl, file: path.join(pdfDir, `${row.slug}${suffix}.pdf`) });
      }
    } else if (row.pdfUrl) {
      downloads.push({ url: row.pdfUrl, file: path.join(pdfDir, `${row.slug}.pdf`) });
    }

    try {
      for (const item of downloads) {
        console.log(`Downloading ${path.basename(item.file)}…`);
        await downloadPdf(item.url, item.file);
      }
      row.localFile = downloads[0]?.file;

      if (downloadOnly) continue;

      const primaryFile = downloads[0]?.file;
      if (!primaryFile) continue;
      const buffer = fs.readFileSync(primaryFile);
      const url = await storeAdminUpload({
        buffer,
        mimetype: "application/pdf",
        originalname: `${row.slug}.pdf`,
      });
      row.uploadedUrl = url;

      const item = (await repo.listAll({ type: "book" })).find((b) => b.slug === row.slug);
      if (!item) {
        console.warn(`  book gone: ${row.slug}`);
        continue;
      }

      await repo.update(
        item.id,
        {
          title: item.title,
          contentType: "book",
          documentUrl: url,
        },
        "import-hewalname-pdfs",
      );

      console.log(`  ok ${row.slug}`);
      uploaded += 1;
    } catch (error) {
      console.error(`  fail ${row.slug}:`, error instanceof Error ? error.message : error);
    }
  }

  fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
  console.log(`Done. uploaded=${uploaded}/${mapping.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
