/**
 * Download extra volume PDFs referenced in hewalname-pdf-map.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPdfMap } from "@/lib/pdf-map";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfDir = path.join(__dirname, "../data/book-pdfs");

async function downloadPdf(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) throw new Error(`File too small (${buffer.length} bytes)`);
  fs.writeFileSync(dest, buffer);
}

async function main() {
  fs.mkdirSync(pdfDir, { recursive: true });
  const rows = readPdfMap();

  for (const row of rows) {
    const targets: Array<{ url: string; file: string }> = [];

    if (row.volumes?.length) {
      for (const vol of row.volumes) {
        const suffix = vol.key === row.volumes[0]?.key ? "" : `--${vol.key}`;
        targets.push({
          url: vol.pdfUrl,
          file: path.join(pdfDir, `${row.slug}${suffix}.pdf`),
        });
      }
    } else if (row.pdfUrl) {
      targets.push({ url: row.pdfUrl, file: path.join(pdfDir, `${row.slug}.pdf`) });
    }

    for (const target of targets) {
      if (fs.existsSync(target.file)) {
        console.log(`skip ${path.basename(target.file)}`);
        continue;
      }
      console.log(`download ${path.basename(target.file)}…`);
      await downloadPdf(target.url, target.file);
      console.log(`  ok ${path.basename(target.file)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
