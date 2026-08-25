(() => {
  const root = document.querySelector("[data-photo-lane]");
  if (!root) return;

  const track = root.querySelector("[data-photo-track]");
  const prev = root.querySelector("[data-photo-prev]");
  const next = root.querySelector("[data-photo-next]");
  if (!track || !(track instanceof HTMLElement)) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function stepSize() {
    const first = track.querySelector(".photo-lane__frame");
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

  function scrollByDir(dir) {
    // RTL: positive scrollLeft moves toward visual "start" in some engines;
    // use scrollBy with sign that matches button intent via getBoundingClientRect.
    const amount = stepSize() * dir;
    track.scrollBy({ left: amount, behavior: reduced ? "auto" : "smooth" });
  }

  // In RTL, "next" (‹, toward older/left content in our layout) should reveal more to the left.
  // Measure once: if scrollLeft decreases when scrolling visually leftward, flip.
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

  // Pointer drag to scrub the strip.
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
})();
