(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-video-lane]").forEach((root) => {
    if (!(root instanceof HTMLElement) || root.dataset.ready === "1") return;
    root.dataset.ready = "1";

    root.querySelectorAll("[data-video-play]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener("click", () => {
        const embedUrl = button.getAttribute("data-embed-url");
        const frame = button.closest(".video-lane__frame");
        const frameHost = frame?.querySelector("[data-video-frame]");
        if (!embedUrl || !frameHost || frameHost.querySelector("iframe")) return;

        const iframe = document.createElement("iframe");
        iframe.src = embedUrl;
        iframe.title = button.getAttribute("aria-label") || "ڤیدیۆ";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.loading = "lazy";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";

        frameHost.hidden = false;
        frameHost.appendChild(iframe);
        frame?.classList.add("is-playing");
        iframe.focus();
      });
    });

    const track = root.querySelector("[data-video-track]");
    if (!(track instanceof HTMLElement)) return;

    const prev = root.querySelector("[data-video-prev]");
    const next = root.querySelector("[data-video-next]");
    const isSpread = root.classList.contains("video-lane--spread");

    function stepSize() {
      const first = track.querySelector(".video-lane__frame");
      if (!(first instanceof HTMLElement)) return Math.round(track.clientWidth * 0.72);
      const styles = getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return Math.round(first.getBoundingClientRect().width + gap);
    }

    function updateEdges() {
      const max = track.scrollWidth - track.clientWidth;
      const atStart = track.scrollLeft <= 2;
      const atEnd = track.scrollLeft >= max - 2;
      root.classList.toggle("is-at-start", atStart || max <= 0);
      root.classList.toggle("is-at-end", atEnd || max <= 0);
      if (prev instanceof HTMLButtonElement) prev.disabled = atStart || max <= 0;
      if (next instanceof HTMLButtonElement) next.disabled = atEnd || max <= 0;
    }

    if (!isSpread) {
      let rtlFactor = 1;
      {
        const before = track.scrollLeft;
        track.scrollLeft = before + 1;
        rtlFactor = track.scrollLeft >= before ? 1 : -1;
        track.scrollLeft = before;
      }

      function scrollByDir(dir) {
        track.scrollBy({ left: stepSize() * dir, behavior: reduced ? "auto" : "smooth" });
      }

      prev?.addEventListener("click", () => scrollByDir(rtlFactor));
      next?.addEventListener("click", () => scrollByDir(-rtlFactor));
    }

    track.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges, { passive: true });
    updateEdges();
  });
})();
