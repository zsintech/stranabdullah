import type {
  Query,
  DocumentData,
} from "firebase-admin/firestore";
import { getAdminFirestore } from "@/server/auth/firebase-admin";
import {
  ContentItemSchema,
  type ArchiveFilters,
  type ContentItem,
  type ContentType,
} from "@/types/content";
import type { ContentRepository, ListResult } from "@/repositories/content-repository";

function mapDoc(id: string, data: DocumentData): ContentItem {
  return ContentItemSchema.parse({ id, ...data });
}

export function createFirestoreContentRepository(): ContentRepository {
  const db = getAdminFirestore();
  const col = db.collection("contentItems");

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

      query = query.orderBy("publishedAt", "desc").limit(limit + 1);

      if (filters?.cursor) {
        const cursorDoc = await col.doc(filters.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      }

      const snap = await query.get();
      let items = snap.docs.map((doc) => mapDoc(doc.id, doc.data()));

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
      const snap = await col
        .where("slug", "==", slug)
        .where("status", "==", "published")
        .limit(1)
        .get();
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
      const snap = await col
        .where("status", "==", "published")
        .orderBy("publishedAt", "desc")
        .limit(limit)
        .get();
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
  };
}
