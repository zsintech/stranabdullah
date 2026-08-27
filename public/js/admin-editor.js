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
    hiddenFile.accept = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
    hiddenFile.hidden = true;
    form.appendChild(hiddenFile);

    uploadBtn.addEventListener("click", () => hiddenFile.click());
    hiddenFile.addEventListener("change", async () => {
      const file = hiddenFile.files?.[0];
      if (!file) return;
      uploadBtn.disabled = true;
      const previous = uploadBtn.textContent;
      uploadBtn.textContent = "باردەکرێت…";
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
        if (!response.ok) throw new Error(payload.error || "بارکردن سەرکەوتوو نەبوو.");
        insertAtCursor(`\n\n![${file.name}](${payload.url})\n\n`);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "بارکردن سەرکەوتوو نەبوو.");
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = previous || "وێنە باربکە";
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
})();
