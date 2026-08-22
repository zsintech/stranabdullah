(function () {
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
    const maxWidth = stage.clientWidth - padding;
    const viewport = page.getViewport({ scale: 1 });
    return Math.min(2.2, Math.max(0.6, maxWidth / viewport.width));
  }

  function updatePageLabel() {
    if (!pageLabel || !pdfDoc) return;
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
    const page = await pdfDoc.getPage(num);
    if (scale <= 0) scale = fitScale(page);
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.hidden = false;
    if (loading) loading.hidden = true;
    await page.render({ canvasContext: context, viewport }).promise;
    rendering = false;
    updatePageLabel();
    if (fitBtn) fitBtn.textContent = `${Math.round(scale * 100)}%`;
    if (pendingPage !== null) {
      const next = pendingPage;
      pendingPage = null;
      await renderPage(next);
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
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    pdfDoc = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
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
      } catch {
        showLoading("بارکردنی PDF سەرکەوتوو نەبوو. فایلەکە داگرە.");
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goNext();
    if (event.key === "ArrowRight") goPrev();
  });

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

  loadPdf(src).catch(() => {
    showLoading("بارکردنی PDF سەرکەوتوو نەبوو. فایلەکە داگرە.");
  });
})();
