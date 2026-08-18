import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminStorage } from "@/server/auth/firebase-admin";
import { isUsingSeedFallback } from "@/repositories";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

function safeName(original: string): string {
  return original.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
}

export async function storeAdminUpload(file: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): Promise<string> {
  if (!ALLOWED.has(file.mimetype)) {
    throw new Error("جۆری فایل پشتیوانی ناکرێت.");
  }

  const filename = `${randomUUID()}-${safeName(file.originalname)}`;

  if (isUsingSeedFallback()) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), file.buffer);
    return `/uploads/${filename}`;
  }

  const bucket = getAdminStorage().bucket();
  const objectPath = `admin/${filename}`;
  const token = randomUUID();
  const object = bucket.file(objectPath);
  await object.save(file.buffer, {
    contentType: file.mimetype,
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}
