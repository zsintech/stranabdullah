import type { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";

const CSRF_COOKIE = "adminCsrf";

export function issueCsrf(res: Response): string {
  const token = randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 12,
  });
  return token;
}

export function readCsrf(req: Request): string | undefined {
  const value = req.signedCookies?.[CSRF_COOKIE];
  return typeof value === "string" ? value : undefined;
}

export function assertCsrf(req: Request): void {
  const cookie = readCsrf(req);
  const body = req.body as Record<string, unknown> | undefined;
  const submitted = typeof body?._csrf === "string" ? body._csrf : "";
  if (!cookie || !submitted) {
    throw new CsrfError();
  }
  const a = Buffer.from(cookie);
  const b = Buffer.from(submitted);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new CsrfError();
  }
}

export class CsrfError extends Error {
  constructor() {
    super("CSRF token mismatch");
    this.name = "CsrfError";
  }
}
