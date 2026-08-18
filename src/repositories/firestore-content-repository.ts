import type { DocumentData, Query } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/server/auth/firebase-admin";
import {
  ContentItemSchema,
  type ArchiveFilters,
  type ContentItem,
  type ContentStatus,
  type ContentType,
} from "@/types/content";
import { BiographySettingsSchema, DEFAULT_BIOGRAPHY, type BiographySettings } from "@/types/biography";
import type {
  AdminContentRepository,
  AdminListFilters,
  ContentDraftInput,
  ListResult,
} from "@/repositories/content-repository";
import { applyDraft, matchesAdminQuery, sortByUpdated } from "@/repositories/content-draft";
import { stripUndefined } from "@/lib/strip-undefined";
import { invalidateArchiveCountCache } from "@/lib/public-cache";

const BIO_DOC = ["siteSettings", "biography"] as const;

function mapDoc(id: string, data: DocumentData): ContentItem {
  return ContentItemSchema.parse({ id, ...data });
}

function excludeFromWritingFeed(item: ContentItem): boolean {
  return item.contentType === "book" || item.contentType === "audiobook" || item.tags.includes("about");
}

export function createFirestoreContentRepository(): AdminContentRepository {
  const db = getAdminFirestore();
  const col = db.collection("contentItems");
  const bioRef = db.collection(BIO_DOC[0]).doc(BIO_DOC[1]);

  async function writeItem(item: ContentItem): Promise<ContentItem> {
    await col.doc(item.id).set(stripUndefined(item));
    invalidateArchiveCountCache();
    return item;
  }

  async function assertUniqueSlug(slug: string, exceptId?: string) {
    const snap = await col.where("slug", "==", slug).limit(5).get();
    if (snap.docs.some((doc) => doc.id !== exceptId)) {
      throw new Error("ئەم لینکە پێشتر بەکارهاتووە.");
    }
  }

  return {
    async listPublished(filters?: ArchiveFilters): Promise<ListResult> {
      const limit = filters?.limit ?? 24;
      let query: Query = col.where("status", "==", "published");

      if (filters?.type) {
        query = query.where("contentType", "==", filters.type);
      }
      if (filters?.year) {
        query = query.where("year", "==", filters.year);
      }
      if (filters?.language) {
        query = query.where("language", "==", filters.language);
      }

      query = query.orderBy("publishedAt", "desc").limit(Math.min(1000, limit + 40));

      if (filters?.cursor) {
        const cursorDoc = await col.doc(filters.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snap = await query.get();
      let items = snap.docs.map((doc) => mapDoc(doc.id, doc.data()));

      if (!filters?.type) {
        items = items.filter((item) => !excludeFromWritingFeed(item));
      }
      if (filters?.topic) {
        items = items.filter((item) => item.topics.includes(filters.topic!));
      }
      if (filters?.q) {
        const q = filters.q.trim().toLowerCase();
        items = items.filter((item) => {
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

      const hasMore = items.length > limit;
      const page = items.slice(0, limit);
      return {
        items: page,
        nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
      };
    },

    async getBySlug(slug: string) {
      const snap = await col.where("slug", "==", slug).where("status", "==", "published").limit(1).get();
      const doc = snap.docs[0];
      return doc ? mapDoc(doc.id, doc.data()) : null;
    },

    async getFeatured(limit = 6) {
      const snap = await col
        .where("status", "==", "published")
        .where("featured", "==", true)
        .orderBy("featuredOrder", "asc")
        .limit(limit)
        .get();
      return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
    },

    async getLatest(limit = 6) {
      const snap = await col.where("status", "==", "published").orderBy("publishedAt", "desc").limit(limit).get();
      return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
    },

    async getByType(type: ContentType, limit = 6) {
      const snap = await col
        .where("status", "==", "published")
        .where("contentType", "==", type)
        .orderBy("publishedAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
    },

    async listAll(filters?: AdminListFilters) {
      const snap = await col.get();
      const items: ContentItem[] = [];
      for (const doc of snap.docs) {
        try {
          items.push(mapDoc(doc.id, doc.data()));
        } catch {
          // skip malformed docs
        }
      }
      return sortByUpdated(items.filter((item) => matchesAdminQuery(item, filters)));
    },

    async getById(id: string) {
      const doc = await col.doc(id).get();
      if (!doc.exists) return null;
      return mapDoc(doc.id, doc.data()!);
    },

    async create(input: ContentDraftInput, actorEmail: string) {
      const item = applyDraft(undefined, input, actorEmail);
      await assertUniqueSlug(item.slug);
      return writeItem(item);
    },

    async update(id: string, input: ContentDraftInput, actorEmail: string) {
      const current = await this.getById(id);
      if (!current) throw new Error("تۆمار نەدۆزرایەوە.");
      const item = applyDraft(current, input, actorEmail);
      await assertUniqueSlug(item.slug, id);
      return writeItem(item);
    },

    async setStatus(id: string, status: ContentStatus, actorEmail: string) {
      const current = await this.getById(id);
      if (!current) throw new Error("تۆمار نەدۆزرایەوە.");
      const publishedAt =
        status === "published" ? current.publishedAt || new Date().toISOString() : current.publishedAt;
      return writeItem(
        ContentItemSchema.parse({
          ...current,
          status,
          publishedAt,
          audit: { ...current.audit, updatedAt: new Date().toISOString(), updatedBy: actorEmail },
        }),
      );
    },

    async setFeatured(id: string, featured: boolean, actorEmail: string) {
      const current = await this.getById(id);
      if (!current) throw new Error("تۆمار نەدۆزرایەوە.");
      const now = new Date().toISOString();
      const batch = db.batch();
      if (featured) {
        const others = await col.where("featured", "==", true).get();
        for (const doc of others.docs) {
          if (doc.id !== id) {
            batch.update(doc.ref, { featured: false, "audit.updatedAt": now, "audit.updatedBy": actorEmail });
          }
        }
      }
      const next = ContentItemSchema.parse({
        ...current,
        featured,
        featuredOrder: featured ? 1 : current.featuredOrder,
        audit: { ...current.audit, updatedAt: now, updatedBy: actorEmail },
      });
      batch.set(col.doc(id), stripUndefined(next));
      await batch.commit();
      invalidateArchiveCountCache();
      return next;
    },

    async getBiography() {
      const snap = await bioRef.get();
      if (!snap.exists) return { ...DEFAULT_BIOGRAPHY };
      return BiographySettingsSchema.parse({ ...DEFAULT_BIOGRAPHY, ...snap.data() });
    },

    async saveBiography(data: BiographySettings) {
      const parsed = BiographySettingsSchema.parse(data);
      await bioRef.set(stripUndefined(parsed));
      return parsed;
    },
  };
}
