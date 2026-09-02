(() => {
  const root = document.querySelector("[data-hero]");
  if (root instanceof HTMLElement) {
    root.classList.add("is-ready");
  }
})();
