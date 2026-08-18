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

const heroVersions = [];
const identityVersions = [];
const repoInterfaceVersions = [];

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

    if (/src\/components\/home\/HomeHero\.tsx/i.test(decoded)) {
      heroVersions.push({
        mtime,
        len: content.length,
        hasHeroPng: content.includes("hero.png"),
        hasPortraitLive: content.includes("portrait-live"),
        hasStats: content.includes("HeroStats"),
        hasUnoptimized: content.includes("unoptimized"),
        content,
      });
    }
    if (/src\/components\/motifs\/IdentityMarks\.tsx/i.test(decoded)) {
      identityVersions.push({
        mtime,
        len: content.length,
        hasBotanicalPattern: content.includes("BotanicalPattern"),
        hasPortraitFrame: content.includes("PortraitFrame"),
        content,
      });
    }
    if (/src\/repositories\/content-repository\.ts/i.test(decoded)) {
      repoInterfaceVersions.push({ mtime, len: content.length, content, head: content.slice(0, 120) });
    }
  }
}

heroVersions.sort((a, b) => b.mtime - a.mtime || b.len - a.len);
console.log("HomeHero versions:");
for (const v of heroVersions.slice(0, 15)) {
  console.log(
    new Date(v.mtime).toISOString(),
    "len=" + v.len,
    "hero.png=" + v.hasHeroPng,
    "portrait-live=" + v.hasPortraitLive,
    "stats=" + v.hasStats,
  );
}

const heroPick =
  heroVersions.find((v) => v.hasHeroPng) ||
  heroVersions.find((v) => v.hasPortraitLive) ||
  heroVersions.sort((a, b) => b.len - a.len)[0];
if (heroPick) {
  fs.writeFileSync("d:/Stran/src/components/home/HomeHero.tsx", heroPick.content, "utf8");
  console.log("Wrote HomeHero", heroPick.len, "hero.png", heroPick.hasHeroPng);
}

identityVersions.sort((a, b) => b.len - a.len);
if (identityVersions[0]) {
  fs.writeFileSync(
    "d:/Stran/src/components/motifs/IdentityMarks.tsx",
    identityVersions[0].content,
    "utf8",
  );
  console.log(
    "Wrote IdentityMarks",
    identityVersions[0].len,
    "BotanicalPattern",
    identityVersions[0].hasBotanicalPattern,
  );
}

repoInterfaceVersions.sort((a, b) => b.len - a.len);
console.log("content-repository versions:", repoInterfaceVersions.length);
for (const v of repoInterfaceVersions.slice(0, 5)) {
  console.log(v.len, v.head.replace(/\n/g, " "));
}
if (repoInterfaceVersions[0] && repoInterfaceVersions[0].content.includes("ContentRepository")) {
  // only write if it looks like an interface file, not firestore impl
  const c = repoInterfaceVersions.find(
    (v) =>
      v.content.includes("export type ContentRepository") ||
      v.content.includes("export interface ContentRepository"),
  );
  if (c) {
    fs.writeFileSync("d:/Stran/src/repositories/content-repository.ts", c.content, "utf8");
    console.log("Wrote content-repository interface", c.len);
  } else {
    console.log("No interface version found; leaving as-is");
  }
}

// Also pick longest recent page with HomeHero+ArchiveStrip
const pageVersions = [];
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
    if (!/src\/app\/page\.tsx/i.test(decoded.replace(/\\/g, "/"))) continue;
    if (!content.includes("HomeHero") || !content.includes("ArchiveStrip")) continue;
    pageVersions.push({ mtime, len: content.length, content });
  }
}
pageVersions.sort((a, b) => b.len - a.len || b.mtime - a.mtime);
if (pageVersions[0]) {
  fs.writeFileSync("d:/Stran/src/app/page.tsx", pageVersions[0].content, "utf8");
  console.log("Wrote longest HomeHero page", pageVersions[0].len);
}
