(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof window.Peel !== "function" || !window.Peel.supported) {
    return;
  }

  const allowHover = window.matchMedia("(any-pointer: fine)").matches;
  const LIFT_MS = 350;
  const RETURN_MS = 400;
  const CORNER = window.Peel.Corners.BOTTOM_LEFT;
  const ease = cubicBezier(0.22, 1, 0.36, 1);

  function cubicBezier(x1, y1, x2, y2) {
    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      let x = t;
      for (let i = 0; i < 8; i++) {
        const cx = 3 * x1;
        const bx = 3 * (x2 - x1) - cx;
        const ax = 1 - cx - bx;
        const current = ((ax * x + bx) * x + cx) * x - t;
        const slope = 3 * ax * x * x + 2 * bx * x + cx;
        if (Math.abs(current) < 1e-6) break;
        if (Math.abs(slope) < 1e-6) break;
        x -= current / slope;
      }
      const cy = 3 * y1;
      const by = 3 * (y2 - y1) - cy;
      const ay = 1 - cy - by;
      return ((ay * x + by) * x + cy) * x;
    };
  }

  function fixClipUrls(root) {
    const base = window.location.pathname;
    root.querySelectorAll(".peel-layer").forEach((el) => {
      ["clipPath", "webkitClipPath"].forEach((prop) => {
        const val = el.style[prop];
        if (!val || typeof val !== "string") return;
        const match = /url\(["']?#([^"')]+)["']?\)/.exec(val);
        if (match) el.style[prop] = 'url("' + base + "#" + match[1] + '")';
      });
    });
  }

  function setPath(peel) {
    const w = peel.width;
    const h = peel.height;
    peel.setPeelPath(
      0,
      h,
      w * 0.04,
      h - h * 0.08,
      w * 0.1,
      h - h * 0.13,
      w * 0.16,
      h - h * 0.15,
    );
  }

  function setup(root) {
    if (!(root instanceof HTMLElement) || root.dataset.peelReady) return;
    if (root.offsetWidth < 8 || root.offsetHeight < 8) return;

    const frame = root.closest(".book-lane__frame");
    const track = root.closest("[data-book-track]");
    if (!frame) return;

    root.setAttribute("dir", "ltr");

    let peel;
    try {
      peel = new window.Peel(root, {
        corner: CORNER,
        setPeelOnInit: false,
        clippingBoxScale: 4,
        dragPreventsDefault: false,
        topShadow: true,
        topShadowAlpha: 0.32,
        topShadowBlur: 5,
        topShadowOffsetX: 0,
        topShadowOffsetY: 1,
        backShadow: true,
        backShadowSize: 0.06,
        backShadowAlpha: 0.12,
        bottomShadow: true,
        bottomShadowSize: 1.2,
        bottomShadowDarkAlpha: 0.42,
        bottomShadowLightAlpha: 0.08,
        backReflection: true,
        backReflectionSize: 0.035,
        backReflectionAlpha: 0.1,
      });
    } catch {
      return;
    }

    setPath(peel);
    fixClipUrls(root);
    root.classList.add("is-flat");
    root.dataset.peelReady = "1";

    let progress = 0;
    let from = 0;
    let to = 0;
    let started = 0;
    let duration = LIFT_MS;
    let raf = 0;
    let hovering = false;

    function apply(t) {
      if (t <= 0.001) {
        root.classList.add("is-flat");
        frame.classList.remove("is-peeling");
        if (track && !track.querySelector(".is-peeling")) {
          track.classList.remove("is-peeling-track");
        }
        return;
      }
      root.classList.remove("is-flat");
      frame.classList.add("is-peeling");
      if (track) track.classList.add("is-peeling-track");
      peel.setTimeAlongPath(t);
    }

    function tick(now) {
      const u = Math.min(1, (now - started) / duration);
      progress = from + (to - from) * ease(u);
      apply(progress);
      if (u < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      progress = to;
      raf = 0;
      apply(progress);
    }

    function go(next) {
      from = progress;
      to = next;
      duration = next > progress ? LIFT_MS : RETURN_MS;
      started = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function targetFromPointer(event) {
      const rect = root.getBoundingClientRect();
      const dx = event.clientX - rect.left;
      const dy = event.clientY - (rect.top + rect.height);
      const dist = Math.hypot(dx, dy);
      const reach = Math.hypot(rect.width, rect.height) * 0.55;
      const near = 1 - Math.min(1, dist / reach);
      return 0.75 + 0.25 * near;
    }

    frame.addEventListener("pointerenter", (event) => {
      if (!allowHover || event.pointerType === "touch") return;
      hovering = true;
      go(1);
    });
    frame.addEventListener("pointermove", (event) => {
      if (!allowHover || !hovering || event.pointerType === "touch") return;
      const next = targetFromPointer(event);
      if (raf) {
        to = next;
        return;
      }
      progress = next;
      apply(next);
    });
    frame.addEventListener("pointerleave", () => {
      if (!allowHover) return;
      hovering = false;
      go(0);
    });
    frame.addEventListener("focusin", () => {
      if (!allowHover) return;
      go(1);
    });
    frame.addEventListener("focusout", () => {
      if (!allowHover || hovering) return;
      go(0);
    });

    const ro = new ResizeObserver(() => {
      peel.setupDimensions();
      peel.setCorner(CORNER);
      setPath(peel);
      apply(progress);
    });
    ro.observe(root);
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        setup(entry.target);
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "160px" },
  );

  function boot() {
    document.querySelectorAll("[data-book-peel]").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.offsetWidth > 8 && node.offsetHeight > 8) {
        setup(node);
        return;
      }
      io.observe(node);
    });
  }

  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });
})();
