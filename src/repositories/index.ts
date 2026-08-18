import { createFirestoreContentRepository } from "@/repositories/firestore-content-repository";
import { createSeedContentRepository } from "@/repositories/seed-content-repository";
import type { ContentRepository } from "@/repositories/content-repository";
import { isUsingEmulators } from "@/lib/env";

let cached: ContentRepository | null = null;
let usingSeedFallback = false;

const FIRESTORE_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Firestore query timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isUsingSeedFallback(): boolean {
  return usingSeedFallback;
}

export function getContentRepository(): ContentRepository {
  if (cached) return cached;

  const preferSeed =
    process.env.CONTENT_SOURCE === "seed" ||
    process.env.CONTENT_SOURCE === "demo";

  if (preferSeed) {
    cached = createSeedContentRepository();
    usingSeedFallback = true;
    return cached;
  }

  try {
    if (isUsingEmulators() || process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
    }
    cached = createFirestoreContentRepository();
    usingSeedFallback = false;
    return cached;
  } catch {
    cached = createSeedContentRepository();
    usingSeedFallback = true;
    return cached;
  }
}

/** Prefer Firestore; on query failure or timeout fall back to seed. */
export async function withContentRepo<T>(
  fn: (repo: ContentRepository) => Promise<T>,
): Promise<T> {
  const primary = getContentRepository();
  if (usingSeedFallback) {
    return fn(primary);
  }

  try {
    return await withTimeout(fn(primary), FIRESTORE_TIMEOUT_MS);
  } catch {
    usingSeedFallback = true;
    cached = createSeedContentRepository();
    return fn(cached);
  }
}
