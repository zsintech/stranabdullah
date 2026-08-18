import ejs from "ejs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Response } from "express";

const viewsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../views");

export async function renderPage(
  res: Response,
  view: string,
  data: Record<string, unknown> = {},
  status = 200,
) {
  const locals = { ...res.app.locals, ...res.locals, ...data };
  const body = await ejs.renderFile(path.join(viewsDir, `${view}.ejs`), locals);
  res.status(status).render("layout", { ...locals, body });
}

export { viewsDir };
