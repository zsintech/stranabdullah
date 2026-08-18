import demoContent from "@/data/demo-content.json";
import { DEFAULT_BIOGRAPHY, BiographySettingsSchema, type BiographySettings } from "@/types/biography";
import { ContentItemSchema, type ArchiveFilters, type ContentItem, type ContentStatus, type ContentType } from "@/types/content";
import type { AdminContentRepository, AdminListFilters, ContentDraftInput, ListResult } from "@/repositories/content-repository";
import { applyDraft, matchesAdminQuery, sortByUpdated } from "@/repositories/content-draft";
import { invalidateArchiveCountCache } from "@/lib/public-cache";

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

function assertUniqueSlug(items: ContentItem[], slug: string, exceptId?: string) {
  if (items.some((item) => item.slug === slug && item.id !== exceptId)) {
    throw new Error("ئەم لینکە پێشتر بەکارهاتووە.");
  }
}

export function createSeedContentRepository(): AdminContentRepository {
  const items = loadDemoItems();
  let biography: BiographySettings = { ...DEFAULT_BIOGRAPHY };

  const replace = (next: ContentItem) => {
    const index = items.findIndex((item) => item.id === next.id);
    if (index >= 0) items[index] = next;
    else items.unshift(next);
    invalidateArchiveCountCache();
    return next;
  };

  return {
    async listPublished(filters?: ArchiveFilters): Promise<ListResult> {
      const limit = filters?.limit ?? 24;
      const filtered = applyFilters(items, filters);
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
      return publishedSorted(items).find((item) => item.slug === slug) ?? null;
    },

    async getFeatured(limit = 6) {
      return publishedSorted(items)
        .filter((item) => item.featured)
        .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99))
        .slice(0, limit);
    },

    async getLatest(limit = 6) {
      return publishedSorted(items).slice(0, limit);
    },

    async getByType(type: ContentType, limit = 6) {
      return publishedSorted(items)
        .filter((item) => item.contentType === type)
        .slice(0, limit);
    },

    async listAll(filters?: AdminListFilters) {
      return sortByUpdated(items.filter((item) => matchesAdminQuery(item, filters)));
    },

    async getById(id: string) {
      return items.find((item) => item.id === id) ?? null;
    },

    async create(input: ContentDraftInput, actorEmail: string) {
      const item = applyDraft(undefined, input, actorEmail);
      assertUniqueSlug(items, item.slug);
      return replace(item);
    },

    async update(id: string, input: ContentDraftInput, actorEmail: string) {
      const current = items.find((item) => item.id === id);
      if (!current) throw new Error("تۆمار نەدۆزرایەوە.");
      const item = applyDraft(current, input, actorEmail);
      assertUniqueSlug(items, item.slug, id);
      return replace(item);
    },

    async setStatus(id: string, status: ContentStatus, actorEmail: string) {
      const current = items.find((item) => item.id === id);
      if (!current) throw new Error("تۆمار نەدۆزرایەوە.");
      const publishedAt =
        status === "published" ? current.publishedAt || new Date().toISOString() : current.publishedAt;
      return replace(
        ContentItemSchema.parse({
          ...current,
          status,
          publishedAt,
          audit: { ...current.audit, updatedAt: new Date().toISOString(), updatedBy: actorEmail },
        }),
      );
    },

    async setFeatured(id: string, featured: boolean, actorEmail: string) {
      const current = items.find((item) => item.id === id);
      if (!current) throw new Error("تۆمار نەدۆزرایەوە.");
      const now = new Date().toISOString();
      if (featured) {
        for (const item of items) {
          if (item.featured && item.id !== id) {
            item.featured = false;
            item.audit = { ...item.audit, updatedAt: now, updatedBy: actorEmail };
          }
        }
      }
      return replace(
        ContentItemSchema.parse({
          ...current,
          featured,
          featuredOrder: featured ? 1 : current.featuredOrder,
          audit: { ...current.audit, updatedAt: now, updatedBy: actorEmail },
        }),
      );
    },

    async getBiography() {
      return biography;
    },

    async saveBiography(data: BiographySettings) {
      biography = BiographySettingsSchema.parse(data);
      return biography;
    },
  };
}
