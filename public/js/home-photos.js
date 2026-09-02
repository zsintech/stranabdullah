(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileHome = window.matchMedia("(max-width: 767px)");

  document.querySelectorAll("[data-photo-lane]").forEach((root) => {
    if (!(root instanceof HTMLElement) || root.dataset.ready === "1") return;
    const isHome = root.classList.contains("photo-lane--home");
    if (root.classList.contains("photo-lane--spread") && !isHome) return;

    const track = root.querySelector("[data-photo-track]");
    const prev = root.querySelector("[data-photo-prev]");
    const next = root.querySelector("[data-photo-next]");
    if (!track || !(track instanceof HTMLElement)) return;
    root.dataset.ready = "1";

    function nearestFrame() {
      const frames = [...track.querySelectorAll(".photo-lane__frame")].filter(
        (el) => el instanceof HTMLElement,
      );
      if (!frames.length) return null;
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let best = frames[0];
      let min = Infinity;
      frames.forEach((frame) => {
        const rect = frame.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - center);
        if (dist < min) {
          min = dist;
          best = frame;
        }
      });
      return best;
    }

    function stepSize() {
      const first = track.querySelector(".photo-lane__frame");
      if (!(first instanceof HTMLElement)) return Math.round(track.clientWidth * 0.72);
      const styles = getComputedStyle(track);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return Math.round(first.getBoundingClientRect().width + gap);
    }

    function scrollByDir(dir) {
      if (isHome && mobileHome.matches) {
        const frames = [...track.querySelectorAll(".photo-lane__frame")].filter(
          (el) => el instanceof HTMLElement,
        );
        const current = nearestFrame();
        if (!current) return;
        const curX = current.getBoundingClientRect().left + current.getBoundingClientRect().width / 2;
        let pick = null;
        let best = Infinity;
        frames.forEach((frame) => {
          if (frame === current) return;
          const fx = frame.getBoundingClientRect().left + frame.getBoundingClientRect().width / 2;
          const delta = fx - curX;
          if (dir * delta <= 0) return;
          const dist = Math.abs(delta);
          if (dist < best) {
            best = dist;
            pick = frame;
          }
        });
        pick?.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior: reduced ? "auto" : "smooth",
        });
        return;
      }
      track.scrollBy({ left: stepSize() * dir, behavior: reduced ? "auto" : "smooth" });
    }

    function updateEdges() {
      const max = Math.max(0, track.scrollWidth - track.clientWidth);
      const pos = Math.abs(track.scrollLeft);
      const atStart = pos <= 2;
      const atEnd = pos >= max - 2;
      root.classList.toggle("is-at-start", atStart || max <= 0);
      root.classList.toggle("is-at-end", atEnd || max <= 0);
      if (prev instanceof HTMLButtonElement) prev.disabled = atStart || max <= 0;
      if (next instanceof HTMLButtonElement) next.disabled = atEnd || max <= 0;
    }

    let rtlFactor = 1;
    {
      const before = track.scrollLeft;
      track.scrollLeft = before + 1;
      rtlFactor = track.scrollLeft >= before ? 1 : -1;
      track.scrollLeft = before;
    }

    prev?.addEventListener("click", () => scrollByDir(rtlFactor));
    next?.addEventListener("click", () => scrollByDir(-rtlFactor));
    track.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges, { passive: true });

    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      track.setPointerCapture(event.pointerId);
      root.classList.add("is-dragging");
    });

    track.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 4) moved = true;
      track.scrollLeft = startScroll - delta * rtlFactor;
    });

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      root.classList.remove("is-dragging");
      try {
        track.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }

    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener(
      "click",
      (event) => {
        if (!moved) return;
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      },
      true,
    );
    track.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollByDir(-rtlFactor);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollByDir(rtlFactor);
      }
    });

    updateEdges();
  });
})();
