import { contentTypeLabels, sourceAttribution } from "@/lib/content-labels";
import {
  formatKuDate,
  formatKuDayMonth,
  formatKuNumeric,
  kuDigits,
  languageLabels,
} from "@/lib/format";
import { SITE_NAME, SITE_NAME_SHORT } from "@/lib/constants";
import type { ContentItem } from "@/types/content";

export const navLinks = [
  { href: "/", label: "سەرەکی" },
  { href: "/biography", label: "ژیاننامە" },
  { href: "/archive", label: "ئەرشیف" },
  { href: "/books", label: "کتێبەکان" },
  { href: "/media", label: "میدیا" },
  { href: "/contact", label: "پەیوەندی" },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function coverOf(item: ContentItem): string | undefined {
  return (
    item.media.coverImage?.cachedUrl ||
    item.media.coverImage?.remoteUrl ||
    item.media.images[0]?.cachedUrl ||
    item.media.images[0]?.remoteUrl
  );
}

export function visualOf(item: ContentItem): string | undefined {
  return (
    coverOf(item) ||
    (item.contentType === "book" || item.contentType === "audiobook" ? "/brand/portrait.png" : undefined)
  );
}

export function isUsefulExcerpt(item: ContentItem): boolean {
  const summary = item.summary.trim();
  if (summary.length < 40) return false;
  return !summary.startsWith(item.title.trim());
}

export function languageLabel(code: string): string {
  return languageLabels[code] ?? code;
}

export type MetaPart = { key: string; text: string; emphasis?: boolean };

export function itemMetaParts(
  item: ContentItem,
  options: {
    dateStyle?: "full" | "numeric" | "dayMonth" | "none";
    showYear?: boolean;
    typeLabel?: string;
    after?: string;
  } = {},
): MetaPart[] {
  const dateStyle = options.dateStyle ?? "numeric";
  const dayMonth = dateStyle === "dayMonth" ? formatKuDayMonth(item.publishedAt) : "";
  const date =
    dateStyle === "full"
      ? formatKuDate(item.publishedAt)
      : dateStyle === "numeric"
        ? formatKuNumeric(item.publishedAt)
        : "";
  const attribution = sourceAttribution(item);
  const parts: MetaPart[] = [];

  if (options.showYear && item.year) {
    parts.push({ key: "year", text: kuDigits(item.year), emphasis: true });
  }

  parts.push({
    key: "type",
    text: options.typeLabel ?? contentTypeLabels[item.contentType],
    emphasis: true,
  });

  if (dayMonth) parts.push({ key: "day", text: dayMonth });
  if (date) parts.push({ key: "date", text: date });
  if (attribution) parts.push({ key: "source", text: attribution });
  if (!options.typeLabel && item.language !== "ku") {
    parts.push({ key: "lang", text: languageLabels[item.language] });
  }
  if (options.after) parts.push({ key: "after", text: options.after });

  return parts;
}

export function pageTitle(title?: string): string {
  return title ? `${title}${SITE_NAME.includes("ستران") ? " · ستران عەبدوڵڵا" : ""}` : SITE_NAME;
}

export { SITE_NAME, SITE_NAME_SHORT };
