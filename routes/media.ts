import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { asyncHandler } from "@/lib/async-handler";
import { parseBookPdfParam, resolveRemotePdf } from "@/lib/pdf-map";
import { getAdminContentRepository } from "@/repositories";

const router = Router();

async function pipeRemotePdf(res: import("express").Response, remote: string): Promise<void> {
  const upstream = await fetch(remote);
  if (!upstream.ok || !upstream.body) {
    res.status(502).send("Upstream PDF unavailable");
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "public, max-age=86400");
  Readable.fromWeb(upstream.body as import("stream/web").ReadableStream).pipe(res);
}

router.get(
  "/books/:slug.pdf",
  asyncHandler(async (req, res) => {
    const { slug, volumeKey } = parseBookPdfParam(req.params.slug);
    const repo = getAdminContentRepository();
    const item = (await repo.listAll({ type: "book" })).find((book) => book.slug === slug);

    if (!item) {
      res.status(404).send("Not found");
      return;
    }

    const localSuffix = volumeKey ? `--${volumeKey}` : "";
    const localCandidates = [
      path.join(process.cwd(), "data/book-pdfs", `${slug}${localSuffix}.pdf`),
      path.join(process.cwd(), "data/book-pdfs", `${slug}.pdf`),
      path.join(process.cwd(), "public/uploads", `${slug}${localSuffix}.pdf`),
      path.join(process.cwd(), "public/uploads", `${slug}.pdf`),
    ];

    for (const localPath of localCandidates) {
      if (fs.existsSync(localPath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Cache-Control", "public, max-age=604800");
        fs.createReadStream(localPath).pipe(res);
        return;
      }
    }

    if (!volumeKey && item.media.documentUrl?.startsWith("http")) {
      await pipeRemotePdf(res, item.media.documentUrl.replace(/^http:/, "https:"));
      return;
    }

    const remote = resolveRemotePdf(slug, volumeKey);
    if (!remote) {
      res.status(404).send("PDF not available");
      return;
    }

    await pipeRemotePdf(res, remote);
  }),
);

export default router;
