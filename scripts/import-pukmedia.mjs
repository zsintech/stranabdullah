/**
 * Import Stran Abdullah byline pieces from PUKmedia ArticleDetails pages.
 * Skips news-about pieces on /Details/ — only curated ArticleDetails IDs.
 *
 * Usage: node scripts/import-pukmedia.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../src/data/demo-content.json");

const UA = "StranArchiveBot/1.0 (+personal archive import of public bylines)";
const DELAY_MS = 500;

/** Curated ArticleDetails IDs where author is ستران عەبدوڵڵا */
const ARTICLE_IDS = [
  212497, // هێشتا سەردەم لەگەڵ سەردەمەکە ئەڕوا
  212463, // یادکردنی محەمەد مەنگوڕی / حزبایەتی
  212358, // کوردایەتی واتا حزبایەتی (2026-06-11)
  212317, // کوردایەتی واتا حزبایەتی (2026-06-08)
  201369, // لەگەڵ میللەتەكەمان بەشی ناكەین…
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decode(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function slugify(id, title) {
  const base = title
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `pukmedia-${id}-${base || "article"}`.toLowerCase();
}

async function fetchArticle(id) {
  const url = `https://www.pukmedia.com/KS/ArticleDetails/${id}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();

  const start = html.indexOf('class="detailright"');
  const end = html.indexOf('class="detailleft"');
  if (start < 0) throw new Error(`No detailright for ${id}`);
  const chunk = html.slice(start, end > start ? end : start + 20000);
  const lines = stripTags(chunk).filter((l) => !/^class=/.test(l) && l !== "div");

  const title = lines[0] || "";
  const dateLine = lines.find((l) => /\d{4}-\d{2}-\d{2}/.test(l)) || "";
  const dateMatch = dateLine.match(/(\d{4}-\d{2}-\d{2})/);
  const isStranLine = (l) => /^ستران\s+عەبدو/.test(l);
  const authorIdx = lines.findIndex(isStranLine);
  const author = authorIdx >= 0 ? lines[authorIdx] : "";

  if (!author) {
    return { id, url, skip: true, reason: "author not Stran (missing)" };
  }

  // Body starts after the last consecutive author line following the date.
  let bodyStart = authorIdx + 1;
  while (bodyStart < lines.length && isStranLine(lines[bodyStart])) {
    bodyStart++;
  }
  let bodyLines = lines.slice(bodyStart).filter((l) => !/^PUKMEDIA$/i.test(l));
  // Drop trailing sidebar noise if any leaked
  const cut = bodyLines.findIndex((l) => /هەواڵی زیاتر|زۆرترین خوێنراو/.test(l));
  if (cut >= 0) bodyLines = bodyLines.slice(0, cut);

  const body = bodyLines.join("\n\n").trim();
  if (!title || body.length < 80) {
    return { id, url, skip: true, reason: "thin body" };
  }

  const year = dateMatch ? Number(dateMatch[1].slice(0, 4)) : undefined;
  const publishedAt = dateMatch ? `${dateMatch[1]}T12:00:00.000Z` : new Date().toISOString();

  return {
    id: `pukmedia-${id}`,
    url,
    title,
    body,
    summary: bodyLines[0]?.slice(0, 220) || title,
    year,
    publishedAt,
    skip: false,
  };
}

const now = new Date().toISOString();
const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const byId = new Set(existing.map((i) => i.id));
const byUrl = new Set(
  existing.map((i) => i.source?.externalUrl).filter(Boolean),
);

let added = 0;
let skipped = 0;

for (const articleId of ARTICLE_IDS) {
  await sleep(DELAY_MS);
  try {
    const item = await fetchArticle(articleId);
    if (item.skip) {
      console.log("skip", articleId, item.reason);
      skipped++;
      continue;
    }
    if (byId.has(item.id) || byUrl.has(item.url)) {
      console.log("exists", item.id);
      skipped++;
      continue;
    }
    existing.push({
      id: item.id,
      slug: slugify(articleId, item.title),
      title: item.title,
      summary: item.summary,
      body: item.body,
      bodyFormat: "plain",
      contentType: "opinion",
      language: "ku",
      status: "published",
      publishedAt: item.publishedAt,
      year: item.year,
      topics: ["بیروڕا"],
      tags: ["pukmedia"],
      people: [],
      featured: false,
      source: {
        platform: "pukmedia",
        externalUrl: item.url,
        imported: true,
        importedAt: now,
      },
      media: { images: [] },
      audit: { createdAt: now, updatedAt: now },
      extras: {
        author: "هەڤاڵ ستران عەبدوڵڵا",
        outlet: "PUKmedia",
        isDemo: true,
      },
    });
    byId.add(item.id);
    byUrl.add(item.url);
    added++;
    console.log("+", item.title.slice(0, 70));
  } catch (err) {
    console.error("fail", articleId, err.message);
    skipped++;
  }
}

existing.sort((a, b) => {
  const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  return db - da || String(b.id).localeCompare(String(a.id));
});

fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
const jsPath = path.join(__dirname, "../src/data/demo-content.js");
if (fs.existsSync(jsPath)) {
  fs.writeFileSync(jsPath, `export default ${JSON.stringify(existing, null, 2)};\n`, "utf8");
}

console.log(`Done. added=${added} skipped=${skipped} total=${existing.length}`);
