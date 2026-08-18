import { contentTypeLabels } from "@/lib/content-labels";
import { kuDigits, languageLabels } from "@/lib/format";
import type { ContentItem, ContentType } from "@/types/content";

/** `label` carries the raw value (form values, URLs); `display` is localised. */
export type Facet = { label: string; display: string; href: string; count: number };

export function yearOf(item: ContentItem): number | undefined {
  if (typeof item.year === "number") return item.year;
  if (!item.publishedAt) return undefined;
  const year = new Date(item.publishedAt).getFullYear();
  return Number.isNaN(year) ? undefined : year;
}

function tally<K>(items: ContentItem[], key: (item: ContentItem) => K | undefined) {
  const counts = new Map<K, number>();
  for (const item of items) {
    const value = key(item);
    if (value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function yearFacets(items: ContentItem[]): Facet[] {
  return [...tally(items, yearOf)]
    .sort((a, b) => b[0] - a[0])
    .map(([year, count]) => ({
      label: String(year),
      display: kuDigits(year),
      href: `/archive?year=${year}`,
      count,
    }));
}

export function languageFacets(items: ContentItem[]): Facet[] {
  return [...tally(items, (item) => item.language)]
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => {
      const label = languageLabels[language] ?? language;
      return {
        label,
        display: label,
        href: `/archive?language=${language}`,
        count,
      };
    });
}

/** Content-type gateways for the editorial strip under the hero. */
export function typeFacets(items: ContentItem[]): Facet[] {
  return [...tally(items, (item) => item.contentType)]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      label: type,
      display: contentTypeLabels[type as ContentType] ?? type,
      href: `/archive?type=${type}`,
      count,
    }));
}

/** Groups items into descending year buckets for chronological display. */
export function groupByYear(items: ContentItem[]): Array<[number | "بێ ساڵ", ContentItem[]]> {
  const groups = new Map<number | "بێ ساڵ", ContentItem[]>();

  for (const item of items) {
    const key = yearOf(item) ?? "بێ ساڵ";
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return [...groups].sort((a, b) => {
    const left = typeof a[0] === "number" ? a[0] : -Infinity;
    const right = typeof b[0] === "number" ? b[0] : -Infinity;
    return right - left;
  });
}
