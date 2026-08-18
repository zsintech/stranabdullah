const fs = require("fs");
const path = require("path");

function walkMaps(obj, out) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj.sources) && Array.isArray(obj.sourcesContent)) {
    for (let i = 0; i < obj.sources.length; i++) {
      if (obj.sources[i] && obj.sourcesContent[i])
        out.push([obj.sources[i], obj.sourcesContent[i]]);
    }
  }
  if (Array.isArray(obj.sections)) {
    for (const sec of obj.sections) if (sec?.map) walkMaps(sec.map, out);
  }
}

function collectMaps(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) collectMaps(p, list);
    else if (ent.name.endsWith(".map")) list.push(p);
  }
  return list;
}

const maps = ["d:/Stran/.next/dev", "d:/Stran/.next/server", "d:/Stran/.next/static"].flatMap(
  (r) => collectMaps(r),
);

const pageVersions = [];
const wanted = [
  "content-repository",
  "CategoryIndex",
  "HomeHero",
  "BotanicalPattern",
  "PortraitFrame",
  "package.json",
];
const hits = Object.fromEntries(wanted.map((w) => [w, []]));

for (const mapPath of maps) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  } catch {
    continue;
  }
  const pairs = [];
  walkMaps(json, pairs);
  const mtime = fs.statSync(mapPath).mtimeMs;
  for (const [src, content] of pairs) {
    let decoded = src;
    try {
      decoded = decodeURIComponent(src);
    } catch {}
    decoded = decoded.replace(/\\/g, "/");

    if (/src\/app\/page\.tsx/i.test(decoded)) {
      pageVersions.push({
        mtime,
        len: content.length,
        mapPath,
        hasHomeHero: content.includes("HomeHero"),
        hasArchiveStrip: content.includes("ArchiveStrip"),
        hasDiagonal: content.includes("diagonal-hero"),
        hasFeatureStory: content.includes("FeatureStory"),
        preview: content.slice(0, 200).replace(/\n/g, " "),
        content,
      });
    }

    for (const w of wanted) {
      if (decoded.includes(w) || content.includes(`export function ${w}`) || content.includes(`export type ${w}`) || content.includes(`export interface ${w}`)) {
        if (/src\//i.test(decoded) || w === "package.json") {
          hits[w].push({ decoded, len: content.length, mtime, mapPath });
        }
      }
    }

    // capture content-repository file
    if (/content-repository\.ts/i.test(decoded)) {
      hits["content-repository"].push({
        decoded,
        len: content.length,
        mtime,
        mapPath,
        content,
      });
    }
  }
}

pageVersions.sort((a, b) => b.mtime - a.mtime || b.len - a.len);
console.log("PAGE VERSIONS", pageVersions.length);
for (const v of pageVersions.slice(0, 12)) {
  console.log(
    new Date(v.mtime).toISOString(),
    "len=" + v.len,
    "HomeHero=" + v.hasHomeHero,
    "ArchiveStrip=" + v.hasArchiveStrip,
    "diagonal=" + v.hasDiagonal,
    "FeatureStory=" + v.hasFeatureStory,
  );
}

// Prefer latest with HomeHero+ArchiveStrip, else latest with HomeHero, else longest non-diagonal
let pick =
  pageVersions.find((v) => v.hasHomeHero && v.hasArchiveStrip) ||
  pageVersions.find((v) => v.hasHomeHero && v.hasFeatureStory) ||
  pageVersions.find((v) => v.hasHomeHero) ||
  pageVersions.sort((a, b) => b.len - a.len)[0];

if (pick) {
  fs.writeFileSync("d:/Stran/src/app/page.tsx", pick.content, "utf8");
  console.log("Wrote page.tsx len", pick.len, "HomeHero", pick.hasHomeHero, "ArchiveStrip", pick.hasArchiveStrip);
}

// content-repository
const cr = hits["content-repository"]
  .filter((h) => h.content)
  .sort((a, b) => b.len - a.len)[0];
if (cr) {
  fs.mkdirSync("d:/Stran/src/repositories", { recursive: true });
  fs.writeFileSync("d:/Stran/src/repositories/content-repository.ts", cr.content, "utf8");
  console.log("Wrote content-repository.ts len", cr.len);
} else {
  console.log("content-repository not found in maps");
}

console.log("hit counts", Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])));
