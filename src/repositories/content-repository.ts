import type { ArchiveFilters, ContentItem, ContentType } from "@/types/content";

export type ListResult = {
  items: ContentItem[];
  nextCursor?: string;
};

export type ContentRepository = {
  listPublished(filters?: ArchiveFilters): Promise<ListResult>;
  getBySlug(slug: string): Promise<ContentItem | null>;
  getFeatured(limit?: number): Promise<ContentItem[]>;
  getLatest(limit?: number): Promise<ContentItem[]>;
  getByType(type: ContentType, limit?: number): Promise<ContentItem[]>;
};
