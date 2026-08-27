(function () {
  function isImage(file) {
    return (file.type && file.type.startsWith("image/")) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
  }

  function isPdf(file) {
    return file.type === "application/pdf" || file.type === "application/x-pdf" || /\.pdf$/i.test(file.name);
  }

  function bindDrop(drop) {
    const kind = drop.getAttribute("data-drop") || "image";
    const input = drop.querySelector('input[type="file"]');
    if (!input) return;
    const root = drop.closest("form") || document;
    const preview = root.querySelector("[data-cover-preview]");
    const previewImg = preview?.querySelector("img");
    const nameEl = drop.parentElement?.querySelector("[data-file-name]");
    const pdfCurrent = root.querySelector("[data-pdf-current]");
    const pdfLink = root.querySelector("[data-pdf-link]");
    const urlField =
      kind === "pdf" ? root.querySelector("[data-pdf-url]") : root.querySelector("[data-cover-url]");

    function accept(file) {
      return kind === "pdf" ? isPdf(file) : isImage(file);
    }

    function applyFile(file) {
      if (!file || !accept(file)) {
        if (file) input.value = "";
        return;
      }
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      if (kind === "pdf") {
        if (pdfCurrent && pdfLink) {
          pdfLink.textContent = file.name;
          pdfLink.removeAttribute("href");
          pdfCurrent.hidden = false;
        }
        if (urlField) urlField.value = "";
      } else if (preview && previewImg) {
        previewImg.src = URL.createObjectURL(file);
        preview.hidden = false;
      }
      if (nameEl) {
        nameEl.hidden = false;
        nameEl.textContent = file.name;
      }
      drop.classList.add("has-file");
    }

    drop.addEventListener("dragover", (event) => {
      event.preventDefault();
      drop.classList.add("is-dragover");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragover"));
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      drop.classList.remove("is-dragover");
      applyFile(event.dataTransfer?.files?.[0]);
    });
    input.addEventListener("change", () => applyFile(input.files?.[0]));
  }

  document.querySelectorAll("[data-drop]").forEach(bindDrop);

  document.querySelectorAll("form[enctype='multipart/form-data']").forEach((form) => {
    form.addEventListener("submit", () => {
      form.querySelectorAll("button[type='submit']").forEach((button) => {
        button.disabled = true;
        if (!button.dataset.label) button.dataset.label = button.textContent || "";
        button.textContent = "پاشەکەوت دەکرێت…";
      });
      document.querySelectorAll(`button[form='${form.id}']`).forEach((button) => {
        button.disabled = true;
        if (!button.dataset.label) button.dataset.label = button.textContent || "";
        button.textContent = "پاشەکەوت دەکرێت…";
      });
    });
  });

  const form = document.querySelector("[data-admin-editor]");
  if (!form) return;

  const titleInput = form.querySelector("#title");
  const slugInput = form.querySelector("#slug");
  const bodyInput = form.querySelector("#body");
  const writePanel = form.querySelector("[data-write-panel]");
  const previewPanel = form.querySelector("[data-preview-panel]");
  const writeTools = form.querySelector("[data-write-tools]");
  const compose = form.querySelector("[data-compose]");
  const tabButtons = form.querySelectorAll("[data-editor-tab]");
  const uploadBtn = form.querySelector("[data-upload-inline]");
  const csrf = form.querySelector('input[name="_csrf"]')?.value;
  const isNew = form.dataset.isNew === "true";

  if (isNew && titleInput && slugInput) {
    let slugTouched = Boolean(slugInput.value);
    slugInput.addEventListener("input", () => {
      slugTouched = true;
    });
    titleInput.addEventListener("input", () => {
      if (slugTouched) return;
      slugInput.value = slugify(titleInput.value);
    });
  }

  function slugify(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-editor-tab");
      tabButtons.forEach((entry) => {
        const active = entry === button;
        entry.classList.toggle("is-active", active);
        entry.setAttribute("aria-selected", active ? "true" : "false");
      });
      if (writePanel) writePanel.hidden = tab !== "write";
      if (writeTools) writeTools.hidden = tab !== "write";
      if (previewPanel) {
        previewPanel.hidden = tab !== "preview";
        if (tab === "preview") renderPreview();
      }
    });
  });

  function renderPreview() {
    if (!previewPanel || !bodyInput) return;
    const source = bodyInput.value.trim();
    if (!source) {
      previewPanel.innerHTML = '<p class="admin-preview-empty">هیچ دەقێک نییە. بگەڕێوە بۆ نووسین و دەقێک بنووسە.</p>';
      return;
    }
    previewPanel.innerHTML = simpleMarkdown(source);
  }

  function simpleMarkdown(source) {
    const escaped = source
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (/^#{1,3}\s/.test(trimmed)) {
          const level = trimmed.match(/^#+/)[0].length;
          const text = trimmed.replace(/^#+\s*/, "");
          return `<h${Math.min(level + 1, 4)}>${inline(text)}</h${Math.min(level + 1, 4)}>`;
        }
        if (/^>\s/.test(trimmed)) {
          return `<blockquote>${inline(trimmed.replace(/^>\s?/gm, ""))}</blockquote>`;
        }
        if (/^[-*]\s/m.test(trimmed)) {
          const items = trimmed.split(/\n/).map((line) => `<li>${inline(line.replace(/^[-*]\s*/, ""))}</li>`);
          return `<ul>${items.join("")}</ul>`;
        }
        return `<p>${inline(trimmed.replace(/\n/g, "<br />"))}</p>`;
      })
      .join("\n");
  }

  function inline(text) {
    return text
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function insertAtCursor(snippet, selectInside) {
    if (!bodyInput) return;
    const start = bodyInput.selectionStart ?? bodyInput.value.length;
    const end = bodyInput.selectionEnd ?? bodyInput.value.length;
    bodyInput.value = bodyInput.value.slice(0, start) + snippet + bodyInput.value.slice(end);
    bodyInput.focus();
    if (selectInside) {
      bodyInput.setSelectionRange(start + selectInside[0], start + selectInside[1]);
    } else {
      const pos = start + snippet.length;
      bodyInput.setSelectionRange(pos, pos);
    }
  }

  function wrapSelection(before, after, emptyText) {
    if (!bodyInput) return;
    const start = bodyInput.selectionStart ?? 0;
    const end = bodyInput.selectionEnd ?? 0;
    const selected = bodyInput.value.slice(start, end);
    const inner = selected || emptyText;
    const snippet = before + inner + after;
    bodyInput.value = bodyInput.value.slice(0, start) + snippet + bodyInput.value.slice(end);
    bodyInput.focus();
    if (selected) {
      const pos = start + snippet.length;
      bodyInput.setSelectionRange(pos, pos);
    } else {
      bodyInput.setSelectionRange(start + before.length, start + before.length + inner.length);
    }
  }

  function prefixLines(prefix) {
    if (!bodyInput) return;
    const start = bodyInput.selectionStart ?? 0;
    const end = bodyInput.selectionEnd ?? 0;
    const value = bodyInput.value;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextNl = value.indexOf("\n", end);
    const cutEnd = nextNl < 0 ? value.length : nextNl;
    const chunk = value.slice(lineStart, cutEnd);
    const lines = (chunk === "" ? [""] : chunk.split("\n")).map((line) => {
      if (line.startsWith(prefix)) return line;
      return prefix + line;
    });
    const snippet = lines.join("\n");
    bodyInput.value = value.slice(0, lineStart) + snippet + value.slice(cutEnd);
    bodyInput.focus();
    const pos = lineStart + snippet.length;
    bodyInput.setSelectionRange(pos, pos);
  }

  form.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.getAttribute("data-format");
      if (kind === "bold") wrapSelection("**", "**", "دەقی قەڵەو");
      if (kind === "italic") wrapSelection("*", "*", "دەقی لار");
      if (kind === "heading") prefixLines("## ");
      if (kind === "list") prefixLines("- ");
      if (kind === "quote") prefixLines("> ");
      if (kind === "link") wrapSelection("[", "](https://)", "دەقی لینک");
    });
  });

  async function uploadInlineImage(file) {
    if (!file || !isImage(file) || !csrf || !bodyInput) return;
    if (uploadBtn) {
      uploadBtn.disabled = true;
      if (!uploadBtn.dataset.label) uploadBtn.dataset.label = uploadBtn.textContent || "";
      uploadBtn.textContent = "باردەکرێت…";
    }
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("_csrf", csrf);
      const response = await fetch("/admin/upload", {
        method: "POST",
        body: data,
        credentials: "same-origin",
        headers: { "x-csrf-token": csrf },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "بارکردنی وێنە سەرکەوتوو نەبوو.");
      insertAtCursor(`\n\n![${file.name}](${payload.url})\n\n`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "بارکردنی وێنە سەرکەوتوو نەبوو.");
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = uploadBtn.dataset.label || "وێنە";
      }
    }
  }

  if (uploadBtn && bodyInput && csrf) {
    const hiddenFile = document.createElement("input");
    hiddenFile.type = "file";
    hiddenFile.accept = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
    hiddenFile.hidden = true;
    form.appendChild(hiddenFile);

    uploadBtn.addEventListener("click", () => hiddenFile.click());
    hiddenFile.addEventListener("change", async () => {
      const file = hiddenFile.files?.[0];
      hiddenFile.value = "";
      await uploadInlineImage(file);
    });
  }

  if (compose && bodyInput) {
    compose.addEventListener("dragover", (event) => {
      if (![...event.dataTransfer.items].some((item) => item.kind === "file")) return;
      event.preventDefault();
      compose.classList.add("is-dragover");
    });
    compose.addEventListener("dragleave", () => compose.classList.remove("is-dragover"));
    compose.addEventListener("drop", async (event) => {
      compose.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (!file || !isImage(file)) return;
      event.preventDefault();
      await uploadInlineImage(file);
    });
  }

  /* ── Kind picker + YouTube helpers ── */
  const YT_TYPES = new Set(["interview", "podcast", "video"]);
  const BOOK_TYPES = new Set(["book", "audiobook"]);
  const kindRadios = form.querySelectorAll("[data-kind]");
  const writingRadio = form.querySelector("[data-kind-writing-radio]");
  const writingType = form.querySelector("[data-writing-type]");
  const youtubeUrl = form.querySelector("[data-youtube-url]");
  const youtubePreview = form.querySelector("[data-youtube-preview]");
  const youtubeThumb = form.querySelector("[data-youtube-thumb]");
  const youtubeIdEl = form.querySelector("[data-youtube-id]");
  const youtubeOpen = form.querySelector("[data-youtube-open]");
  const coverUrlField = form.querySelector("[data-cover-url]");
  const labelTitle = form.querySelector("[data-label-title]");
  const labelSubtitle = form.querySelector("[data-label-subtitle]");
  const labelSummary = form.querySelector("[data-label-summary]");
  const labelCover = form.querySelector("[data-label-cover]");
  const hintCover = form.querySelector("[data-hint-cover]");

  function currentKind() {
    const checked = form.querySelector("[data-kind]:checked");
    return checked ? checked.value : "article";
  }

  function setPanel(name, visible) {
    form.querySelectorAll(`[data-panel="${name}"]`).forEach((el) => {
      el.hidden = !visible;
    });
  }

  function syncKindUi() {
    const kind = currentKind();
    form.querySelectorAll(".admin-kind").forEach((label) => {
      const input = label.querySelector("[data-kind]");
      label.classList.toggle("is-active", Boolean(input && input.checked));
    });

    const isYt = YT_TYPES.has(kind);
    const isPhoto = kind === "photo";
    const isBook = BOOK_TYPES.has(kind);
    const isWriting = !isYt && !isPhoto && !isBook;

    setPanel("youtube", isYt);
    setPanel("cover", true);
    setPanel("home-gallery", isPhoto);
    setPanel("pdf", isBook);
    setPanel("body", isWriting || isBook);
    setPanel("writing-extra", isWriting);

    if (labelTitle) labelTitle.textContent = isPhoto ? "سەردێڕی وێنە" : isYt ? "ناونیشانی ڤیدیۆ" : "ناونیشان";
    if (labelSubtitle) {
      labelSubtitle.textContent = isPhoto
        ? "هێڵی دووەم (ساڵ / شوێن)"
        : isYt
          ? "ژێرناونیشان"
          : "ژێرناونیشان / هێڵی دووەم";
    }
    if (labelSummary) {
      labelSummary.textContent = isPhoto || isYt ? "وەسف" : "کورتە / وەسف";
    }
    if (labelCover) {
      labelCover.textContent = isPhoto ? "وێنە" : isYt ? "وێنەی بەرگ (ئارەزوومەندانە)" : "وێنەی بەرگ";
    }
    if (hintCover) {
      hintCover.textContent = isYt
        ? "ئەگەر بەتاڵ بێت، وێنەی یوتیوب خۆکار بەکاردێت."
        : isPhoto
          ? "وێنە بار بکە — ئەمە لە پەڕەی میدیا و کارۆسێلی سەرەکی دەردەکەوێت."
          : "وێنە بار بکە یان URL دابنێ.";
    }
  }

  kindRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio === writingRadio && writingType) {
        radio.value = writingType.value || "article";
      }
      syncKindUi();
    });
  });

  if (writingType && writingRadio) {
    writingType.addEventListener("change", () => {
      writingRadio.value = writingType.value;
      writingRadio.checked = true;
      syncKindUi();
    });
  }

  function extractYoutubeId(raw) {
    if (!raw) return "";
    try {
      const url = new URL(raw.trim());
      const host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || "";
      if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
        if (url.searchParams.get("v")) return url.searchParams.get("v") || "";
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") return parts[1] || "";
      }
    } catch {
      const match = String(raw).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
      return match ? match[1] : "";
    }
    return "";
  }

  function syncYoutubePreview() {
    if (!youtubeUrl) return;
    const id = extractYoutubeId(youtubeUrl.value);
    if (!id) {
      if (youtubePreview) youtubePreview.hidden = true;
      if (youtubeOpen) youtubeOpen.hidden = true;
      return;
    }
    const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const watch = `https://www.youtube.com/watch?v=${id}`;
    if (youtubeThumb) youtubeThumb.src = thumb;
    if (youtubeIdEl) youtubeIdEl.textContent = `ID: ${id}`;
    if (youtubeOpen) {
      youtubeOpen.href = watch;
      youtubeOpen.hidden = false;
    }
    if (youtubePreview) youtubePreview.hidden = false;
    if (coverUrlField && !coverUrlField.value.trim()) {
      coverUrlField.value = thumb;
      const preview = form.querySelector("[data-cover-preview]");
      const previewImg = preview?.querySelector("img");
      if (preview && previewImg) {
        previewImg.src = thumb;
        preview.hidden = false;
      }
    }
  }

  if (youtubeUrl) {
    youtubeUrl.addEventListener("input", syncYoutubePreview);
    youtubeUrl.addEventListener("change", syncYoutubePreview);
    syncYoutubePreview();
  }

  syncKindUi();
})();
