(() => {
  const root = document.querySelector("[data-hero]");
  if (!root || !(root instanceof HTMLElement)) return;

  const art = root.querySelector("[data-hero-art]");
  const glow = root.querySelector("[data-hero-glow]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  root.classList.add("is-ready");

  if (reduced || !fine || !(art instanceof HTMLElement)) return;

  let raf = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  function tick() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    art.style.transform = `translate3d(${currentX * 10}px, ${currentY * 8}px, 0) scale(1.035)`;
    if (glow instanceof HTMLElement) {
      glow.style.transform = `translate3d(${currentX * -18}px, ${currentY * -14}px, 0)`;
    }
    raf = requestAnimationFrame(tick);
  }

  root.addEventListener(
    "pointermove",
    (event) => {
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = (event.clientY - rect.top) / rect.height - 0.5;
      root.classList.add("is-tracking");
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true },
  );

  root.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
    root.classList.remove("is-tracking");
  });
})();
