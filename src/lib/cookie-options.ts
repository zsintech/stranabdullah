import type { CookieOptions } from "express";

/** Host-only cookies so admin sessions work on any domain (onrender.com or stranabdullah.org). */
export function appCookieOptions(overrides: CookieOptions = {}): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...overrides,
  };
}
