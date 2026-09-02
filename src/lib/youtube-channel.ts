import { readFileSync } from "node:fs";
import path from "node:path";
import { kuDigits } from "@/lib/format";
import { youtubeEmbedUrl, youtubeId, youtubeThumbnail, youtubeWatchUrl } from "@/lib/youtube";
import type { ContentItem, ContentType } from "@/types/content";

export type ChannelVideo = {
  id: string;
  title: string;
  description: string;
  uploadDate: string;
  duration: number;
  watchUrl: string;
};

export type VideoLaneEntry = {
  id: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  contentType: ContentType;
  videoUrl: string;
  embedUrl: string;
  watchUrl: string;
  thumbUrl: string;
  yearLabel: string;
  outlet: string;
  external?: boolean;
};

export function classifyYoutubeVideo(title: string, durationSec: number): ContentType {
  const t = title.trim();
  if (/پۆدکاست|podcast/i.test(t) || /نۆستالیژ/i.test(t)) return "podcast";
  if (/یادی|مەراسیمی|ساڵڕۆژ|ڕێپۆرتاج/i.test(t) || durationSec <= 300) return "video";
  if (/کۆڕ|تێروانین|چاوپێکەوتن|گفتوگۆ/i.test(t) || durationSec >= 900) return "interview";
  return durationSec >= 1200 ? "interview" : "video";
}

function ytSlug(id: string): string {
  return `yt-${id.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function yearFromTitle(title: string, uploadYear: number): number {
  const easternDigits = "٠١٢٣٤٥٦٧٨٩";
  const western = title.replace(/[٠-٩]/g, (ch) => String(easternDigits.indexOf(ch)));
  const match = western.match(/(?:19|20)\d{2}/);
  if (match) return Number(match[0]);
  return uploadYear;
}

export function loadYoutubeSnapshot(): ChannelVideo[] {
  try {
    const file = path.join(process.cwd(), "data/youtube-videos.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as { videos?: ChannelVideo[] };
    return Array.isArray(raw.videos) ? raw.videos : [];
  } catch {
    return [];
  }
}

export function channelVideoToLaneEntry(video: ChannelVideo): VideoLaneEntry {
  const contentType = classifyYoutubeVideo(video.title, video.duration);
  const slug = ytSlug(video.id);
  const uploadYear = /^\d{4}/.test(video.uploadDate)
    ? Number(video.uploadDate.slice(0, 4))
    : new Date().getFullYear();
  const year = yearFromTitle(video.title, uploadYear);

  return {
    id: video.id,
    slug,
    href: video.watchUrl,
    external: true,
    title: video.title,
    summary: video.description || video.title,
    contentType,
    videoUrl: video.watchUrl,
    embedUrl: youtubeEmbedUrl(video.watchUrl) ?? "",
    watchUrl: youtubeWatchUrl(video.watchUrl) ?? video.watchUrl,
    thumbUrl: youtubeThumbnail(video.watchUrl) ?? "",
    yearLabel: year ? `ساڵی ${kuDigits(year)}` : "یوتیوب",
    outlet: "یوتیوب",
  };
}

export function contentItemToVideoEntry(item: ContentItem): VideoLaneEntry | null {
  const videoUrl = item.media?.videoUrl;
  const id = youtubeId(videoUrl);
  const embedUrl = youtubeEmbedUrl(videoUrl);
  const watchUrl = youtubeWatchUrl(videoUrl);
  const thumbUrl = youtubeThumbnail(videoUrl);
  if (!id || !embedUrl || !watchUrl || !thumbUrl) return null;

  return {
    id,
    slug: item.slug,
    href: `/archive/${item.slug}`,
    title: item.title,
    summary: item.summary || item.title,
    contentType: item.contentType,
    videoUrl: videoUrl!,
    embedUrl,
    watchUrl: item.source?.externalUrl || watchUrl,
    thumbUrl,
    yearLabel: item.extras?.outlet
      ? item.extras.outlet
      : item.year
        ? `ساڵی ${kuDigits(item.year)}`
        : "یوتیوب",
    outlet: item.extras?.outlet || "یوتیوب",
  };
}

export function getChannelVideosByType(): Record<"interview" | "podcast" | "video", VideoLaneEntry[]> {
  const grouped: Record<"interview" | "podcast" | "video", VideoLaneEntry[]> = {
    interview: [],
    podcast: [],
    video: [],
  };

  for (const video of loadYoutubeSnapshot()) {
    const entry = channelVideoToLaneEntry(video);
    if (entry.contentType === "interview" || entry.contentType === "podcast" || entry.contentType === "video") {
      grouped[entry.contentType].push(entry);
    }
  }

  return grouped;
}

export function mergeVideoEntries(repo: ContentItem[], snapshot: VideoLaneEntry[]): VideoLaneEntry[] {
  const merged = repo.map(contentItemToVideoEntry).filter((entry): entry is VideoLaneEntry => entry !== null);
  const seen = new Set(merged.map((entry) => entry.id));

  for (const entry of snapshot) {
    if (!seen.has(entry.id)) {
      merged.push(entry);
      seen.add(entry.id);
    }
  }

  return merged;
}
