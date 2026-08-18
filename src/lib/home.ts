import type { ContentItem } from "@/types/content";

export function countBy(items: ContentItem[], predicate: (item: ContentItem) => boolean) {
  return items.filter(predicate).length;
}

export function pickUnused(
  pool: ContentItem[],
  used: ContentItem[],
  predicate: (item: ContentItem) => boolean,
  limit: number,
) {
  const taken = new Set(used.map((item) => item.id));
  return pool.filter((item) => !taken.has(item.id) && predicate(item)).slice(0, limit);
}
