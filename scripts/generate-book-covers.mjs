import fs from "fs";
import path from "path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

GlobalFonts.registerFromPath(path.resolve("public/fonts/Amiri-Regular.ttf"), "Amiri");
GlobalFonts.registerFromPath(path.resolve("public/fonts/Amiri-Bold.ttf"), "Amiri");

const outDir = "public/brand/books";
fs.mkdirSync(outDir, { recursive: true });

const books = JSON.parse(fs.readFileSync("src/data/demo-content.json", "utf8")).filter(
  (item) => item.contentType === "book" || item.contentType === "audiobook",
);

/** Editorial palettes — deep ink / warm paper / quiet gold */
const palettes = [
  { bg: "#162822", ink: "#f3eee3", accent: "#c9a24a", mute: "rgba(243,238,227,0.62)", rule: "rgba(201,162,74,0.5)" },
  { bg: "#f6f1e7", ink: "#13241f", accent: "#8f6f28", mute: "rgba(19,36,31,0.58)", rule: "rgba(143,111,40,0.4)" },
  { bg: "#241c15", ink: "#f2ebe1", accent: "#d0b05c", mute: "rgba(242,235,225,0.6)", rule: "rgba(208,176,92,0.48)" },
  { bg: "#ebe3d4", ink: "#101c18", accent: "#7a5c1c", mute: "rgba(16,28,24,0.55)", rule: "rgba(122,92,28,0.38)" },
  { bg: "#0e211d", ink: "#ebe5d8", accent: "#b8953a", mute: "rgba(235,229,216,0.6)", rule: "rgba(184,149,58,0.48)" },
  { bg: "#e4dbcd", ink: "#1a1611", accent: "#856624", mute: "rgba(26,22,17,0.55)", rule: "rgba(133,102,36,0.4)" },
  { bg: "#1f2f2a", ink: "#f0ebe2", accent: "#c7b07a", mute: "rgba(240,235,226,0.6)", rule: "rgba(199,176,122,0.45)" },
];

function wrapLines(ctx, text, maxWidth, maxLines = 6) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function toKuDigits(n) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

function drawCover(book, index) {
  const W = 480;
  const H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const p = palettes[index % palettes.length];

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.fillRect(0, 0, 14, H);

  ctx.strokeStyle = p.rule;
  ctx.lineWidth = 1.25;
  ctx.strokeRect(26, 26, W - 52, H - 52);

  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 0.9;
  ctx.strokeRect(38, 38, W - 76, H - 76);
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.direction = "rtl";

  ctx.fillStyle = p.accent;
  ctx.font = "400 21px Amiri";
  ctx.fillText("ئەرشیف · کتێب", W / 2, 88);

  ctx.fillStyle = p.ink;
  ctx.font = "700 46px Amiri";
  ctx.fillText(toKuDigits(book.year || ""), W / 2, 152);

  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 34, 172);
  ctx.lineTo(W / 2 + 34, 172);
  ctx.stroke();

  ctx.fillStyle = p.ink;
  ctx.font = "700 34px Amiri";
  const titleLines = wrapLines(ctx, book.title, W - 100, 7);
  let y = 234;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y);
    y += 46;
  }

  ctx.fillStyle = p.mute;
  ctx.font = "400 26px Amiri";
  ctx.fillText(book.extras?.author || "ستران عەبدوڵڵا", W / 2, H - 78);

  const out = path.join(outDir, `${book.slug}.png`);
  fs.writeFileSync(out, canvas.toBuffer("image/png"));
  return out;
}

for (const [i, book] of books.entries()) {
  console.log("wrote", drawCover(book, i));
}

fs.rmSync(path.join(outDir, "_font-test.png"), { force: true });

const dataPath = "src/data/demo-content.json";
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
let patched = 0;
for (const item of data) {
  if (item.contentType !== "book" && item.contentType !== "audiobook") continue;
  const coverPath = `/brand/books/${item.slug}.png`;
  if (!fs.existsSync(path.join("public", coverPath.replace(/^\//, "")))) continue;
  item.media = item.media || {};
  item.media.coverImage = { cachedUrl: coverPath, alt: item.title };
  patched += 1;
}
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
console.log("patched covers:", patched);

const jsPath = "src/data/demo-content.js";
if (fs.existsSync(jsPath)) {
  fs.writeFileSync(jsPath, `export default ${JSON.stringify(data, null, 2)};\n`);
}
