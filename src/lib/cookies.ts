import type { Request, Response } from "express";
import type { ContentItem } from "@/types/content";

const RECENT_COOKIE = "recentlyViewed";
const FLASH_COOKIE = "flash";
const MAX_RECENT = 8;
const RECENT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export function readRecentSlugs(req: Request): string[] {
  const raw = req.signedCookies?.[RECENT_COOKIE];
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentSlug(req: Request, res: Response, slug: string): string[] {
  const next = [slug, ...readRecentSlugs(req).filter((entry) => entry !== slug)].slice(0, MAX_RECENT);
  res.cookie(RECENT_COOKIE, JSON.stringify(next), {
    signed: true,
    httpOnly: true,
    maxAge: RECENT_MAX_AGE_MS,
    sameSite: "lax",
  });
  return next;
}

export function recentItemsFrom(all: ContentItem[], slugs: string[], excludeSlug?: string): ContentItem[] {
  const bySlug = new Map(all.map((item) => [item.slug, item]));
  return slugs
    .filter((slug) => slug !== excludeSlug)
    .map((slug) => bySlug.get(slug))
    .filter((item): item is ContentItem => Boolean(item))
    .slice(0, 4);
}

export function setFlash(res: Response, value: "sent" | "demo"): void {
  res.cookie(FLASH_COOKIE, value, {
    httpOnly: true,
    maxAge: 60_000,
    sameSite: "lax",
  });
}

export function consumeFlash(req: Request, res: Response): "sent" | "demo" | undefined {
  const value = req.cookies?.[FLASH_COOKIE];
  if (value === "sent" || value === "demo") {
    res.clearCookie(FLASH_COOKIE);
    return value;
  }
  return undefined;
}
