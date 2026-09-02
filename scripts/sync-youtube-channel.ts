/**
 * Sync YouTube channel playlists into Firestore and data/youtube-videos.json.
 *
 * Usage:
 *   npx tsx scripts/sync-youtube-channel.ts
 *   YOUTUBE_CHANNEL=@StranAbdulla npx tsx scripts/sync-youtube-channel.ts --dry-run
 */
import "../src/load-env";

process.env.CONTENT_SOURCE ??= "firestore";

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { stripUndefined } from "@/lib/strip-undefined";
import {
  YOUTUBE_PLAYLIST_LABELS,
  type YoutubePlaylistKey,
} from "@/lib/youtube-channel";
import { applyDraft } from "@/repositories/content-draft";
import { getAdminFirestore } from "@/server/auth/firebase-admin";
import type { ContentItem, ContentType } from "@/types/content";

const CHANNEL = process.env.YOUTUBE_CHANNEL || "@StranAbdulla";
const ACTOR = "sync-youtube-channel";
const dryRun = process.argv.includes("--dry-run");

const PLAYLIST_IDS: Record<YoutubePlaylistKey, string> = {
  kurdi: "PLdrq8cG9yoE0",
  interview: "PLJDRXcKsfe00",
  archive: "PLAKldf959CNs",
};

type YtRow = {
  id: string;
  title: string;
  description: string;
  uploadDate: string;
  duration: number;
  watchUrl: string;
  playlist: YoutubePlaylistKey;
};

function ytSlug(id: string): string {
  return `yt-${id.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function uploadDateToIso(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return new Date().toISOString();
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T12:00:00.000Z`;
}

function yearFromTitle(title: string, uploadYear: number): number {
  const easternDigits = "٠١٢٣٤٥٦٧٨٩";
  const western = title.replace(/[٠-٩]/g, (ch) => String(easternDigits.indexOf(ch)));
  const match = western.match(/(?:19|20)\d{2}/);
  if (match) return Number(match[0]);
  return uploadYear;
}

function playlistToContentType(playlist: YoutubePlaylistKey): ContentType {
  return playlist === "archive" ? "video" : "interview";
}

function fetchPlaylistVideos(playlist: YoutubePlaylistKey, playlistId: string): YtRow[] {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  const result = spawnSync(
    "python",
    ["-m", "yt_dlp", "--flat-playlist", "--skip-download", "-j", url],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" }, maxBuffer: 16 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `yt-dlp failed for ${playlist}`);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const row = JSON.parse(line) as {
        id: string;
        title?: string;
        description?: string;
        upload_date?: string;
        duration?: number;
      };
      const id = row.id;
      const title = row.title?.trim() || id;
      return {
        id,
        title,
        description: row.description?.trim() || title,
        uploadDate: row.upload_date?.trim() || "",
        duration: Number(row.duration) || 0,
        watchUrl: `https://www.youtube.com/watch?v=${id}`,
        playlist,
      } satisfies YtRow;
    });
}

function fetchAllPlaylistVideos(): YtRow[] {
  const seen = new Set<string>();
  const videos: YtRow[] = [];
  for (const [key, id] of Object.entries(PLAYLIST_IDS) as Array<[YoutubePlaylistKey, string]>) {
    for (const video of fetchPlaylistVideos(key, id)) {
      if (seen.has(video.id)) continue;
      seen.add(video.id);
      videos.push(video);
    }
  }
  return videos;
}

async function findExistingByYoutubeId(id: string, slug: string): Promise<ContentItem | null> {
  const col = getAdminFirestore().collection("contentItems");
  const byId = await col.where("source.externalId", "==", id).limit(1).get();
  if (!byId.empty) {
    const doc = byId.docs[0];
    return { id: doc.id, ...doc.data() } as ContentItem;
  }
  const bySlug = await col.where("slug", "==", slug).limit(1).get();
  if (!bySlug.empty) {
    const doc = bySlug.docs[0];
    return { id: doc.id, ...doc.data() } as ContentItem;
  }
  return null;
}

async function main() {
  console.log(`Fetching playlists for ${CHANNEL} …`);
  const videos = fetchAllPlaylistVideos();
  if (!videos.length) throw new Error("No videos found in channel playlists.");

  const snapshotPath = path.join(process.cwd(), "data/youtube-videos.json");
  const playlists = (Object.keys(PLAYLIST_IDS) as YoutubePlaylistKey[]).map((key) => ({
    key,
    title: YOUTUBE_PLAYLIST_LABELS[key],
    id: PLAYLIST_IDS[key],
    url: `https://www.youtube.com/playlist?list=${PLAYLIST_IDS[key]}`,
  }));
  writeFileSync(
    snapshotPath,
    JSON.stringify({ channel: CHANNEL, syncedAt: new Date().toISOString(), playlists, videos }, null, 2),
  );
  console.log(`Snapshot → ${snapshotPath} (${videos.length} videos)`);

  const col = getAdminFirestore().collection("contentItems");
  let created = 0;
  let updated = 0;

  for (const video of videos) {
    const slug = ytSlug(video.id);
    const existing = await findExistingByYoutubeId(video.id, slug);
    const uploadYear = /^\d{4}/.test(video.uploadDate)
      ? Number(video.uploadDate.slice(0, 4))
      : new Date().getFullYear();

    const draft = {
      slug: existing?.slug || slug,
      title: video.title,
      summary: video.description || video.title,
      contentType: playlistToContentType(video.playlist),
      language: "ku" as const,
      status: "published" as const,
      publishedAt: uploadDateToIso(video.uploadDate),
      year: yearFromTitle(video.title, uploadYear),
      videoUrl: video.watchUrl,
      outlet: "یوتیوب",
      topics: ["میدیا"],
      tags: ["youtube", "imported", video.playlist],
    };

    console.log(`${existing ? "update" : "create"} [${video.playlist}/${draft.contentType}] ${video.title}`);

    if (dryRun) continue;

    try {
      const item = applyDraft(existing ?? undefined, draft, ACTOR);
      await col.doc(item.id).set(stripUndefined(item));
      const verify = await col.doc(item.id).get();
      if (!verify.exists) throw new Error(`write verification failed for ${video.id}`);
      console.log(`  → ${item.slug}`);
      if (existing) updated += 1;
      else created += 1;
    } catch (error) {
      console.error(`  ✗ failed ${video.id}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(dryRun ? "Dry run complete." : `Done — ${created} created, ${updated} updated.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
