import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapPath = path.join(__dirname, "../../data/hewalname-pdf-map.json");

export type PdfVolume = {
  key: string;
  label: string;
  pdfUrl: string;
};

export type PdfMapRow = {
  slug: string;
  title?: string;
  postUrl?: string;
  pdfUrl?: string;
  volumes?: PdfVolume[];
};

export function readPdfMap(): PdfMapRow[] {
  if (!fs.existsSync(mapPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(mapPath, "utf8")) as PdfMapRow[];
  } catch {
    return [];
  }
}

export function pdfMapForSlug(slug: string): PdfMapRow | undefined {
  return readPdfMap().find((row) => row.slug === slug);
}

/** Resolve proxy URL for a book slug and optional volume key (default first volume). */
export function proxyPdfUrl(slug: string, volumeKey?: string): string | undefined {
  const row = pdfMapForSlug(slug);
  if (!row) return undefined;

  if (row.volumes?.length) {
    const vol = volumeKey
      ? row.volumes.find((entry) => entry.key === volumeKey)
      : row.volumes[0];
    if (!vol) return undefined;
    return volumeKey && volumeKey !== row.volumes[0]?.key
      ? `/media/books/${slug}--${vol.key}.pdf`
      : `/media/books/${slug}.pdf`;
  }

  if (row.pdfUrl) return `/media/books/${slug}.pdf`;
  return undefined;
}

export function volumesForSlug(slug: string): Array<{ key: string; label: string; url: string }> {
  const row = pdfMapForSlug(slug);
  if (!row) return [];

  if (row.volumes?.length) {
    return row.volumes.map((vol, index) => ({
      key: vol.key,
      label: vol.label,
      url:
        index === 0
          ? `/media/books/${slug}.pdf`
          : `/media/books/${slug}--${vol.key}.pdf`,
    }));
  }

  if (row.pdfUrl) {
    return [{ key: "1", label: "PDF", url: `/media/books/${slug}.pdf` }];
  }

  return [];
}

export function resolveRemotePdf(slug: string, volumeKey?: string): string | undefined {
  const row = pdfMapForSlug(slug);
  if (!row) return undefined;

  if (row.volumes?.length) {
    const vol = volumeKey
      ? row.volumes.find((entry) => entry.key === volumeKey)
      : row.volumes[0];
    return vol?.pdfUrl.replace(/^http:/, "https:");
  }

  return row.pdfUrl?.replace(/^http:/, "https:");
}

/** Parse slug param like `book-le-ghazetewe-2019--2` → { slug, volumeKey }. */
export function parseBookPdfParam(raw: string): { slug: string; volumeKey?: string } {
  const withoutExt = raw.replace(/\.pdf$/i, "");
  const match = withoutExt.match(/^(.+)--(\d+)$/);
  if (match) return { slug: match[1]!, volumeKey: match[2] };
  return { slug: withoutExt };
}
