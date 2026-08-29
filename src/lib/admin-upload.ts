import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminStorage } from "@/server/auth/firebase-admin";
import { isUsingSeedFallback } from "@/repositories";
import { resolveStorageBucketName, storageBucketErrorMessage } from "@/lib/firebase-storage-bucket";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

function extOf(name: string): string {
  return path.extname(name || "").toLowerCase();
}

export function inferUploadMime(file: { mimetype?: string; originalname?: string }): string {
  const raw = String(file.mimetype || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw === "application/x-pdf") return "application/pdf";
  if (ALLOWED.has(raw)) return raw;

  const ext = extOf(file.originalname || "");
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".pdf") return "application/pdf";
  return raw;
}

export function isAllowedUpload(file: { mimetype?: string; originalname?: string }): boolean {
  return ALLOWED.has(inferUploadMime(file));
}

function safeName(original: string): string {
  return original.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
}

export async function storeAdminUpload(file: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): Promise<string> {
  const mimetype = inferUploadMime(file);
  if (!ALLOWED.has(mimetype)) {
    throw new Error("جۆری فایل پشتیوانی ناکرێت. وێنە (JPEG, PNG, WebP) یان PDF باربکە.");
  }

  const filename = `${randomUUID()}-${safeName(file.originalname)}`;

  if (isUsingSeedFallback()) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), file.buffer);
    return `/uploads/${filename}`;
  }

  const bucketName = await resolveStorageBucketName();
  const bucket = getAdminStorage().bucket(bucketName);
  const objectPath = `admin/${filename}`;
  const token = randomUUID();
  const object = bucket.file(objectPath);
  try {
    await object.save(file.buffer, {
      contentType: mimetype,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });
  } catch (error) {
    throw new Error(storageBucketErrorMessage(error, "بارکردنی فایل سەرکەوتوو نەبوو."));
  }
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}
