import { Router } from "express";
import { asyncHandler } from "@/lib/async-handler";
import { languageFacets, typeFacets, yearFacets } from "@/lib/archive-facets";
import { archiveLabels } from "@/lib/archive-labels";
import { sourceOutletLabel } from "@/lib/content-labels";
import { kuDigits } from "@/lib/format";
import { countBy, pickUnused } from "@/lib/home";
import { renderPage } from "@/lib/render-page";
import { coverOf } from "@/lib/view-helpers";
import {
  getChannelVideosByPlaylist,
  getYoutubePlaylistMeta,
  mergeVideoEntries,
  YOUTUBE_PLAYLIST_LABELS,
} from "@/lib/youtube-channel";
import { withContentRepo, withAdminRepo } from "@/repositories";
import type { ContentItem } from "@/types/content";
import { DEFAULT_BIOGRAPHY } from "@/types/biography";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [all, books, photoItems] = await Promise.all([
      withContentRepo((repo) => repo.listPublished({ limit: 1000 }).then((result) => result.items)),
      withContentRepo((repo) => repo.getByType("book", 40)),
      withContentRepo((repo) => repo.getByType("photo", 100)),
    ]);

    const years = yearFacets(all);
    const languages = languageFacets(all);
    const types = typeFacets(all);

    const featured = all.find((item) => item.featured) ?? all[0];
    const rest = all.filter((item) => item.id !== featured?.id);
    const photoDate = (item: ContentItem) => item.publishedAt ?? item.audit?.updatedAt ?? "";
    const withCover = photoItems.filter((item) => coverOf(item));
    const flagged = withCover.filter((item) => item.extras?.homeGallery);
    const photos = (flagged.length ? flagged : withCover).sort((a, b) => {
      const orderA = typeof a.extras?.homeGalleryOrder === "number" ? a.extras.homeGalleryOrder : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.extras?.homeGalleryOrder === "number" ? b.extras.homeGalleryOrder : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return photoDate(b).localeCompare(photoDate(a));
    });

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
      biography = await withAdminRepo((repo) => repo.getBiography());
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
    const [interviews, videos, photos] = await Promise.all([
      withContentRepo((repo) => repo.getByType("interview", 40)),
      withContentRepo((repo) => repo.getByType("video", 40)),
      withContentRepo((repo) => repo.getByType("photo", 60)),
    ]);

    const channelByPlaylist = getChannelVideosByPlaylist();
    const kurdiEntries = mergeVideoEntries(interviews, channelByPlaylist.kurdi, "kurdi");
    const interviewEntries = mergeVideoEntries(interviews, channelByPlaylist.interview, "interview");
    const archiveVideoEntries = mergeVideoEntries(videos, channelByPlaylist.archive, "archive");

    const kurdiPlaylist = getYoutubePlaylistMeta("kurdi");
    const interviewPlaylist = getYoutubePlaylistMeta("interview");
    const archivePlaylist = getYoutubePlaylistMeta("archive");

    await renderPage(res, "media", {
      pageTitle: "میدیا",
      pageDescription: "ڤیدیۆکانی یوتیوب بەپێی کۆڕ، چاوپێکەوتن و ئەرشیف، لەگەڵ وێنەکان.",
      interviews,
      videos,
      photos,
      kurdiEntries,
      interviewEntries,
      archiveVideoEntries,
      kurdiPlaylist,
      interviewPlaylist,
      archivePlaylist,
      youtubePlaylistLabels: YOUTUBE_PLAYLIST_LABELS,
      empty:
        kurdiEntries.length === 0 &&
        interviewEntries.length === 0 &&
        archiveVideoEntries.length === 0 &&
        photos.length === 0,
      kurdiCount: kuDigits(kurdiEntries.length),
      interviewCount: kuDigits(interviewEntries.length),
      videoCount: kuDigits(archiveVideoEntries.length),
      photoCount: kuDigits(photos.length),
      loadLaneCss: true,
    });
  }),
);

export default router;
