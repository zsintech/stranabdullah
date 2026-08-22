import { randomUUID } from "node:crypto";
import type { ContentDraftInput } from "@/repositories/content-repository";
import { ContentItemSchema, type ContentItem, type ContentStatus } from "@/types/content";
import { slugify } from "@/lib/slug";

export function applyDraft(
  current: Partial<ContentItem> | undefined,
  input: ContentDraftInput,
  actorEmail: string,
): ContentItem {
  const now = new Date().toISOString();
  const id = current?.id ?? randomUUID();
  const status: ContentStatus = input.status ?? current?.status ?? "draft";
  const publishedAt =
    status === "published"
      ? input.publishedAt || current?.publishedAt || now
      : input.publishedAt || current?.publishedAt;
  const year =
    input.year ??
    current?.year ??
    (publishedAt ? new Date(publishedAt).getFullYear() : undefined);
  const slug = slugify(input.slug || current?.slug || input.title);
  const coverUrl = input.coverUrl?.trim();
  const coverAlt = input.coverAlt?.trim() || input.title.trim();
  const existingCover = current?.media?.coverImage;

  return ContentItemSchema.parse({
    id,
    slug,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || undefined,
    summary: input.summary ?? current?.summary ?? "",
    body: input.body ?? current?.body ?? "",
    bodyFormat: input.bodyFormat ?? current?.bodyFormat ?? "markdown",
    contentType: input.contentType,
    language: input.language ?? current?.language ?? "ku",
    status,
    publishedAt,
    year,
    location: input.location?.trim() || current?.location,
    topics: input.topics ?? current?.topics ?? [],
    tags: input.tags ?? current?.tags ?? [],
    people: input.people ?? current?.people ?? [],
    featured: input.featured ?? current?.featured ?? false,
    featuredOrder: current?.featuredOrder,
    source: current?.source,
    media: {
      coverImage: coverUrl
        ? { remoteUrl: coverUrl, alt: coverAlt }
        : existingCover
          ? { ...existingCover, alt: input.coverAlt?.trim() || existingCover.alt || input.title.trim() }
          : undefined,
      images: current?.media?.images ?? [],
      videoUrl: input.videoUrl?.trim() || current?.media?.videoUrl,
      audioUrl: input.audioUrl?.trim() || current?.media?.audioUrl,
      documentUrl: input.documentUrl?.trim() || current?.media?.documentUrl,
      externalEmbedUrl: current?.media?.externalEmbedUrl,
    },
    seo: current?.seo,
    audit: {
      createdAt: current?.audit?.createdAt ?? now,
      updatedAt: now,
      createdBy: current?.audit?.createdBy ?? actorEmail,
      updatedBy: actorEmail,
    },
    extras: {
      ...(current?.extras ?? {}),
      author: input.author?.trim() || current?.extras?.author,
      outlet: input.outlet?.trim() || current?.extras?.outlet,
      publisher: input.publisher?.trim() || current?.extras?.publisher,
      isbn: input.isbn?.trim() || current?.extras?.isbn,
    },
  });
}

export function matchesAdminQuery(
  item: ContentItem,
  filters?: { status?: ContentStatus; type?: ContentItem["contentType"]; q?: string },
): boolean {
  if (filters?.status && item.status !== filters.status) return false;
  if (filters?.type && item.contentType !== filters.type) return false;
  if (filters?.q) {
    const q = filters.q.trim().toLowerCase();
    const haystack = [item.title, item.summary, item.slug, item.tags.join(" "), item.topics.join(" ")]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function sortByUpdated(items: ContentItem[]): ContentItem[] {
  return [...items].sort((a, b) => (b.audit.updatedAt || "").localeCompare(a.audit.updatedAt || ""));
}
