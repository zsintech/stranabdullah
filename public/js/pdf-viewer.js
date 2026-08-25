(function () {
  const PDFJS_VER = "3.11.174";
  const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}`;
  const PDFJS_FONTS = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}`;

  const root = document.querySelector("[data-pdf-reader]");
  if (!root) return;

  let src = root.getAttribute("data-src");
  if (!src) return;

  const canvas = root.querySelector("[data-pdf-canvas]");
  const stage = root.querySelector("[data-pdf-stage]");
  const loading = root.querySelector("[data-pdf-loading]");
  const pageLabel = root.querySelector("[data-pdf-page]");
  const prevBtn = root.querySelector("[data-pdf-prev]");
  const nextBtn = root.querySelector("[data-pdf-next]");
  const zoomInBtn = root.querySelector("[data-pdf-zoom-in]");
  const zoomOutBtn = root.querySelector("[data-pdf-zoom-out]");
  const fitBtn = root.querySelector("[data-pdf-fit]");
  const downloadLink = root.querySelector("[data-pdf-download]");
  const volumeBtns = root.querySelectorAll("[data-pdf-volume]");

  let pdfDoc = null;
  let pageNum = 1;
  let scale = 1;
  let rendering = false;
  let pendingPage = null;
  let renderTask = null;

  function waitForPdfJs() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const check = setInterval(() => {
        if (window.pdfjsLib) {
          clearInterval(check);
          resolve(window.pdfjsLib);
        }
      }, 40);
      setTimeout(() => {
        clearInterval(check);
        reject(new Error("pdf.js load failed"));
      }, 15000);
    });
  }

  function fitScale(page) {
    if (!stage) return 1;
    const padding = 32;
    const maxWidth = Math.max(280, stage.clientWidth - padding);
    const maxHeight = Math.max(420, stage.clientHeight - padding);
    const viewport = page.getViewport({ scale: 1 });
    const scaleW = maxWidth / viewport.width;
    const scaleH = maxHeight / viewport.height;
    // Fit entire page in the stage (not just width) so title pages aren't a blank white crop.
    return Math.min(2.2, Math.max(0.35, Math.min(scaleW, scaleH)));
  }

  function updatePageLabel() {
    if (!pageLabel || !pdfDoc) return;
    // Keep numerals LTR inside the RTL page (avoids "227 / 1" looking swapped).
    pageLabel.textContent = `${pageNum} / ${pdfDoc.numPages}`;
  }

  function showLoading(message) {
    if (!loading) return;
    loading.hidden = false;
    loading.textContent = message || "PDF بار دەکرێت…";
    if (canvas) canvas.hidden = true;
  }

  async function renderPage(num) {
    if (!pdfDoc || !canvas) return;
    rendering = true;
    try {
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore */
        }
        renderTask = null;
      }

      const page = await pdfDoc.getPage(num);
      if (scale <= 0) scale = fitScale(page);

      const outputScale = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.hidden = false;
      if (loading) loading.hidden = true;

      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, viewport.width, viewport.height);

      renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;
      renderTask = null;

      updatePageLabel();
      if (fitBtn) fitBtn.textContent = `${Math.round(scale * 100)}%`;
    } catch (error) {
      if (error?.name === "RenderingCancelledException") return;
      console.error("PDF render failed", error);
      showLoading("بارکردنی لاپەڕە سەرکەوتوو نەبوو.");
    } finally {
      rendering = false;
      if (pendingPage !== null) {
        const next = pendingPage;
        pendingPage = null;
        await renderPage(next);
      }
    }
  }

  function queueRenderPage(num) {
    if (rendering) {
      pendingPage = num;
      return;
    }
    renderPage(num);
  }

  function goPrev() {
    if (!pdfDoc || pageNum <= 1) return;
    pageNum -= 1;
    queueRenderPage(pageNum);
  }

  function goNext() {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    pageNum += 1;
    queueRenderPage(pageNum);
  }

  async function loadPdf(url) {
    showLoading();
    pdfDoc = null;
    pageNum = 1;
    scale = 0;
    const pdfjsLib = await waitForPdfJs();
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
    pdfDoc = await pdfjsLib.getDocument({
      url,
      withCredentials: false,
      // Required for Arabic/Kurdish (and most non-Latin) text PDFs.
      cMapUrl: `${PDFJS_CDN}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_FONTS}/standard_fonts/`,
    }).promise;
    await renderPage(pageNum);
  }

  prevBtn?.addEventListener("click", goPrev);
  nextBtn?.addEventListener("click", goNext);
  zoomInBtn?.addEventListener("click", () => {
    scale = Math.min(2.5, scale + 0.15);
    queueRenderPage(pageNum);
  });
  zoomOutBtn?.addEventListener("click", () => {
    scale = Math.max(0.5, scale - 0.15);
    queueRenderPage(pageNum);
  });
  fitBtn?.addEventListener("click", async () => {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(pageNum);
    scale = fitScale(page);
    queueRenderPage(pageNum);
  });

  volumeBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const nextSrc = btn.getAttribute("data-pdf-volume");
      if (!nextSrc || nextSrc === src) return;
      src = nextSrc;
      root.setAttribute("data-src", src);
      if (downloadLink) downloadLink.setAttribute("href", src);
      volumeBtns.forEach((other) => {
        const active = other === btn;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-selected", active ? "true" : "false");
      });
      try {
        await loadPdf(src);
      } catch (error) {
        console.error("PDF load failed", error);
        showLoading("بارکردنی PDF سەرکەوتوو نەبوو. فایلەکە داگرە.");
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;
    if (event.key === "ArrowLeft") goNext();
    if (event.key === "ArrowRight") goPrev();
  });

  let touchStartX = 0;
  let touchStartY = 0;
  stage?.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    },
    { passive: true },
  );
  stage?.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      if (dx < 0) goNext();
      else goPrev();
    },
    { passive: true },
  );

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      if (!pdfDoc) return;
      const page = await pdfDoc.getPage(pageNum);
      scale = fitScale(page);
      queueRenderPage(pageNum);
    }, 180);
  });

  loadPdf(src).catch((error) => {
    console.error("PDF load failed", error);
    showLoading("بارکردنی PDF سەرکەوتوو نەبوو. فایلەکە داگرە.");
  });
})();
