(function () {
  const dialog = document.querySelector("[data-admin-dialog]");
  if (!dialog) return;

  const backdrop = dialog.querySelector("[data-admin-dialog-backdrop]");
  const titleEl = dialog.querySelector("[data-admin-dialog-title]");
  const bodyEl = dialog.querySelector("[data-admin-dialog-body]");
  const cancelBtn = dialog.querySelector("[data-admin-dialog-cancel]");
  const confirmBtn = dialog.querySelector("[data-admin-dialog-confirm]");
  let pendingForm = null;
  let resolveFn = null;

  function openDialog({ title, body, confirmLabel, cancelLabel, danger }) {
    titleEl.textContent = title || "دڵنیایت؟";
    bodyEl.textContent = body || "";
    confirmBtn.textContent = confirmLabel || "بەڵێ";
    cancelBtn.textContent = cancelLabel || "پاشگەزبوونەوە";
    confirmBtn.classList.toggle("admin-btn-danger", Boolean(danger));
    dialog.hidden = false;
    confirmBtn.focus();
    return new Promise((resolve) => {
      resolveFn = resolve;
    });
  }

  function closeDialog(result) {
    dialog.hidden = true;
    pendingForm = null;
    if (resolveFn) {
      resolveFn(result);
      resolveFn = null;
    }
  }

  cancelBtn.addEventListener("click", () => closeDialog(false));
  backdrop.addEventListener("click", () => closeDialog(false));
  confirmBtn.addEventListener("click", () => {
    if (pendingForm) {
      pendingForm.dataset.confirmed = "true";
      pendingForm.requestSubmit();
    }
    closeDialog(true);
  });

  document.addEventListener("keydown", (event) => {
    if (dialog.hidden) return;
    if (event.key === "Escape") closeDialog(false);
  });

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const message = form.getAttribute("data-confirm");
      if (!message || form.dataset.confirmed === "true") {
        delete form.dataset.confirmed;
        return;
      }
      event.preventDefault();
      pendingForm = form;
      openDialog({
        title: form.getAttribute("data-confirm-title") || "دڵنیایت؟",
        body: message,
        confirmLabel: form.getAttribute("data-confirm-label") || "بەڵێ",
        danger: form.hasAttribute("data-confirm-danger"),
      });
    },
    true,
  );

  window.AdminDialog = {
    alert(message, title) {
      cancelBtn.hidden = true;
      return openDialog({
        title: title || "تێبینی",
        body: message,
        confirmLabel: "باشە",
      }).finally(() => {
        cancelBtn.hidden = false;
      });
    },
    confirm(message, options) {
      cancelBtn.hidden = false;
      return openDialog({
        title: options?.title || "دڵنیایت؟",
        body: message,
        confirmLabel: options?.confirmLabel || "بەڵێ",
        cancelLabel: options?.cancelLabel || "پاشگەزبوونەوە",
        danger: options?.danger,
      });
    },
  };
})();
