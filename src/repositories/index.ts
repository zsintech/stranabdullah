import { createFirestoreContentRepository } from "@/repositories/firestore-content-repository";
import { createSeedContentRepository } from "@/repositories/seed-content-repository";
import type { AdminContentRepository, ContentRepository } from "@/repositories/content-repository";
import { isUsingEmulators } from "@/lib/env";

let cached: AdminContentRepository | null = null;
let usingSeedFallback = false;
let firestoreDegraded = false;

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

export function isQuotaOrTransient(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error ? Number((error as { code: unknown }).code) : NaN;
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === 8 ||
    code === 14 ||
    /RESOURCE_EXHAUSTED|Quota exceeded|UNAVAILABLE|timed out/i.test(message)
  );
}

export class FirestoreUnavailableError extends Error {
  constructor() {
    super(
      "سنووری بەکارهێنانی Firestore تەواو بووە. خوێندنەوە کاتی دەگەڕێتەوە بۆ ناوەڕۆکی ناوخۆیی؛ پاشەکەوتکردن تا کاتێک کۆتا دێتەوە کار ناکات. دواتر هەوڵبدەرەوە یان پلانی Firebase بەرز بکەرەوە.",
    );
    this.name = "FirestoreUnavailableError";
  }
}

export function isUsingSeedFallback(): boolean {
  return usingSeedFallback;
}

export function isFirestoreDegraded(): boolean {
  return firestoreDegraded;
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

/** Prefer Firestore; on query failure or timeout fall back to seed. Quota errors always fall back so the public site stays up. */
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
    const allowSeed = !requireFirestore() || isQuotaOrTransient(error);
    if (!allowSeed) throw error;
    console.error("Firestore query failed; serving seed content.", error);
    firestoreDegraded = true;
    if (!requireFirestore()) {
      usingSeedFallback = true;
      cached = createSeedContentRepository();
      return fn(cached);
    }
    return fn(createSeedContentRepository());
  }
}

/** Admin reads fall back to seed on quota; writes surface a clear error instead of a 500. */
export async function withAdminRepo<T>(
  fn: (repo: AdminContentRepository) => Promise<T>,
  mode: "read" | "write" = "read",
): Promise<T> {
  const primary = getAdminContentRepository();
  if (usingSeedFallback) {
    return fn(primary);
  }

  try {
    return await withTimeout(fn(primary), FIRESTORE_TIMEOUT_MS);
  } catch (error) {
    if (!isQuotaOrTransient(error)) throw error;
    firestoreDegraded = true;
    console.error(`Admin Firestore ${mode} failed.`, error);
    if (mode === "write") {
      throw new FirestoreUnavailableError();
    }
    return fn(createSeedContentRepository());
  }
}

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FirestoreUnavailableError) return error.message;
  if (isQuotaOrTransient(error)) return new FirestoreUnavailableError().message;
  return error instanceof Error ? error.message : fallback;
}
