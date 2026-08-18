import type { Request, Response } from "express";
import { getServerEnv } from "@/lib/env";

export const ADMIN_SESSION_COOKIE = "adminSession";
const FLASH_COOKIE = "adminFlash";

export type AdminSession = {
  uid: string;
  email: string;
  exp: number;
};

export type AdminFlash = {
  type: "ok" | "error";
  message: string;
};

function cookieName(): string {
  return getServerEnv().SESSION_COOKIE_NAME || ADMIN_SESSION_COOKIE;
}

function expiresDays(): number {
  const raw = getServerEnv().SESSION_EXPIRES_DAYS;
  const n = raw ? Number(raw) : 14;
  return Number.isFinite(n) && n > 0 ? n : 14;
}

export function allowedAdminEmails(): string[] {
  const raw = getServerEnv().ADMIN_ALLOWED_EMAILS ?? "";
  return raw
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string): boolean {
  const allow = allowedAdminEmails();
  if (!allow.length) return false;
  return allow.includes(email.trim().toLowerCase());
}

export function setAdminSession(res: Response, session: Omit<AdminSession, "exp">): void {
  const maxAge = expiresDays() * 24 * 60 * 60 * 1000;
  const payload: AdminSession = {
    ...session,
    exp: Date.now() + maxAge,
  };
  res.cookie(cookieName(), JSON.stringify(payload), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
}

export function clearAdminSession(res: Response): void {
  res.clearCookie(cookieName(), { path: "/" });
}

export function readAdminSession(req: Request): AdminSession | null {
  const raw = req.signedCookies?.[cookieName()];
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed?.uid || !parsed?.email || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    if (!isAllowedAdminEmail(parsed.email)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAdminFlash(res: Response, flash: AdminFlash): void {
  res.cookie(FLASH_COOKIE, JSON.stringify(flash), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60_000,
    path: "/",
  });
}

export function consumeAdminFlash(req: Request, res: Response): AdminFlash | undefined {
  const raw = req.cookies?.[FLASH_COOKIE];
  res.clearCookie(FLASH_COOKIE, { path: "/" });
  if (typeof raw !== "string") return undefined;
  try {
    const parsed = JSON.parse(raw) as AdminFlash;
    if (parsed.type !== "ok" && parsed.type !== "error") return undefined;
    if (typeof parsed.message !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
