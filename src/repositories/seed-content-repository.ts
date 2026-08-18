import demoContent from "@/data/demo-content.json";
import { ContentItemSchema, type ArchiveFilters, type ContentItem, type ContentType } from "@/types/content";
import type { ContentRepository, ListResult } from "@/repositories/content-repository";

function loadDemoItems(): ContentItem[] {
  return demoContent.map((raw) => ContentItemSchema.parse(raw));
}

function publishedSorted(items: ContentItem[]): ContentItem[] {
  return items
    .filter((item) => item.status === "published")
    .sort((a, b) => {
      const da = a.publishedAt ?? "";
      const db = b.publishedAt ?? "";
      return db.localeCompare(da);
    });
}

function applyFilters(items: ContentItem[], filters?: ArchiveFilters): ContentItem[] {
  let result = publishedSorted(items);

  // Keep books on /books and bio “about” notes off the writing archive feed.
  if (!filters?.type) {
    result = result.filter(
      (item) =>
        item.contentType !== "book" &&
        item.contentType !== "audiobook" &&
        !item.tags.includes("about"),
    );
  }

  if (filters?.type) {
    result = result.filter((item) => item.contentType === filters.type);
  }
  if (filters?.year) {
    result = result.filter((item) => item.year === filters.year);
  }
  if (filters?.language) {
    result = result.filter((item) => item.language === filters.language);
  }
  if (filters?.topic) {
    const topic = filters.topic;
    result = result.filter((item) => item.topics.includes(topic));
  }
  if (filters?.q) {
    const q = filters.q.trim().toLowerCase();
    result = result.filter((item) => {
      const haystack = [
        item.title,
        item.summary,
        item.topics.join(" "),
        item.tags.join(" "),
        String(item.year ?? ""),
        item.contentType,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return result;
}

export function createSeedContentRepository(): ContentRepository {
  const all = loadDemoItems();

  return {
    async listPublished(filters?: ArchiveFilters): Promise<ListResult> {
      const limit = filters?.limit ?? 24;
      const filtered = applyFilters(all, filters);
      const start = filters?.cursor
        ? filtered.findIndex((item) => item.id === filters.cursor) + 1
        : 0;
      const slice = filtered.slice(Math.max(0, start), Math.max(0, start) + limit);
      const last = slice[slice.length - 1];
      const hasMore = start + limit < filtered.length;
      return {
        items: slice,
        nextCursor: hasMore && last ? last.id : undefined,
      };
    },

    async getBySlug(slug: string) {
      return publishedSorted(all).find((item) => item.slug === slug) ?? null;
    },

    async getFeatured(limit = 6) {
      return publishedSorted(all)
        .filter((item) => item.featured)
        .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99))
        .slice(0, limit);
    },

    async getLatest(limit = 6) {
      return publishedSorted(all).slice(0, limit);
    },

    async getByType(type: ContentType, limit = 6) {
      return publishedSorted(all)
        .filter((item) => item.contentType === type)
        .slice(0, limit);
    },
  };
}
