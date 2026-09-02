/**
 * Sync published YouTube channel videos into Firestore as interview / podcast / video items.
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
import { applyDraft } from "@/repositories/content-draft";
import { getAdminFirestore } from "@/server/auth/firebase-admin";
import type { ContentItem, ContentType } from "@/types/content";

const CHANNEL = process.env.YOUTUBE_CHANNEL || "@StranAbdulla";
const CHANNEL_URL = `https://www.youtube.com/${CHANNEL.replace(/^@?/, "@")}/videos`;
const ACTOR = "sync-youtube-channel";
const dryRun = process.argv.includes("--dry-run");

type YtRow = {
  id: string;
  title: string;
  description: string;
  uploadDate: string;
  duration: number;
  watchUrl: string;
};

function ytSlug(id: string): string {
  return `yt-${id.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function uploadDateToIso(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return new Date().toISOString();
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T12:00:00.000Z`;
}

function classifyVideo(title: string, durationSec: number): ContentType {
  const t = title.trim();
  if (/پۆدکاست|podcast/i.test(t) || /نۆستالیژ/i.test(t)) return "podcast";
  if (/یادی|مەراسیمی|ساڵڕۆژ|ڕێپۆرتاج/i.test(t) || durationSec <= 300) return "video";
  if (/کۆڕ|تێروانین|چاوپێکەوتن|گفتوگۆ/i.test(t) || durationSec >= 900) return "interview";
  return durationSec >= 1200 ? "interview" : "video";
}

function yearFromTitle(title: string, uploadYear: number): number {
  const easternDigits = "٠١٢٣٤٥٦٧٨٩";
  const western = title.replace(/[٠-٩]/g, (ch) => String(easternDigits.indexOf(ch)));
  const match = western.match(/(?:19|20)\d{2}/);
  if (match) return Number(match[0]);
  return uploadYear;
}

function fetchChannelVideos(): YtRow[] {
  const result = spawnSync(
    "python",
    ["-m", "yt_dlp", "--flat-playlist", "--skip-download", "-j", CHANNEL_URL],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" }, maxBuffer: 16 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "yt-dlp failed — install with: pip install yt-dlp");
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
      } satisfies YtRow;
    });
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
  console.log(`Fetching ${CHANNEL_URL} …`);
  const videos = fetchChannelVideos();
  if (!videos.length) throw new Error("No videos found on channel.");

  const snapshotPath = path.join(process.cwd(), "data/youtube-videos.json");
  writeFileSync(snapshotPath, JSON.stringify({ channel: CHANNEL, syncedAt: new Date().toISOString(), videos }, null, 2));
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
      contentType: classifyVideo(video.title, video.duration),
      language: "ku" as const,
      status: "published" as const,
      publishedAt: uploadDateToIso(video.uploadDate),
      year: yearFromTitle(video.title, uploadYear),
      videoUrl: video.watchUrl,
      outlet: "یوتیوب",
      topics: ["میدیا"],
      tags: ["youtube", "imported"],
    };

    console.log(`${existing ? "update" : "create"} [${draft.contentType}] ${video.title}`);

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
