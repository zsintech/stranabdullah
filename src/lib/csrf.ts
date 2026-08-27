import type { Request, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appCookieOptions } from "@/lib/cookie-options";
import { getServerEnv } from "@/lib/env";

const CSRF_COOKIE = "adminCsrf";

function csrfPepper(): string {
  try {
    return getServerEnv().CSRF_SECRET || process.env.COOKIE_SIGNATURE_SECRET || "dev-only-csrf-secret";
  } catch {
    return process.env.CSRF_SECRET || process.env.COOKIE_SIGNATURE_SECRET || "dev-only-csrf-secret";
  }
}

function signToken(nonce: string): string {
  return createHmac("sha256", csrfPepper()).update(nonce).digest("hex").slice(0, 32);
}

export function issueCsrf(res: Response): string {
  const nonce = randomBytes(24).toString("hex");
  const token = `${nonce}.${signToken(nonce)}`;
  res.cookie(
    CSRF_COOKIE,
    token,
    appCookieOptions({ signed: true, maxAge: 1000 * 60 * 60 * 12 }),
  );
  return token;
}

export function readCsrf(req: Request): string | undefined {
  const value = req.signedCookies?.[CSRF_COOKIE];
  return typeof value === "string" ? value : undefined;
}

function tokensMatch(cookie: string, submitted: string): boolean {
  const a = Buffer.from(cookie);
  const b = Buffer.from(submitted);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function tokenWellFormed(token: string): boolean {
  const [nonce, sig] = token.split(".");
  if (!nonce || !sig || nonce.length < 16 || sig.length < 16) return false;
  const expected = signToken(nonce);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertCsrf(req: Request): void {
  const cookie = readCsrf(req);
  const body = req.body as Record<string, unknown> | undefined;
  const header = req.get("x-csrf-token") || "";
  const submitted = typeof body?._csrf === "string" && body._csrf ? body._csrf : header;
  if (!cookie || !submitted || !tokensMatch(cookie, submitted) || !tokenWellFormed(submitted)) {
    throw new CsrfError();
  }
}

export class CsrfError extends Error {
  constructor() {
    super("CSRF token mismatch");
    this.name = "CsrfError";
  }
}
