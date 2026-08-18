const fs = require("fs");
const path = require("path");

function walkMaps(obj, out) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj.sources) && Array.isArray(obj.sourcesContent)) {
    for (let i = 0; i < obj.sources.length; i++) {
      const src = obj.sources[i];
      const content = obj.sourcesContent[i];
      if (src && content) out.push([src, content]);
    }
  }
  if (Array.isArray(obj.sections)) {
    for (const sec of obj.sections) if (sec && sec.map) walkMaps(sec.map, out);
  }
}

function isStub(content, rel) {
  if (/Create Next App|To get started, edit the|vercel\.com\/templates/.test(content))
    return true;
  if (/Geist_Mono/.test(content) && /layout/.test(rel)) return true;
  return false;
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

const ALLOWED_LIB = new Set([
  "archive-facets.ts",
  "archive-labels.ts",
  "constants.ts",
  "content-labels.ts",
  "env.ts",
  "error-telemetry-utils.ts",
  "format.ts",
]);

const roots = [
  path.join("d:/Stran/.next/dev"),
  path.join("d:/Stran/.next/server"),
  path.join("d:/Stran/.next/static"),
];
const maps = roots.flatMap((r) => collectMaps(r));
console.log("Scanning", maps.length, "maps");

const best = new Map();

for (const mapPath of maps) {
  let json;
  try {
    json = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  } catch {
    continue;
  }
  const pairs = [];
  walkMaps(json, pairs);
  for (const [src, content] of pairs) {
    let decoded = src;
    try {
      decoded = decodeURIComponent(src);
    } catch {
      /* keep */
    }
    decoded = decoded.replace(/^file:\/\/\//, "").replace(/^file:\/\//, "");
    decoded = decoded.replace(/\\/g, "/");
    const fileMatch = decoded.match(/^(.*?\/(?:src\/.+?\.(?:tsx?|jsx?|css|json)))/i);
    if (!fileMatch) continue;
    decoded = fileMatch[1];

    let rel = null;
    let mm = decoded.match(/\/Stran\/(src\/.+)$/i);
    if (mm) rel = mm[1];
    else {
      mm = decoded.match(
        /(src\/(?:app|components|lib|styles|data|types|repositories|server)\/.+)$/i,
      );
      if (mm) rel = mm[1];
    }
    if (!rel) continue;

    if (/node_modules|\.next|structured image|favicon\.ico/i.test(rel)) continue;
    if (!/\.(tsx?|jsx?|css|json)$/.test(rel)) continue;

    // Drop Next.js internals accidentally nested under src/
    if (rel.startsWith("src/server/") && !rel.startsWith("src/server/auth/")) continue;
    if (rel.startsWith("src/lib/")) {
      const base = rel.slice("src/lib/".length);
      if (!ALLOWED_LIB.has(base) && !base.startsWith("firebase")) continue;
    }

    if (isStub(content, rel)) continue;

    const len = content.length;
    const prev = best.get(rel);
    if (!prev || len > prev.len) best.set(rel, { content, len });
  }
}

console.log("Unique files:", best.size);
for (const rel of [...best.keys()].sort()) {
  console.log(String(best.get(rel).len).padStart(7), rel);
}

let written = 0;
for (const [rel, { content }] of best) {
  const dest = path.join("d:/Stran", rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, "utf8");
  written++;
}
console.log("Wrote", written);

const layout = fs.readFileSync("d:/Stran/src/app/layout.tsx", "utf8");
const title = layout.match(/default:\s*"([^"]+)"/);
console.log("layout title:", title && title[1]);
const hero = fs.readFileSync("d:/Stran/src/components/home/HomeHero.tsx", "utf8");
const alt = hero.match(/PORTRAIT_ALT\s*=\s*"([^"]+)"/);
console.log("hero alt:", alt && alt[1]);
const header = fs.readFileSync("d:/Stran/src/components/layout/SiteHeader.tsx", "utf8");
const link = header.match(/label:\s*"([^"]+)"/);
console.log("header first label:", link && link[1]);
