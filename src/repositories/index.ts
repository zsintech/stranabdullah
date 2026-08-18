import { createFirestoreContentRepository } from "@/repositories/firestore-content-repository";
import { createSeedContentRepository } from "@/repositories/seed-content-repository";
import type { AdminContentRepository, ContentRepository } from "@/repositories/content-repository";
import { isUsingEmulators } from "@/lib/env";

let cached: AdminContentRepository | null = null;
let usingSeedFallback = false;

const FIRESTORE_TIMEOUT_MS = 8000;

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

function preferSeed(): boolean {
  return process.env.CONTENT_SOURCE === "seed" || process.env.CONTENT_SOURCE === "demo";
}

function requireFirestore(): boolean {
  return process.env.CONTENT_SOURCE === "firestore";
}

export function isUsingSeedFallback(): boolean {
  return usingSeedFallback;
}

export function getContentRepository(): ContentRepository {
  return getAdminContentRepository();
}

export function getAdminContentRepository(): AdminContentRepository {
  if (cached) return cached;

  if (preferSeed()) {
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
  } catch (error) {
    console.error("Firestore init failed; serving seed content until credentials are available.", error);
    cached = createSeedContentRepository();
    usingSeedFallback = true;
    return cached;
  }
}

/** Prefer Firestore; on query failure or timeout fall back to seed — unless CONTENT_SOURCE=firestore. */
export async function withContentRepo<T>(
  fn: (repo: ContentRepository) => Promise<T>,
): Promise<T> {
  const primary = getContentRepository();
  if (usingSeedFallback) {
    return fn(primary);
  }

  try {
    return await withTimeout(fn(primary), FIRESTORE_TIMEOUT_MS);
  } catch (error) {
    if (requireFirestore()) throw error;
    usingSeedFallback = true;
    cached = createSeedContentRepository();
    return fn(cached);
  }
}
