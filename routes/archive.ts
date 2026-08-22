import { Router } from "express";
import { asyncHandler } from "@/lib/async-handler";
import { yearFacets, groupByYear } from "@/lib/archive-facets";
import { archiveLabels } from "@/lib/archive-labels";
import { contentTypeLabels, sourceOutletLabel } from "@/lib/content-labels";
import { pushRecentSlug, recentItemsFrom } from "@/lib/cookies";
import { kuDigits, readingTime } from "@/lib/format";
import { articleBodyHtml } from "@/lib/markdown";
import { renderPage } from "@/lib/render-page";
import { proxyPdfUrl, volumesForSlug } from "@/lib/pdf-map";
import { coverOf } from "@/lib/view-helpers";
import { withContentRepo } from "@/repositories";
import { ArchiveFiltersSchema, contentTypes } from "@/types/content";

const router = Router();
const PAGE_SIZE = 30;

function first(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const entry = value[0];
    return typeof entry === "string" && entry.trim() ? entry : undefined;
  }
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

function buildArchiveQuery(
  filters: {
    q?: string;
    type?: string;
    year?: number;
    topic?: string;
    language?: string;
  },
  cursor?: string,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.language) params.set("language", filters.language);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `/archive?${qs}` : "/archive";
}

router.get(
  "/archive",
  asyncHandler(async (req, res) => {
    const parsed = ArchiveFiltersSchema.safeParse({
      type: first(req.query.type) || undefined,
      year: first(req.query.year) || undefined,
      topic: first(req.query.topic) || undefined,
      language: first(req.query.language) || undefined,
      q: first(req.query.q) || undefined,
      cursor: first(req.query.cursor) || undefined,
      limit: PAGE_SIZE,
    });

    const filters = parsed.success ? parsed.data : { limit: PAGE_SIZE };

    const [{ items, nextCursor }, matching, all] = await Promise.all([
      withContentRepo((repo) => repo.listPublished(filters)),
      withContentRepo((repo) =>
        repo
          .listPublished({ ...filters, cursor: undefined, limit: 1000 })
          .then((result) => result.items),
      ),
      withContentRepo((repo) => repo.listPublished({ limit: 1000 }).then((result) => result.items)),
    ]);

    const years = yearFacets(all);
    const yearTotals = Object.fromEntries(
      yearFacets(matching).map((facet) => [facet.label, facet.count]),
    );
    const availableTypes = contentTypes.filter((type) => all.some((item) => item.contentType === type));
    const availableLanguages = [...new Set(all.map((item) => item.language))];

    const activeFilters = [
      filters.q ? { label: `«${filters.q}»`, key: "q" } : null,
      filters.type ? { label: contentTypeLabels[filters.type], key: "type" } : null,
      filters.year ? { label: kuDigits(filters.year), key: "year" } : null,
      filters.topic ? { label: filters.topic, key: "topic" } : null,
      filters.language
        ? {
            label:
              filters.language === "ku"
                ? "کوردی"
                : filters.language === "ar"
                  ? "عەرەبی"
                  : "ئینگلیزی",
            key: "language",
          }
        : null,
    ].filter((entry): entry is { label: string; key: string } => entry !== null);

    const groups = groupByYear(items).map(([year, entries]) => ({
      year,
      display: typeof year === "number" ? kuDigits(year) : year,
      count: kuDigits(
        (typeof year === "number" ? yearTotals[String(year)] : undefined) ?? entries.length,
      ),
      items: entries,
    }));

    await renderPage(res, "archive", {
      pageTitle: "ئەرشیف",
      pageDescription: "ئەرشیفی گەڕان و فلتەرکراو بەپێی جۆر، ساڵ، بابەت و زمان.",
      filters,
      years,
      availableTypes,
      availableLanguages,
      activeFilters,
      resultCount: matching.length,
      resultCountDisplay: kuDigits(matching.length),
      totalDisplay: kuDigits(all.length),
      groups,
      nextHref: nextCursor ? buildArchiveQuery(filters, nextCursor) : undefined,
      latestYear: years[0]?.label,
      latestYearDisplay: years[0]?.display,
      archiveLabels,
      contentTypeLabels,
    });
  }),
);

router.get(
  "/archive/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    const [item, all] = await Promise.all([
      withContentRepo((repo) => repo.getBySlug(slug)),
      withContentRepo((repo) => repo.listPublished({ limit: 1000 }).then((result) => result.items)),
    ]);

    if (!item) {
      await renderPage(res, "404", { pageTitle: "نەدۆزرایەوە" }, 404);
      return;
    }

    const slugs = pushRecentSlug(req, res, item.slug);
    const recentItems = recentItemsFrom(all, slugs, item.slug);

    const index = all.findIndex((entry) => entry.id === item.id);
    const newer = index > 0 ? all[index - 1] : undefined;
    const older = index >= 0 && index < all.length - 1 ? all[index + 1] : undefined;

    const related = all
      .filter((entry) => entry.id !== item.id && entry.language === item.language)
      .slice(0, 4);

    const bodyHtml = articleBodyHtml(item.body, item.bodyFormat);
    const coverUrl = coverOf(item);
    const pdfVolumes = volumesForSlug(item.slug);
    const documentUrl =
      item.media.documentUrl ||
      (pdfVolumes.length ? pdfVolumes[0]?.url : undefined) ||
      proxyPdfUrl(item.slug);
    const isBook = item.contentType === "book" || item.contentType === "audiobook";

    await renderPage(res, "article", {
      pageTitle: item.seo?.metaTitle ?? item.title,
      pageDescription: item.seo?.metaDescription ?? item.summary,
      canonical: item.source?.externalUrl,
      item,
      bodyHtml,
      coverUrl,
      coverAlt: item.media.coverImage?.alt || item.title,
      documentUrl,
      pdfVolumes: pdfVolumes.length > 1 ? pdfVolumes : undefined,
      isBook,
      minutes: readingTime(item.body),
      newer,
      older,
      related,
      recentItems,
      outlet: sourceOutletLabel(item),
      yearDisplay: item.year ? kuDigits(item.year) : undefined,
    });
  }),
);

export default router;
