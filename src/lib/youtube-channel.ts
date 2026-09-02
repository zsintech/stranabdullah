import { readFileSync } from "node:fs";
import path from "node:path";
import { kuDigits } from "@/lib/format";
import { youtubeEmbedUrl, youtubeId, youtubeThumbnail, youtubeWatchUrl } from "@/lib/youtube";
import type { ContentItem, ContentType } from "@/types/content";

export type YoutubePlaylistKey = "kurdi" | "interview" | "archive";

export type ChannelVideo = {
  id: string;
  title: string;
  description: string;
  uploadDate: string;
  duration: number;
  watchUrl: string;
  playlist: YoutubePlaylistKey;
};

export type YoutubePlaylistMeta = {
  key: YoutubePlaylistKey;
  title: string;
  id: string;
  url: string;
};

export type VideoLaneEntry = {
  id: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  playlist: YoutubePlaylistKey;
  contentType: ContentType;
  videoUrl: string;
  embedUrl: string;
  watchUrl: string;
  thumbUrl: string;
  yearLabel: string;
  outlet: string;
  external?: boolean;
};

export const YOUTUBE_PLAYLIST_ORDER: YoutubePlaylistKey[] = ["kurdi", "interview", "archive"];

export const YOUTUBE_PLAYLIST_LABELS: Record<YoutubePlaylistKey, string> = {
  kurdi: "کۆڕ",
  interview: "چاوپێکەوتن",
  archive: "ئەرشیف",
};

type SnapshotFile = {
  playlists?: YoutubePlaylistMeta[];
  videos?: Array<ChannelVideo & { playlist?: YoutubePlaylistKey }>;
};

function yearFromTitle(title: string, uploadYear: number): number {
  const easternDigits = "٠١٢٣٤٥٦٧٨٩";
  const western = title.replace(/[٠-٩]/g, (ch) => String(easternDigits.indexOf(ch)));
  const match = western.match(/(?:19|20)\d{2}/);
  if (match) return Number(match[0]);
  return uploadYear;
}

function ytSlug(id: string): string {
  return `yt-${id.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function playlistToContentType(playlist: YoutubePlaylistKey): ContentType {
  if (playlist === "archive") return "video";
  return "interview";
}

export function loadYoutubeSnapshot(): { playlists: YoutubePlaylistMeta[]; videos: ChannelVideo[] } {
  try {
    const file = path.join(process.cwd(), "data/youtube-videos.json");
    const raw = JSON.parse(readFileSync(file, "utf8")) as SnapshotFile;
    const playlists = Array.isArray(raw.playlists) ? raw.playlists : [];
    const videos = Array.isArray(raw.videos)
      ? raw.videos
          .filter((video): video is ChannelVideo => Boolean(video.id && video.playlist))
          .map((video) => ({
            id: video.id,
            title: video.title,
            description: video.description || video.title,
            uploadDate: video.uploadDate || "",
            duration: Number(video.duration) || 0,
            watchUrl: video.watchUrl || `https://www.youtube.com/watch?v=${video.id}`,
            playlist: video.playlist as YoutubePlaylistKey,
          }))
      : [];
    return { playlists, videos };
  } catch {
    return { playlists: [], videos: [] };
  }
}

export function getYoutubePlaylistMeta(key: YoutubePlaylistKey): YoutubePlaylistMeta | undefined {
  return loadYoutubeSnapshot().playlists.find((playlist) => playlist.key === key);
}

export function channelVideoToLaneEntry(video: ChannelVideo): VideoLaneEntry {
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
    playlist: video.playlist,
    contentType: playlistToContentType(video.playlist),
    videoUrl: video.watchUrl,
    embedUrl: youtubeEmbedUrl(video.watchUrl) ?? "",
    watchUrl: youtubeWatchUrl(video.watchUrl) ?? video.watchUrl,
    thumbUrl: youtubeThumbnail(video.watchUrl) ?? "",
    yearLabel: year ? `ساڵی ${kuDigits(year)}` : "یوتیوب",
    outlet: "یوتیوب",
  };
}

function inferPlaylistFromItem(item: ContentItem): YoutubePlaylistKey | null {
  if (item.contentType === "video") return "archive";
  if (item.contentType === "interview") return "interview";
  if (item.contentType === "podcast") return "interview";
  return null;
}

export function contentItemToVideoEntry(item: ContentItem): VideoLaneEntry | null {
  const videoUrl = item.media?.videoUrl;
  const id = youtubeId(videoUrl);
  const embedUrl = youtubeEmbedUrl(videoUrl);
  const watchUrl = youtubeWatchUrl(videoUrl);
  const thumbUrl = youtubeThumbnail(videoUrl);
  const playlist = inferPlaylistFromItem(item);
  if (!id || !embedUrl || !watchUrl || !thumbUrl || !playlist) return null;

  return {
    id,
    slug: item.slug,
    href: `/archive/${item.slug}`,
    title: item.title,
    summary: item.summary || item.title,
    playlist,
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

export function getChannelVideosByPlaylist(): Record<YoutubePlaylistKey, VideoLaneEntry[]> {
  const grouped: Record<YoutubePlaylistKey, VideoLaneEntry[]> = {
    kurdi: [],
    interview: [],
    archive: [],
  };

  for (const video of loadYoutubeSnapshot().videos) {
    const entry = channelVideoToLaneEntry(video);
    grouped[video.playlist].push(entry);
  }

  return grouped;
}

export function mergeVideoEntries(
  repo: ContentItem[],
  snapshot: VideoLaneEntry[],
  playlist: YoutubePlaylistKey,
): VideoLaneEntry[] {
  const merged = repo
    .map(contentItemToVideoEntry)
    .filter((entry): entry is VideoLaneEntry => entry !== null && entry.playlist === playlist);
  const seen = new Set(merged.map((entry) => entry.id));

  for (const entry of snapshot) {
    if (entry.playlist === playlist && !seen.has(entry.id)) {
      merged.push(entry);
      seen.add(entry.id);
    }
  }

  return merged;
}

/** @deprecated Use playlist keys from YouTube instead of title heuristics. */
export function classifyYoutubeVideo(title: string, durationSec: number): ContentType {
  const t = title.trim();
  if (/پۆدکاست|podcast/i.test(t) || /نۆستالیژ/i.test(t)) return "interview";
  if (/یادی|مەراسیمی|ساڵڕۆژ|ڕێپۆرتاج/i.test(t) || durationSec <= 300) return "video";
  if (/کۆڕ|تێروانین|چاوپێکەوتن|گفتوگۆ/i.test(t) || durationSec >= 900) return "interview";
  return durationSec >= 1200 ? "interview" : "video";
}
