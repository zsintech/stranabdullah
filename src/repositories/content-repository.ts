import type { ArchiveFilters, ContentItem, ContentStatus, ContentType } from "@/types/content";
import type { BiographySettings } from "@/types/biography";

export type ListResult = {
  items: ContentItem[];
  nextCursor?: string;
};

export type AdminListFilters = {
  status?: ContentStatus;
  type?: ContentType;
  q?: string;
};

export type ContentDraftInput = {
  slug?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  body?: string;
  bodyFormat?: ContentItem["bodyFormat"];
  contentType: ContentType;
  language?: ContentItem["language"];
  status?: ContentStatus;
  publishedAt?: string;
  year?: number;
  location?: string;
  topics?: string[];
  tags?: string[];
  people?: string[];
  featured?: boolean;
  coverUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  documentUrl?: string;
  outlet?: string;
  author?: string;
  publisher?: string;
  isbn?: string;
};

export type ContentRepository = {
  listPublished(filters?: ArchiveFilters): Promise<ListResult>;
  getBySlug(slug: string): Promise<ContentItem | null>;
  getFeatured(limit?: number): Promise<ContentItem[]>;
  getLatest(limit?: number): Promise<ContentItem[]>;
  getByType(type: ContentType, limit?: number): Promise<ContentItem[]>;
};

export type AdminContentRepository = ContentRepository & {
  listAll(filters?: AdminListFilters): Promise<ContentItem[]>;
  getById(id: string): Promise<ContentItem | null>;
  create(input: ContentDraftInput, actorEmail: string): Promise<ContentItem>;
  update(id: string, input: ContentDraftInput, actorEmail: string): Promise<ContentItem>;
  setStatus(id: string, status: ContentStatus, actorEmail: string): Promise<ContentItem>;
  setFeatured(id: string, featured: boolean, actorEmail: string): Promise<ContentItem>;
  getBiography(): Promise<BiographySettings>;
  saveBiography(data: BiographySettings): Promise<BiographySettings>;
};
