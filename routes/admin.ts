import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "@/lib/async-handler";
import { consumeAdminFlash, setAdminFlash, setAdminSession, clearAdminSession, isAllowedAdminEmail, allowedAdminEmails, readAdminSession, type AdminFlash } from "@/lib/admin-session";
import { assertCsrf, CsrfError, issueCsrf, readCsrf } from "@/lib/csrf";
import { AuthError, signInWithPassword } from "@/lib/firebase-password";
import { storeAdminUpload, isAllowedUpload, inferUploadMime } from "@/lib/admin-upload";
import { storageBucketErrorMessage } from "@/lib/firebase-storage-bucket";
import { renderPage } from "@/lib/render-page";
import { renderAdmin } from "@/lib/render-admin";
import { coverOf } from "@/lib/view-helpers";
import { articleBodyHtml } from "@/lib/markdown";
import { kuDigits, readingTime } from "@/lib/format";
import { sourceOutletLabel } from "@/lib/content-labels";
import { requireAdmin } from "@/middleware/require-admin";
import { isUsingSeedFallback, isFirestoreDegraded, withAdminRepo, adminErrorMessage } from "@/repositories";
import { splitList } from "@/lib/slug";
import { contentTypes, type ContentStatus, type ContentType, type ContentItem } from "@/types/content";
import { DEFAULT_BIOGRAPHY } from "@/types/biography";
import { contentTypeLabels } from "@/lib/content-labels";
import type { Response } from "express";
import type { ContentDraftInput } from "@/repositories/content-repository";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!isAllowedUpload(file)) {
      cb(new Error("جۆری فایل پشتیوانی ناکرێت. وێنە یان PDF باربکە."));
      return;
    }
    file.mimetype = inferUploadMime(file);
    cb(null, true);
  },
});

const itemUpload = upload.fields([
  { name: "cover", maxCount: 1 },
  { name: "document", maxCount: 1 },
]);

function uploadErrorMessage(error: unknown): string {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return "قەبارەی فایل لە ٤٠ مێگابایت گەورەترە.";
  }
  return storageBucketErrorMessage(error, error instanceof Error ? error.message : "بارکردنی فایل سەرکەوتوو نەبوو.");
}

const router = Router();

const statusLabels: Record<ContentStatus, string> = {
  draft: "ڕەشنووس",
  published: "بڵاوکراوە",
  archived: "شاردراوەتەوە",
};

const statusHints: Record<ContentStatus, string> = {
  draft: "تەنها لە بەڕێوەبەر دەردەکەوێت — لە ماڵپەڕدا نییە",
  published: "لە ماڵپەڕدا دەردەکەوێت",
  archived: "لە ماڵپەڕدا نیشان نادرێت — دەتوانیت دووبارە بڵاوی بکەیتەوە",
};

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

function draftFromBody(
  body: Record<string, unknown>,
  files?: { coverUrl?: string; documentUrl?: string },
): ContentDraftInput {
  const publishedDate = text(body, "publishedAt");
  const yearRaw = text(body, "year");
  const documentFromBody = text(body, "documentUrl") || undefined;
  const intent = text(body, "intent");
  const status =
    intent === "publish" || intent === "publish_list" || intent === "publish_new"
      ? "published"
      : intent === "archive" || intent === "archive_list"
        ? "archived"
        : ((text(body, "status") || "draft") as ContentStatus);
  return {
    slug: text(body, "slug") || undefined,
    title: text(body, "title"),
    subtitle: text(body, "subtitle") || undefined,
    summary: text(body, "summary"),
    body: typeof body.body === "string" ? body.body : "",
    bodyFormat: text(body, "bodyFormat") === "plain" ? "plain" : "markdown",
    contentType: (text(body, "contentType") || "article") as ContentType,
    language: (text(body, "language") || "ku") as ContentDraftInput["language"],
    status,
    publishedAt: publishedDate ? new Date(`${publishedDate}T12:00:00.000Z`).toISOString() : undefined,
    year: yearRaw ? Number(yearRaw) : undefined,
    location: text(body, "location") || undefined,
    topics: splitList(text(body, "topics")),
    tags: splitList(text(body, "tags")),
    featured: body.featured === "on" || body.featured === "true",
    coverUrl: files?.coverUrl,
    coverAlt: text(body, "coverAlt") || undefined,
    videoUrl: text(body, "videoUrl") || undefined,
    audioUrl: text(body, "audioUrl") || undefined,
    documentUrl: files?.documentUrl || documentFromBody,
    outlet: text(body, "outlet") || undefined,
    author: text(body, "author") || undefined,
    publisher: text(body, "publisher") || undefined,
    isbn: text(body, "isbn") || undefined,
    homeGallery: body.homeGallery === "on" || body.homeGallery === "true",
    homeGalleryOrder: text(body, "homeGalleryOrder") ? Number(text(body, "homeGalleryOrder")) : undefined,
    homeGalleryWide: body.homeGalleryWide === "on" || body.homeGalleryWide === "true",
  };
}

async function mediaFromRequest(
  body: Record<string, unknown>,
  files?: { cover?: Express.Multer.File[]; document?: Express.Multer.File[] },
): Promise<{ coverUrl?: string; documentUrl?: string }> {
  let coverUrl = text(body, "coverUrl") || undefined;
  let documentUrl = text(body, "documentUrl") || undefined;
  if (files?.cover?.[0]) coverUrl = await storeAdminUpload(files.cover[0]);
  if (files?.document?.[0]) documentUrl = await storeAdminUpload(files.document[0]);
  return { coverUrl, documentUrl };
}

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/admin";
  if (!value.startsWith("/admin")) return "/admin";
  return value;
}

const MEDIA_QUICK_TYPES = new Set<ContentType>(["interview", "podcast", "video", "photo"]);

function publicUrlForItem(item: Pick<ContentItem, "status" | "slug">): string | undefined {
  if (item.status !== "published" || !item.slug) return undefined;
  return `/archive/${item.slug}`;
}

function itemSavedFlash(item: ContentItem, baseMessage: string): AdminFlash {
  const href = publicUrlForItem(item);
  const message =
    item.status === "published" && href
      ? `${baseMessage} ئێستا لە ماڵپەڕدا دەردەکەوێت.`
      : item.status === "archived"
        ? `${baseMessage} لە ماڵپەڕدا نیشان نادرێت.`
        : baseMessage;
  return { type: "ok", message, href, hrefLabel: href ? "بینین لە ماڵپەڕ" : undefined };
}

function archiveFlash(message = "تۆمار شاردرایەوە.") {
  return { type: "ok" as const, message: `${message} لە ماڵپەڕدا نیشان نادرێت.` };
}

function saveIntent(body: Record<string, unknown>): string {
  return text(body, "intent") || "save";
}

function redirectAfterItemSave(res: Response, item: ContentItem, intent: string, message: string): void {
  if (intent === "archive" || intent === "archive_list") {
    setAdminFlash(res, archiveFlash(message));
  } else {
    setAdminFlash(res, itemSavedFlash(item, message));
  }
  if (intent === "save_list" || intent === "publish_list" || intent === "archive_list") {
    res.redirect("/admin/items");
    return;
  }
  if (intent === "publish_new") {
    res.redirect(`/admin/items/new?type=${encodeURIComponent(item.contentType)}`);
    return;
  }
  res.redirect(`/admin/items/${item.id}`);
}

router.get(
  "/login",
  asyncHandler(async (req, res) => {
    if (readAdminSession(req)) {
      res.redirect("/admin");
      return;
    }
    const csrf = readCsrf(req) ?? issueCsrf(res);
    await renderAdmin(res, "login", {
      pageTitle: "چوونەژوورەوە",
      csrf,
      error: consumeAdminFlash(req, res)?.message,
      next: safeNext(req.query.next),
      seedMode: isUsingSeedFallback(),
    });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    try {
      assertCsrf(req);
    } catch {
      setAdminFlash(res, { type: "error", message: "داواکارییەکە بەسەرچوو. دووبارە هەوڵبدەرەوە." });
      res.redirect("/admin/login");
      return;
    }

    const body = req.body as Record<string, unknown>;
    const email = text(body, "email");
    const password = text(body, "password");
    const next = safeNext(body.next);

    try {
      if (!allowedAdminEmails().length) {
        throw new AuthError("ADMIN_ALLOWED_EMAILS دانەنراوە.");
      }
      if (!isAllowedAdminEmail(email)) {
        throw new AuthError("ئەم ئیمەیڵە ڕێگەپێدراو نییە.");
      }
      const signed = await signInWithPassword(email, password);
      setAdminSession(res, { uid: signed.localId, email: signed.email });
      res.redirect(next);
    } catch (error) {
      const message =
        error instanceof AuthError
          ? error.message
          : "چوونەژوورەوە سەرکەوتوو نەبوو. ڕێکخستنی Firebase بپشکنە.";
      const csrf = issueCsrf(res);
      await renderAdmin(res, "login", {
        pageTitle: "چوونەژوورەوە",
        csrf,
        error: message,
        next,
        seedMode: isUsingSeedFallback(),
      });
    }
  }),
);

router.post("/logout", requireAdmin, (req, res) => {
  try {
    assertCsrf(req);
  } catch {
    // still log out
  }
  clearAdminSession(res);
  res.redirect("/admin/login");
});

router.use(requireAdmin);

router.use((req, res, next) => {
  res.locals.csrf = readCsrf(req) ?? issueCsrf(res);
  res.locals.flash = consumeAdminFlash(req, res);
  res.locals.seedMode = isUsingSeedFallback();
  res.locals.firestoreDegraded = isFirestoreDegraded();
  res.locals.statusLabels = statusLabels;
  res.locals.statusHints = statusHints;
  res.locals.contentTypeLabels = contentTypeLabels;
  next();
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await withAdminRepo((repo) => repo.listAll());
    const counts = {
      all: items.length,
      published: items.filter((item) => item.status === "published").length,
      draft: items.filter((item) => item.status === "draft").length,
      archived: items.filter((item) => item.status === "archived").length,
      featured: items.filter((item) => item.featured).length,
    };
    const drafts = items.filter((item) => item.status === "draft").slice(0, 6);
    const archived = items.filter((item) => item.status === "archived").slice(0, 6);
    await renderAdmin(res, "dashboard", {
      pageTitle: "بەڕێوەبەر",
      counts,
      recent: items.slice(0, 8),
      drafts,
      archived,
      breadcrumbs: [{ label: "سەرەکی" }],
    });
  }),
);

router.get(
  "/items",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? (req.query.status as ContentStatus) : undefined;
    const type = typeof req.query.type === "string" ? (req.query.type as ContentType) : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const pageRaw = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const PAGE_SIZE = 25;
    const allItems = await withAdminRepo((repo) =>
      repo.listAll({
        status: status && status in statusLabels ? status : undefined,
        type: type && contentTypes.includes(type) ? type : undefined,
        q,
      }),
    );
    const total = allItems.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const items = allItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    await renderAdmin(res, "items", {
      pageTitle: "تۆمارەکان",
      items,
      filters: { status: status ?? "", type: type ?? "", q: q ?? "" },
      pagination: { page: safePage, totalPages, total, pageSize: PAGE_SIZE },
      contentTypes,
      breadcrumbs: [{ href: "/admin", label: "سەرەکی" }, { label: "تۆمارەکان" }],
    });
  }),
);

router.get(
  "/items/new",
  asyncHandler(async (req, res) => {
    const requested =
      typeof req.query.type === "string" && contentTypes.includes(req.query.type as ContentType)
        ? (req.query.type as ContentType)
        : "article";
    const fromQuickAdd =
      typeof req.query.type === "string" && contentTypes.includes(req.query.type as ContentType);
    const defaultStatus: ContentStatus = MEDIA_QUICK_TYPES.has(requested) ? "published" : "draft";
    await renderAdmin(res, "item-form", {
      pageTitle: "تۆماری نوێ",
      item: null,
      contentTypes,
      defaultType: requested,
      defaultStatus,
      fromQuickAdd,
      breadcrumbs: [
        { href: "/admin", label: "سەرەکی" },
        { href: "/admin/items", label: "تۆمارەکان" },
        { label: "نوێ" },
      ],
    });
  }),
);

router.post(
  "/items",
  (req, res, next) => {
    itemUpload(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      setAdminFlash(res, { type: "error", message: uploadErrorMessage(err) });
      res.redirect("/admin/items/new");
    });
  },
  asyncHandler(async (req, res) => {
    try {
      assertCsrf(req);
      const body = req.body as Record<string, unknown>;
      const files = req.files as { cover?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined;
      const media = await mediaFromRequest(body, files);
      const intent = saveIntent(body);
      const item = await withAdminRepo(
        (repo) => repo.create(draftFromBody(body, media), req.adminUser!.email),
        "write",
      );
      redirectAfterItemSave(res, item, intent, "تۆمارەکە پاشەکەوت کرا.");
    } catch (error) {
      if (error instanceof CsrfError) {
        setAdminFlash(res, { type: "error", message: "داواکارییەکە بەسەرچوو." });
        res.redirect("/admin/items/new");
        return;
      }
      setAdminFlash(res, { type: "error", message: adminErrorMessage(error, "پاشەکەوتکردن سەرکەوتوو نەبوو.") });
      res.redirect("/admin/items/new");
    }
  }),
);

router.get(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const item = await withAdminRepo((repo) => repo.getById(req.params.id));
    if (!item) {
      setAdminFlash(res, { type: "error", message: "تۆمار نەدۆزرایەوە." });
      res.redirect("/admin/items");
      return;
    }
    await renderAdmin(res, "item-form", {
      pageTitle: item.title,
      item,
      contentTypes,
      breadcrumbs: [
        { href: "/admin", label: "سەرەکی" },
        { href: "/admin/items", label: "تۆمارەکان" },
        { label: item.title },
      ],
    });
  }),
);

router.post(
  "/items/:id",
  (req, res, next) => {
    itemUpload(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      setAdminFlash(res, { type: "error", message: uploadErrorMessage(err) });
      res.redirect(`/admin/items/${req.params.id}`);
    });
  },
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    try {
      assertCsrf(req);
      const body = req.body as Record<string, unknown>;
      const files = req.files as { cover?: Express.Multer.File[]; document?: Express.Multer.File[] } | undefined;
      const media = await mediaFromRequest(body, files);
      const intent = saveIntent(body);
      const item = await withAdminRepo(
        (repo) => repo.update(id, draftFromBody(body, media), req.adminUser!.email),
        "write",
      );
      redirectAfterItemSave(res, item, intent, "گۆڕانکارییەکان پاشەکەوت کران.");
    } catch (error) {
      setAdminFlash(res, {
        type: "error",
        message: adminErrorMessage(error, "پاشەکەوتکردن سەرکەوتوو نەبوو."),
      });
      res.redirect(`/admin/items/${id}`);
    }
  }),
);

router.post(
  "/items/:id/status",
  asyncHandler(async (req, res) => {
    try {
      assertCsrf(req);
      const status = text(req.body as Record<string, unknown>, "status") as ContentStatus;
      if (!(status in statusLabels)) throw new Error("دۆخی نادیار.");
      const item = await withAdminRepo(
        (repo) => repo.setStatus(req.params.id, status, req.adminUser!.email),
        "write",
      );
      setAdminFlash(
        res,
        status === "archived"
          ? archiveFlash(`دۆخ بوو بە ${statusLabels[status]}.`)
          : itemSavedFlash(item, `دۆخ بوو بە ${statusLabels[status]}.`),
      );
    } catch (error) {
      setAdminFlash(res, { type: "error", message: adminErrorMessage(error, "گۆڕینی دۆخ سەرکەوتوو نەبوو.") });
    }
    const back = typeof req.body?.back === "string" && req.body.back.startsWith("/admin") ? req.body.back : `/admin/items/${req.params.id}`;
    res.redirect(back);
  }),
);

router.post(
  "/items/:id/featured",
  asyncHandler(async (req, res) => {
    try {
      assertCsrf(req);
      const featured = text(req.body as Record<string, unknown>, "featured") === "true";
      await withAdminRepo((repo) => repo.setFeatured(req.params.id, featured, req.adminUser!.email), "write");
      setAdminFlash(res, { type: "ok", message: featured ? "کرا بە تایبەت." : "تایبەتی لابرا." });
    } catch (error) {
      setAdminFlash(res, { type: "error", message: adminErrorMessage(error, "گۆڕینی تایبەت سەرکەوتوو نەبوو.") });
    }
    res.redirect(`/admin/items/${req.params.id}`);
  }),
);

router.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      res.status(400).json({ error: uploadErrorMessage(err) });
    });
  },
  asyncHandler(async (req, res) => {
    try {
      assertCsrf(req);
      if (!req.file) {
        res.status(400).json({ error: "فایل نییە." });
        return;
      }
      const url = await storeAdminUpload(req.file);
      res.json({ url });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "بارکردن سەرکەوتوو نەبوو." });
    }
  }),
);

router.get(
  "/items/:id/preview",
  asyncHandler(async (req, res) => {
    const item = await withAdminRepo((repo) => repo.getById(req.params.id));
    if (!item) {
      setAdminFlash(res, { type: "error", message: "تۆمار نەدۆزرایەوە." });
      res.redirect("/admin/items");
      return;
    }
    const bodyHtml = articleBodyHtml(item.body, item.bodyFormat);
    const coverUrl = coverOf(item);
    await renderPage(res, "article", {
      pageTitle: `[پێشبینین] ${item.title}`,
      pageDescription: item.summary,
      item,
      bodyHtml,
      coverUrl,
      coverAlt: item.media.coverImage?.alt || item.title,
      documentUrl: item.media.documentUrl,
      pdfVolumes: undefined,
      isBook: item.contentType === "book" || item.contentType === "audiobook",
      minutes: readingTime(item.body),
      outlet: sourceOutletLabel(item),
      yearDisplay: item.year ? kuDigits(item.year) : undefined,
      related: [],
      recentItems: [],
      isPreview: true,
    });
  }),
);

router.post(
  "/items/:id/delete",
  asyncHandler(async (req, res) => {
    try {
      assertCsrf(req);
      await withAdminRepo((repo) => repo.delete(req.params.id), "write");
      setAdminFlash(res, { type: "ok", message: "تۆمار سڕایەوە." });
      res.redirect("/admin/items");
    } catch (error) {
      setAdminFlash(res, { type: "error", message: adminErrorMessage(error, "سڕینەوە سەرکەوتوو نەبوو.") });
      res.redirect(`/admin/items/${req.params.id}`);
    }
  }),
);

router.get(
  "/biography",
  asyncHandler(async (_req, res) => {
    const biography = await withAdminRepo((repo) => repo.getBiography());
    await renderAdmin(res, "biography", {
      pageTitle: "ژیاننامە",
      biography,
      breadcrumbs: [{ href: "/admin", label: "سەرەکی" }, { label: "ژیاننامە" }],
    });
  }),
);

router.post(
  "/biography",
  (req, res, next) => {
    upload.single("portrait")(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      setAdminFlash(res, { type: "error", message: uploadErrorMessage(err) });
      res.redirect("/admin/biography");
    });
  },
  asyncHandler(async (req, res) => {
    try {
      assertCsrf(req);
      const body = req.body as Record<string, unknown>;
      let portraitUrl = text(body, "portraitUrl") || DEFAULT_BIOGRAPHY.portraitUrl;
      if (req.file) portraitUrl = await storeAdminUpload(req.file);
      await withAdminRepo(
        (repo) =>
          repo.saveBiography({
            name: text(body, "name") || DEFAULT_BIOGRAPHY.name,
            intro: text(body, "intro"),
            body: typeof body.body === "string" ? body.body : "",
            portraitUrl,
            portraitAlt: text(body, "portraitAlt") || DEFAULT_BIOGRAPHY.portraitAlt,
            note: text(body, "note"),
          }),
        "write",
      );
      setAdminFlash(res, { type: "ok", message: "ژیاننامە پاشەکەوت کرا." });
    } catch (error) {
      setAdminFlash(res, {
        type: "error",
        message: adminErrorMessage(error, "پاشەکەوتکردن سەرکەوتوو نەبوو."),
      });
    }
    res.redirect("/admin/biography");
  }),
);

export default router;
