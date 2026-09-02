(function () {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const lockup = header.querySelector(".masthead-lockup");
  const toggle = header.querySelector("[data-menu-toggle]");
  const mobile = document.querySelector("#mobile-nav");
  const barTop = header.querySelector("[data-bar-top]");
  const barBottom = header.querySelector("[data-bar-bottom]");
  const overHero = header.getAttribute("data-over-hero") === "true";
  const label = header.querySelector("[data-menu-label]");

  function setCompact(compact) {
    header.classList.toggle("is-compact", compact);
    if (overHero) {
      header.classList.toggle("site-header--over-hero", !compact);
    }
    if (lockup) lockup.classList.toggle("masthead-lockup--compact", compact);
  }

  function setOpen(open) {
    if (!mobile || !toggle) return;
    mobile.classList.toggle("hidden", !open);
    mobile.toggleAttribute("hidden", !open);
    header.classList.toggle("is-menu-open", open);
    document.documentElement.classList.toggle("is-menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (label) label.textContent = open ? "داخستنی مێنو" : "کردنەوەی مێنو";
    if (barTop) {
      barTop.classList.toggle("translate-y-[6px]", open);
      barTop.classList.toggle("rotate-45", open);
    }
    if (barBottom) {
      barBottom.classList.toggle("-translate-y-[6px]", open);
      barBottom.classList.toggle("-rotate-45", open);
    }
  }

  setCompact(window.scrollY > 28);
  window.addEventListener(
    "scroll",
    function () {
      setCompact(window.scrollY > 28);
    },
    { passive: true },
  );

  if (toggle) {
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
  }

  document.querySelectorAll("[data-menu-close]").forEach(function (button) {
    button.addEventListener("click", function () {
      setOpen(false);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && toggle && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
})();
