import ejs from "ejs";
import path from "node:path";
import type { Response } from "express";
import { viewsDir } from "@/lib/render-page";

export async function renderAdmin(
  res: Response,
  view: string,
  data: Record<string, unknown> = {},
  status = 200,
) {
  const locals = { ...res.app.locals, ...res.locals, ...data };
  const body = await ejs.renderFile(path.join(viewsDir, "admin", `${view}.ejs`), locals);
  res.status(status).render("admin/layout", { ...locals, body });
}
