(function () {
  const form = document.querySelector("[data-admin-editor]");
  if (!form) return;

  const titleInput = form.querySelector("#title");
  const slugInput = form.querySelector("#slug");
  const bodyInput = form.querySelector("#body");
  const coverInput = form.querySelector("#cover");
  const coverPreview = form.querySelector("[data-cover-preview]");
  const coverPreviewImg = coverPreview?.querySelector("img");
  const coverDrop = form.querySelector("[data-cover-drop]");
  const writePanel = form.querySelector("[data-write-panel]");
  const previewPanel = form.querySelector("[data-preview-panel]");
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

  function showCoverPreview(url) {
    if (!coverPreview || !coverPreviewImg) return;
    coverPreviewImg.src = url;
    coverPreview.hidden = false;
  }

  if (coverInput) {
    coverInput.addEventListener("change", () => {
      const file = coverInput.files?.[0];
      if (!file) return;
      showCoverPreview(URL.createObjectURL(file));
    });
  }

  if (coverDrop && coverInput) {
    coverDrop.addEventListener("click", () => coverInput.click());
    coverDrop.addEventListener("dragover", (event) => {
      event.preventDefault();
      coverDrop.classList.add("is-dragover");
    });
    coverDrop.addEventListener("dragleave", () => coverDrop.classList.remove("is-dragover"));
    coverDrop.addEventListener("drop", (event) => {
      event.preventDefault();
      coverDrop.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      coverInput.files = dt.files;
      showCoverPreview(URL.createObjectURL(file));
    });
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-editor-tab");
      tabButtons.forEach((entry) => entry.classList.toggle("is-active", entry === button));
      if (writePanel) writePanel.hidden = tab !== "write";
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
      previewPanel.innerHTML = '<p class="admin-preview-empty">هیچ دەقێک نییە.</p>';
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

  if (uploadBtn && bodyInput && csrf) {
    const hiddenFile = document.createElement("input");
    hiddenFile.type = "file";
    hiddenFile.accept = "image/*";
    hiddenFile.hidden = true;
    form.appendChild(hiddenFile);

    uploadBtn.addEventListener("click", () => hiddenFile.click());
    hiddenFile.addEventListener("change", async () => {
      const file = hiddenFile.files?.[0];
      if (!file) return;
      uploadBtn.disabled = true;
      uploadBtn.textContent = "باردەکرێت…";
      try {
        const data = new FormData();
        data.append("file", file);
        data.append("_csrf", csrf);
        const response = await fetch("/admin/upload", { method: "POST", body: data });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "بارکردن سەرکەوتوو نەبوو.");
        insertAtCursor(`\n\n![${file.name}](${payload.url})\n\n`);
      } catch (error) {
        alert(error instanceof Error ? error.message : "بارکردن سەرکەوتوو نەبوو.");
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "وێنە باربکە";
        hiddenFile.value = "";
      }
    });
  }

  function insertAtCursor(snippet) {
    const start = bodyInput.selectionStart ?? bodyInput.value.length;
    const end = bodyInput.selectionEnd ?? bodyInput.value.length;
    bodyInput.value = bodyInput.value.slice(0, start) + snippet + bodyInput.value.slice(end);
    bodyInput.focus();
    const pos = start + snippet.length;
    bodyInput.setSelectionRange(pos, pos);
  }

  const pdfDrop = form.querySelector("[data-pdf-drop]");
  const pdfInput = form.querySelector("#document");
  const pdfCurrent = form.querySelector("[data-pdf-current]");
  const pdfLink = form.querySelector("[data-pdf-link]");
  const pdfUrlField = form.querySelector("[data-pdf-url]");
  const contentTypeSelect = form.querySelector("#contentType");
  const pdfCard = form.querySelector("[data-pdf-admin]");

  function syncPdfCardVisibility() {
    if (!pdfCard || !contentTypeSelect) return;
    const type = contentTypeSelect.value;
    const show = type === "book" || type === "audiobook" || type === "document";
    pdfCard.hidden = !show;
  }

  if (contentTypeSelect) {
    contentTypeSelect.addEventListener("change", syncPdfCardVisibility);
    syncPdfCardVisibility();
  }

  function showPdfSelected(name) {
    if (!pdfCurrent || !pdfLink) return;
    pdfLink.textContent = name || "فایلی هەڵبژێردراو";
    pdfLink.removeAttribute("href");
    pdfCurrent.hidden = false;
  }

  if (pdfDrop && pdfInput) {
    pdfDrop.addEventListener("click", () => pdfInput.click());
    pdfDrop.addEventListener("dragover", (event) => {
      event.preventDefault();
      pdfDrop.classList.add("is-dragover");
    });
    pdfDrop.addEventListener("dragleave", () => pdfDrop.classList.remove("is-dragover"));
    pdfDrop.addEventListener("drop", (event) => {
      event.preventDefault();
      pdfDrop.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (!file || file.type !== "application/pdf") return;
      const dt = new DataTransfer();
      dt.items.add(file);
      pdfInput.files = dt.files;
      showPdfSelected(file.name);
      if (pdfUrlField) pdfUrlField.value = "";
    });
    pdfInput.addEventListener("change", () => {
      const file = pdfInput.files?.[0];
      if (file) showPdfSelected(file.name);
    });
  }
})();
