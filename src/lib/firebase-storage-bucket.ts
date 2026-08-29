import { getPublicEnv, getServerEnv } from "@/lib/env";
import { getAdminStorage } from "@/server/auth/firebase-admin";

export class StorageBucketError extends Error {
  readonly projectId: string;
  readonly tried: string[];

  constructor(projectId: string, tried: string[]) {
    super(
      `Firebase Storage bucket not found. Enable Storage in Firebase Console (Build → Storage → Get started), then set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET on Render to the bucket name shown there (often ${projectId}.firebasestorage.app or ${projectId}.appspot.com).`,
    );
    this.name = "StorageBucketError";
    this.projectId = projectId;
    this.tried = tried;
  }
}

export function storageBucketErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof StorageBucketError) {
    return (
      "Firebase Storage چالاک نییە یان ناوی bucket هەڵەیە. لە Firebase Console → Storage → Get started چالاکی بکە، ناوی bucket لە Render لە NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET دابنێ."
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/bucket does not exist|notFound|404/i.test(message)) {
    return "bucket ی Storage نەدۆزرایەوە — Storage لە Firebase Console چالاک بکە و NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET بپشکنە.";
  }
  return fallback;
}

export function normalizeBucketName(raw: string): string {
  return raw.replace(/^gs:\/\//i, "").trim();
}

export function projectIdForStorage(): string {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();
  return serverEnv.FIREBASE_ADMIN_PROJECT_ID ?? publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

export function storageBucketCandidates(projectId: string, configured?: string): string[] {
  const out: string[] = [];
  const add = (value?: string) => {
    if (!value) return;
    const name = normalizeBucketName(value);
    if (name && !out.includes(name)) out.push(name);
  };
  add(configured);
  add(`${projectId}.firebasestorage.app`);
  add(`${projectId}.appspot.com`);
  return out;
}

let cachedBucket: string | undefined;

export function clearStorageBucketCache(): void {
  cachedBucket = undefined;
}

export async function resolveStorageBucketName(): Promise<string> {
  if (cachedBucket) return cachedBucket;

  const projectId = projectIdForStorage();
  const configured = getPublicEnv().NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const storage = getAdminStorage();
  const tried = storageBucketCandidates(projectId, configured);

  for (const name of tried) {
    try {
      const [exists] = await storage.bucket(name).exists();
      if (exists) {
        cachedBucket = name;
        if (name !== normalizeBucketName(configured)) {
          console.warn(
            `Firebase Storage: using bucket "${name}" (configured: "${configured}"). Update NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET on Render.`,
          );
        }
        return name;
      }
    } catch {
      // try next candidate
    }
  }

  throw new StorageBucketError(projectId, tried);
}
