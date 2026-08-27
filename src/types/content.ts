import { z } from "zod";

export const contentTypes = [
  "speech",
  "article",
  "opinion",
  "interview",
  "podcast",
  "book",
  "audiobook",
  "photo",
  "video",
  "statement",
  "announcement",
  "socialPost",
  "document",
  "other",
] as const;

export const ContentTypeSchema = z.enum(contentTypes);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const LanguageSchema = z.enum(["ku", "ar", "en"]);
export type ContentLanguage = z.infer<typeof LanguageSchema>;

export const ContentStatusSchema = z.enum(["draft", "published", "archived"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const BodyFormatSchema = z.enum(["markdown", "plain", "portable"]);

export const MediaImageSchema = z.object({
  remoteUrl: z.string().url().optional(),
  cachedUrl: z.string().optional(),
  source: z.string().optional(),
  facebookPostId: z.string().optional(),
  mimeType: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const ContentSourceSchema = z.object({
  platform: z.string().optional(),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
  imported: z.boolean().optional(),
  importedAt: z.string().optional(),
});

export const ContentMediaSchema = z.object({
  coverImage: MediaImageSchema.optional(),
  images: z.array(MediaImageSchema).default([]),
  videoUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  documentUrl: z.string().optional(),
  externalEmbedUrl: z.string().optional(),
});

export const ContentSeoSchema = z.object({
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImage: z.string().optional(),
});

export const ContentAuditSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const ContentExtrasSchema = z
  .object({
    author: z.string().optional(),
    publicationYear: z.number().optional(),
    publisher: z.string().optional(),
    isbn: z.string().optional(),
    purchaseLinks: z.array(z.string()).optional(),
    duration: z.string().optional(),
    relatedBookId: z.string().optional(),
    interviewer: z.string().optional(),
    outlet: z.string().optional(),
    occasion: z.string().optional(),
    photographer: z.string().optional(),
    historicalNotes: z.string().optional(),
    isDemo: z.boolean().optional(),
    homeGallery: z.boolean().optional(),
    homeGalleryOrder: z.number().optional(),
    homeGalleryWide: z.boolean().optional(),
  })
  .passthrough();

export const ContentItemSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  summary: z.string().default(""),
  body: z.string().default(""),
  bodyFormat: BodyFormatSchema.default("markdown"),
  contentType: ContentTypeSchema,
  language: LanguageSchema.default("ku"),
  status: ContentStatusSchema,
  publishedAt: z.string().optional(),
  eventDate: z.string().optional(),
  year: z.number().int().optional(),
  location: z.string().optional(),
  topics: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  people: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  featuredOrder: z.number().optional(),
  source: ContentSourceSchema.optional(),
  media: ContentMediaSchema.default({ images: [] }),
  seo: ContentSeoSchema.optional(),
  audit: ContentAuditSchema,
  extras: ContentExtrasSchema.optional(),
});

export type ContentItem = z.infer<typeof ContentItemSchema>;

export const ArchiveFiltersSchema = z.object({
  type: ContentTypeSchema.optional(),
  year: z.coerce.number().int().optional(),
  topic: z.string().optional(),
  language: LanguageSchema.optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type ArchiveFilters = z.infer<typeof ArchiveFiltersSchema>;
