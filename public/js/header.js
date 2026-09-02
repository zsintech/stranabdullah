(function () {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const lockup = header.querySelector(".masthead-lockup");
  const toggle = header.querySelector("[data-menu-toggle]");
  const mobile = document.querySelector("#mobile-nav");
  const panel = mobile?.querySelector(".mobile-nav__panel");
  const overHero = header.getAttribute("data-over-hero") === "true";
  const label = header.querySelector("[data-menu-label]");

  let focusBeforeOpen = null;
  let trapListener = null;

  function focusables(root) {
    if (!root) return [];
    return Array.from(
      root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el instanceof HTMLElement && el.offsetParent !== null);
  }

  function setCompact(compact) {
    header.classList.toggle("is-compact", compact);
    if (overHero) {
      header.classList.toggle("site-header--over-hero", !compact);
    }
    if (lockup) lockup.classList.toggle("masthead-lockup--compact", compact);
  }

  function removeTrap() {
    if (trapListener) {
      document.removeEventListener("keydown", trapListener);
      trapListener = null;
    }
  }

  function setOpen(open) {
    if (!mobile || !toggle) return;

    if (open) {
      focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else {
      removeTrap();
    }

    mobile.classList.toggle("hidden", !open);
    mobile.toggleAttribute("hidden", !open);
    header.classList.toggle("is-menu-open", open);
    document.documentElement.classList.toggle("is-menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (label) label.textContent = open ? "داخستنی مێنو" : "کردنەوەی مێنو";

    if (open) {
      requestAnimationFrame(function () {
        const items = focusables(panel);
        if (items.length) items[0].focus();
      });

      trapListener = function (event) {
        if (event.key !== "Tab" || !panel) return;
        const items = focusables(panel);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.addEventListener("keydown", trapListener);
    } else if (focusBeforeOpen && document.contains(focusBeforeOpen)) {
      focusBeforeOpen.focus();
      focusBeforeOpen = null;
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
      focusBeforeOpen = null;
    }
  });
})();
