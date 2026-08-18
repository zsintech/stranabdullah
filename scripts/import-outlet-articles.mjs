/**
 * Import publicly published articles from zhyan.co / marsaddaily.com
 * for Stran's byline pages. Does NOT touch Facebook.
 *
 * Usage: node scripts/import-outlet-articles.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "src/data/demo-content.json");

const UA = "StranArchiveBot/1.0 (+https://localhost; personal archive import of public bylines)";
const DELAY_MS = 450;

const OUTLETS = [
  {
    key: "zhyan",
    host: "https://zhyan.co",
    authorId: 196,
    language: "ku",
    outletLabel: "ژیان",
    platform: "zhyan",
  },
  {
    key: "marsad",
    host: "https://marsaddaily.com",
    authorId: 26,
    language: "ar",
    outletLabel: "المرصد",
    platform: "marsad",
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, init = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      ...(init.headers || {}),
    },
    redirect: "follow",
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function hidden(html, name) {
  const re = new RegExp(
    `<input[^>]+name=["']${name}["'][^>]+value=["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1] : "";
}

function pagerTargets(html) {
  const decoded = html.replace(/&#39;/g, "'");
  const targets = [];
  const re = /__doPostBack\(\s*'([^']+)'\s*,\s*''\s*\)/gi;
  let m;
  while ((m = re.exec(decoded))) {
    if (/DataPager/i.test(m[1])) targets.push(m[1]);
  }
  return [...new Set(targets)];
}

async function postback(url, html, eventTarget) {
  const body = new URLSearchParams({
    __EVENTTARGET: eventTarget,
    __EVENTARGUMENT: "",
    __VIEWSTATE: hidden(html, "__VIEWSTATE"),
    __VIEWSTATEGENERATOR: hidden(html, "__VIEWSTATEGENERATOR"),
    __VIEWSTATEENCRYPTED: hidden(html, "__VIEWSTATEENCRYPTED"),
    __EVENTVALIDATION: hidden(html, "__EVENTVALIDATION"),
  });
  return fetchText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: url,
      Origin: new URL(url).origin,
    },
    body,
  });
}

function decodeHtml(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ");
}

function stripTags(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function extractArticleIds(html, authorId) {
  const ids = new Set();
  const re = /Article_Detail\.aspx\?([^"'>\s]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const qs = m[1];
    const aid = Number((qs.match(/authorid=(\d+)/i) || [])[1] || 0);
    const art = Number((qs.match(/Articleid=(\d+)/i) || [])[1] || 0);
    if (aid === authorId && art) ids.add(art);
  }
  return [...ids].sort((a, b) => a - b);
}

function parseDate(text) {
  // dd/mm/yyyy or d/m/yyyy
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T12:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { iso, year: Number(yyyy) };
}

function parseArticle(html, outlet, articleId) {
  const authorNeedles =
    outlet.language === "ar"
      ? ["ستران عبدالله", "ستران عبد الله", "ستران عەبدوڵڵا"]
      : ["ستران عەبدوڵڵا", "ستران عبدالله"];
  const hasAuthor =
    html.includes(`authorid=${outlet.authorId}`) ||
    authorNeedles.some((n) => html.includes(n));
  if (!hasAuthor) return null;

  // These ASP templates put the headline in <h2> and body in .articleclsd
  let title = "";
  const h2 = html.match(/<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/i);
  if (h2) title = stripTags(h2[1]).replace(/\s+/g, " ").trim();
  if (!title) {
    const h =
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
      html.match(/<title[^>]*>\s*([^|<]+)/i);
    if (h) title = stripTags(h[1]).replace(/\s+/g, " ").trim();
  }
  title = title.replace(/^(ژیان|المرصد)\s*[|\-–]?\s*/i, "").trim();
  if (!title || title.length < 3) return null;

  const date = parseDate(html);

  let bodyHtml = "";
  const bodyMatch =
    html.match(/<div class="articleclsd">([\s\S]*?)<\/div>/i) ||
    html.match(/class="articleclsd"[^>]*>([\s\S]*?)<\/div>/i);
  if (bodyMatch) bodyHtml = bodyMatch[1];

  let body = stripTags(bodyHtml || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (body.length < 40) {
    const plainFull = stripTags(html);
    const idx = plainFull.indexOf(title);
    if (idx >= 0) {
      body = plainFull
        .slice(idx + title.length, idx + title.length + 6000)
        .split(/بابەتەکانی تری|مواضيع أخرى|دوایین هەواڵ|آخر الأخبار/i)[0]
        .replace(new RegExp(`^(${authorNeedles.join("|")})\\s*`, "i"), "")
        .replace(/^نووسەر\s*/i, "")
        .replace(/^كاتب\s*/i, "")
        .replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s*/i, "")
        .replace(/^\d+\s*جار خوێندراوەتەوە\s*/i, "")
        .replace(/^\d+\s*مرة قراءة\s*/i, "")
        .trim();
    }
  }

  if (body.length < 40) return null;

  const summary = body.replace(/\s+/g, " ").slice(0, 180).trim() + (body.length > 180 ? "…" : "");
  const now = new Date().toISOString();
  const id = `${outlet.key}-${articleId}`;

  return {
    id,
    slug: id,
    title,
    summary,
    body,
    bodyFormat: "plain",
    contentType: "article",
    language: outlet.language,
    status: "published",
    publishedAt: date?.iso,
    year: date?.year,
    topics: [],
    tags: [],
    people: [],
    featured: false,
    source: {
      platform: outlet.platform,
      externalId: String(articleId),
      externalUrl: `${outlet.host}/Article_Detail.aspx?authorid=${outlet.authorId}&Articleid=${articleId}`,
      imported: true,
      importedAt: now,
    },
    media: { images: [] },
    audit: { createdAt: now, updatedAt: now },
    extras: {
      author: "هەڤاڵ ستران عەبدوڵڵا",
      outlet: outlet.outletLabel,
      isDemo: true,
    },
  };
}

async function discoverIds(outlet) {
  const authorUrl = `${outlet.host}/Author.aspx?authorid=${outlet.authorId}`;
  let html = await fetchText(authorUrl);
  const ids = new Set(extractArticleIds(html, outlet.authorId));
  const visitedTargets = new Set();

  // Walk ASP.NET DataPager pages until no new article ids
  for (let guard = 0; guard < 60; guard++) {
    const targets = pagerTargets(html).filter((t) => !visitedTargets.has(t));
    // Prefer explicit "next" (ctl02$ctl00), else first unseen numeric page
    const next =
      targets.find((t) => /DataPager1\$ctl02\$ctl00$/i.test(t)) ||
      targets.find((t) => /DataPager1\$ctl01\$ctl\d+$/i.test(t));
    if (!next) break;
    visitedTargets.add(next);
    await sleep(DELAY_MS);
    try {
      html = await postback(authorUrl, html, next);
    } catch (e) {
      console.warn(`pager failed ${outlet.key}:`, e.message);
      break;
    }
    const before = ids.size;
    for (const id of extractArticleIds(html, outlet.authorId)) ids.add(id);
    console.log(`  page hop -> ${ids.size} ids`);
    if (ids.size === before) break;
  }

  // Sidebar crawl from newest seeds
  const seeds = [...ids].sort((a, b) => b - a).slice(0, 10);
  for (const id of seeds) {
    await sleep(DELAY_MS);
    try {
      const page = await fetchText(
        `${outlet.host}/Article_Detail.aspx?authorid=${outlet.authorId}&Articleid=${id}`,
      );
      for (const found of extractArticleIds(page, outlet.authorId)) ids.add(found);
    } catch {
      /* skip */
    }
  }
  return [...ids].sort((a, b) => a - b);
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const byUrl = new Set(
    existing.map((i) => i.source?.externalUrl).filter(Boolean),
  );
  const byId = new Set(existing.map((i) => i.id));

  const added = [];
  const skipped = [];
  const failed = [];

  for (const outlet of OUTLETS) {
    console.log(`\n== ${outlet.key}: discovering public byline articles ==`);
    let ids = [];
    try {
      ids = await discoverIds(outlet);
    } catch (e) {
      console.error(`discover failed for ${outlet.key}:`, e.message);
      continue;
    }
    console.log(`found ${ids.length} article ids`);

    for (const articleId of ids) {
      const url = `${outlet.host}/Article_Detail.aspx?authorid=${outlet.authorId}&Articleid=${articleId}`;
      const id = `${outlet.key}-${articleId}`;
      if (byUrl.has(url) || byId.has(id)) {
        skipped.push(id);
        continue;
      }
      await sleep(DELAY_MS);
      try {
        const html = await fetchText(url);
        const item = parseArticle(html, outlet, articleId);
        if (!item) {
          failed.push({ id, reason: "parse" });
          continue;
        }
        existing.push(item);
        byUrl.add(url);
        byId.add(id);
        added.push(id);
        console.log(`+ ${id}  ${item.title.slice(0, 60)}`);
      } catch (e) {
        failed.push({ id, reason: e.message });
      }
    }
  }

  // Stable-ish sort: newest first when dates exist
  existing.sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da || String(b.id).localeCompare(String(a.id));
  });

  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2) + "\n", "utf8");

  // Keep .js mirror if present
  const jsPath = path.join(root, "src/data/demo-content.js");
  if (fs.existsSync(jsPath)) {
    fs.writeFileSync(
      jsPath,
      `export default ${JSON.stringify(existing, null, 2)};\n`,
      "utf8",
    );
  }

  console.log("\nDone.");
  console.log(`added=${added.length} skipped=${skipped.length} failed=${failed.length} total=${existing.length}`);
  if (failed.length) console.log("failed sample", failed.slice(0, 12));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
