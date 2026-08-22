import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(source: string): string {
  if (!source.trim()) return "";
  return marked.parse(source, { async: false }) as string;
}

export function articleBodyHtml(body: string, bodyFormat: "markdown" | "plain" | "portable"): string {
  if (!body.trim()) return "";
  if (bodyFormat === "plain") {
    return body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
      .join("\n");
  }
  return renderMarkdown(body);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
