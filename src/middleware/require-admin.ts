import type { RequestHandler } from "express";
import { readAdminSession } from "@/lib/admin-session";

export const requireAdmin: RequestHandler = (req, res, next) => {
  const session = readAdminSession(req);
  if (!session) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/admin");
    res.redirect(`/admin/login?next=${nextUrl}`);
    return;
  }
  req.adminUser = { uid: session.uid, email: session.email };
  res.locals.adminUser = req.adminUser;
  next();
};
