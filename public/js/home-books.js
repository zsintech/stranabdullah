(() => {
  const root = document.querySelector("[data-book-lane]");
  if (!root) return;

  const track = root.querySelector("[data-book-track]");
  if (!track || !(track instanceof HTMLElement)) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function stepSize() {
    const first = track.querySelector(".book-lane__frame");
    if (!(first instanceof HTMLElement)) return Math.round(track.clientWidth * 0.42);
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
  }

  function scrollByDir(dir) {
    track.scrollBy({ left: stepSize() * dir, behavior: reduced ? "auto" : "smooth" });
  }

  let rtlFactor = 1;
  {
    const before = track.scrollLeft;
    track.scrollLeft = before + 1;
    rtlFactor = track.scrollLeft >= before ? 1 : -1;
    track.scrollLeft = before;
  }

  let dragging = false;
  let captured = false;
  let startX = 0;
  let startScroll = 0;
  let moved = false;
  let didScrub = false;
  let pressLink = null;
  let opened = false;
  const DRAG_THRESHOLD = 12;

  function frameFrom(event) {
    if (!(event.target instanceof Element)) return null;
    return event.target.closest("a.book-lane__frame");
  }

  function wasScrub() {
    return Math.abs(track.scrollLeft - startScroll) >= DRAG_THRESHOLD;
  }

  function openBook(link, event) {
    if (opened) return true;
    if (!(link instanceof HTMLAnchorElement)) return false;
    const href = link.getAttribute("href");
    if (!href || href === "#") return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    opened = true;
    event.preventDefault();
    window.location.assign(link.href);
    return true;
  }

  track.addEventListener("pointerdown", (event) => {
    pressLink = frameFrom(event);
    startX = event.clientX;
    startScroll = track.scrollLeft;
    moved = false;
    didScrub = false;
    captured = false;
    opened = false;
    if (event.pointerType === "touch") {
      dragging = false;
      return;
    }
    dragging = true;
  });

  track.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const delta = event.clientX - startX;
    if (!moved && Math.abs(delta) < DRAG_THRESHOLD) return;
    moved = true;
    if (!captured) {
      try {
        track.setPointerCapture(event.pointerId);
        captured = true;
      } catch {
        /* ignore */
      }
      root.classList.add("is-dragging");
    }
    track.scrollLeft = startScroll - delta * rtlFactor;
  });

  function endDrag(event) {
    dragging = false;
    root.classList.remove("is-dragging");
    if (captured) {
      try {
        track.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    captured = false;
  }

  track.addEventListener("pointerup", (event) => {
    didScrub = wasScrub();
    if (!didScrub) openBook(pressLink, event);
    endDrag(event);
  });

  track.addEventListener("pointercancel", (event) => {
    didScrub = wasScrub();
    endDrag(event);
    pressLink = null;
    moved = false;
  });

  track.addEventListener(
    "click",
    (event) => {
      if (didScrub) {
        event.preventDefault();
        event.stopPropagation();
        didScrub = false;
        pressLink = null;
        moved = false;
        return;
      }
      const link = pressLink instanceof HTMLAnchorElement ? pressLink : frameFrom(event);
      pressLink = null;
      moved = false;
      if (openBook(link, event)) return;
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

  track.addEventListener("scroll", updateEdges, { passive: true });
  window.addEventListener("resize", updateEdges, { passive: true });
  updateEdges();
})();
