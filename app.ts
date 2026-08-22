import "./src/load-env";

import cookieParser from "cookie-parser";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import adminRouter from "./routes/admin";
import archiveRouter from "./routes/archive";
import contactRouter from "./routes/contact";
import mediaRouter from "./routes/media";
import pagesRouter from "./routes/pages";
import { kuDigits } from "./src/lib/format";
import { viewsDir, renderPage } from "./src/lib/render-page";
import {
  coverOf,
  isActivePath,
  isUsefulExcerpt,
  itemMetaParts,
  languageLabel,
  navLinks,
  pageTitle,
} from "./src/lib/view-helpers";
import { contentTypeLabels, sourceAttribution, sourceOutletLabel } from "./src/lib/content-labels";
import {
  formatKuDate,
  formatKuDayMonth,
  formatKuNumeric,
  languageLabels,
  readingTime,
} from "./src/lib/format";
import { archiveLabels } from "./src/lib/archive-labels";
import { SITE_EMAIL, SITE_NAME, SITE_NAME_SHORT, SITE_DESCRIPTION } from "./src/lib/constants";
import { withContentRepo } from "./src/repositories/index";
import { getServerEnv } from "./src/lib/env";
import { readArchiveCountCache, writeArchiveCountCache } from "./src/lib/public-cache";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const stylesFile = path.join(__dirname, "src/styles/globals.css");

const app = express();
const port = Number(process.env.PORT) || 3000;
const cookieSecret =
  process.env.COOKIE_SIGNATURE_SECRET ||
  getServerEnv().COOKIE_SIGNATURE_SECRET ||
  "dev-only-cookie-secret";

app.set("view engine", "ejs");
app.set("views", viewsDir);

app.locals.navLinks = navLinks;
app.locals.isActivePath = isActivePath;
app.locals.coverOf = coverOf;
app.locals.isUsefulExcerpt = isUsefulExcerpt;
app.locals.itemMetaParts = itemMetaParts;
app.locals.languageLabel = languageLabel;
app.locals.pageTitle = pageTitle;
app.locals.contentTypeLabels = contentTypeLabels;
app.locals.sourceAttribution = sourceAttribution;
app.locals.sourceOutletLabel = sourceOutletLabel;
app.locals.formatKuDate = formatKuDate;
app.locals.formatKuNumeric = formatKuNumeric;
app.locals.formatKuDayMonth = formatKuDayMonth;
app.locals.languageLabels = languageLabels;
app.locals.readingTime = readingTime;
app.locals.kuDigits = kuDigits;
app.locals.archiveLabels = archiveLabels;
app.locals.SITE_EMAIL = SITE_EMAIL;
app.locals.SITE_NAME = SITE_NAME;
app.locals.SITE_NAME_SHORT = SITE_NAME_SHORT;
app.locals.SITE_DESCRIPTION = SITE_DESCRIPTION;

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use(express.static(publicDir));
app.get("/styles/app.css", (_req, res) => {
  res.type("text/css").sendFile(stylesFile);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(cookieSecret));

app.use(async (_req, res, next) => {
  try {
    const cache = readArchiveCountCache();
    const now = Date.now();
    if (now - cache.at > 60_000) {
      const { items } = await withContentRepo((repo) => repo.listPublished({ limit: 1000 }));
      writeArchiveCountCache(items.length);
    }
    const latest = readArchiveCountCache();
    res.locals.archiveCount = latest.n;
    res.locals.archiveCountDisplay = kuDigits(latest.n);
    res.locals.copyrightYear = new Date().getFullYear();
  } catch {
    res.locals.archiveCount = 0;
    res.locals.archiveCountDisplay = kuDigits(0);
    res.locals.copyrightYear = new Date().getFullYear();
  }
  next();
});

app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.onHome = req.path === "/";
  // Transparent header over the shared forest atmosphere band (home hero + page mastheads).
  const overHeroPaths = new Set([
    "/",
    "/biography",
    "/archive",
    "/books",
    "/media",
    "/contact",
  ]);
  res.locals.headerOverHero = overHeroPaths.has(req.path);
  next();
});

app.use("/admin", adminRouter);
app.use("/media", mediaRouter);
app.use(pagesRouter);
app.use(archiveRouter);
app.use(contactRouter);

app.use(async (_req, res) => {
  await renderPage(res, "404", { pageTitle: "نەدۆزرایەوە" }, 404);
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).type("html").send("<h1>Server error</h1>");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`stranabdullah listening on http://0.0.0.0:${port}`);
});
