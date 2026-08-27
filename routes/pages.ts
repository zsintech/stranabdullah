import { Router } from "express";
import { asyncHandler } from "@/lib/async-handler";
import { languageFacets, typeFacets, yearFacets } from "@/lib/archive-facets";
import { archiveLabels } from "@/lib/archive-labels";
import { sourceOutletLabel } from "@/lib/content-labels";
import { kuDigits } from "@/lib/format";
import { countBy, pickUnused } from "@/lib/home";
import { coverOf } from "@/lib/view-helpers";
import { renderPage } from "@/lib/render-page";
import { getAdminContentRepository, withContentRepo } from "@/repositories";
import type { ContentItem } from "@/types/content";
import { DEFAULT_BIOGRAPHY } from "@/types/biography";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [all, books, photoItems] = await Promise.all([
      withContentRepo((repo) => repo.listPublished({ limit: 1000 }).then((result) => result.items)),
      withContentRepo((repo) => repo.getByType("book", 40)),
      withContentRepo((repo) => repo.getByType("photo", 40)),
    ]);

    const years = yearFacets(all);
    const languages = languageFacets(all);
    const types = typeFacets(all);

    const featured = all.find((item) => item.featured) ?? all[0];
    const rest = all.filter((item) => item.id !== featured?.id);
    const photos = photoItems
      .filter((item) => coverOf(item) && item.extras?.homeGallery)
      .sort((a, b) => {
        const ao = typeof a.extras?.homeGalleryOrder === "number" ? a.extras.homeGalleryOrder : 999;
        const bo = typeof b.extras?.homeGalleryOrder === "number" ? b.extras.homeGalleryOrder : 999;
        if (ao !== bo) return ao - bo;
        return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      })
      .slice(0, 8);

    const latest = rest.slice(0, 8);
    const kurdish = pickUnused(rest, latest, (item) => item.language === "ku", 8);
    const arabic = pickUnused(rest, [...latest, ...kurdish], (item) => item.language === "ar", 8);
    const homeBooks = [...books].sort(
      (a, b) => (b.year || 0) - (a.year || 0) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    );

    await renderPage(res, "index", {
      pageTitle: undefined,
      featured,
      latest,
      kurdish,
      arabic,
      books: homeBooks,
      photos,
      years,
      languages,
      types,
      kurdishCount: kuDigits(countBy(all, (item: ContentItem) => item.language === "ku")),
      arabicCount: kuDigits(countBy(all, (item: ContentItem) => item.language === "ar")),
      archiveLabels,
    });
  }),
);

router.get(
  "/biography",
  asyncHandler(async (_req, res) => {
    const all = await withContentRepo((repo) =>
      repo.listPublished({ limit: 1000 }).then((result) => result.items),
    );

    const writings = all.filter(
      (item) => !["book", "audiobook"].includes(item.contentType) && !item.tags?.includes("about"),
    );
    const books = all.filter((item) => item.contentType === "book" || item.contentType === "audiobook");

    const years = yearFacets(writings);
    const languages = languageFacets(writings);

    const outlets = [
      ...writings.reduce((map, item) => {
        const outlet = sourceOutletLabel(item);
        if (outlet) map.set(outlet, (map.get(outlet) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ]
      .sort((a, b) => b[1] - a[1])
      .map(([outlet, count]) => ({ outlet, count, countDisplay: kuDigits(count) }));

    const span =
      years.length > 0 ? `${years[years.length - 1].display}–${years[0].display}` : undefined;

    let biography = DEFAULT_BIOGRAPHY;
    try {
      biography = await getAdminContentRepository().getBiography();
    } catch {
      biography = DEFAULT_BIOGRAPHY;
    }

    await renderPage(res, "biography", {
      pageTitle: "ژیاننامە",
      pageDescription: "ژیاننامە و تۆماری کاری بڵاوکراوەی ستران عەبدوڵڵا.",
      biography,
      years,
      languages,
      outlets,
      span,
      totalDisplay: kuDigits(writings.length),
      booksDisplay: kuDigits(books.length),
      booksCount: books.length,
      languageList: languages.map((facet) => facet.label).join(" · "),
    });
  }),
);

router.get(
  "/books",
  asyncHandler(async (_req, res) => {
    const [books, audiobooks] = await Promise.all([
      withContentRepo((repo) => repo.getByType("book", 40)),
      withContentRepo((repo) => repo.getByType("audiobook", 40)),
    ]);

    await renderPage(res, "books", {
      pageTitle: "کتێبەکان",
      pageDescription: "کتێب و کتێبی دەنگی لە ئەرشیف.",
      books,
      audiobooks,
      empty: books.length === 0 && audiobooks.length === 0,
      booksCount: kuDigits(books.length),
      audioCount: kuDigits(audiobooks.length),
    });
  }),
);

router.get(
  "/media",
  asyncHandler(async (_req, res) => {
    const [interviews, podcasts, videos, photos] = await Promise.all([
      withContentRepo((repo) => repo.getByType("interview", 40)),
      withContentRepo((repo) => repo.getByType("podcast", 40)),
      withContentRepo((repo) => repo.getByType("video", 40)),
      withContentRepo((repo) => repo.getByType("photo", 60)),
    ]);

    await renderPage(res, "media", {
      pageTitle: "میدیا",
      pageDescription: "چاوپێکەوتن، پۆدکاست و ڤیدیۆی ئەرشیف لە یوتیوب، لەگەڵ وێنەکان.",
      interviews,
      podcasts,
      videos,
      photos,
      empty:
        interviews.length === 0 &&
        podcasts.length === 0 &&
        videos.length === 0 &&
        photos.length === 0,
      interviewCount: kuDigits(interviews.length),
      podcastCount: kuDigits(podcasts.length),
      videoCount: kuDigits(videos.length),
      photoCount: kuDigits(photos.length),
      loadLaneCss: true,
    });
  }),
);

export default router;
