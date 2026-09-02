(function () {
  const HELP_TEXT = {
    slug: "لینکی URL ی تۆمار لە ماڵپەڕدا. ئەگەر بەتاڵ بێت، لە ناونیشان دروست دەبێت. تەنها پیت و ژمارە و هێڵە.",
    featured: "تۆمارە تایبەتەکان لە بەشی سەرەکی ماڵپەڕدا بە جۆرێکی تایبەت دەردەکەون.",
    homeGallery: "وێنەکە لە کارۆسێلی وێنەی پەڕەی سەرەکی دەردەکەوێت.",
    homeGalleryOrder: "ژمارەی بچووکتر = لە پێشترەوە. وێنەکان بەم ڕیزە لە کارۆسێلدا دەچێن.",
    homeGalleryWide: "وێنەی فراوان دوو خانەی کارۆسێل دەگرێت — بۆ وێنەی گەورە و ئاسایی.",
    coverAlt: "وەسفی وێنە بۆ بینەرانی کە ناتوانن وێنە ببینن و بۆ گەڕانی گووگڵ.",
    status: "ڕەشنووس = تەنها لێرە · بڵاوکراوە = لە ماڵپەڕدا · شاردراوەتەوە = لە ماڵپەڕدا نیشان نادرێت.",
    isbn: "ژمارەی نێودەوڵەتی کتێب — بۆ کتێبەکان ئارەزوومەندانە.",
    audioUrl: "لینکی فایلی دەنگ — ئەگەر دەنگی جیاواز لە PDF هەبێت.",
    topics: "بابەتە گشتییەکان — بە کۆما جیا بکەرەوە.",
    tags: "تاگە تایبەتەکان بۆ گەڕان — جیا لە بابەتەکان.",
    publishNew: "دوای بڵاوکردنەوە، فۆرمی نوێی هەمان جۆر دەکرێتەوە — بۆ بارکردنی چەند ڤیدیۆ یان وێنە.",
    youtube: "لینکی watch، youtu.be یان embed دابنێ. وێنەی بەرگ خۆکار لە یوتیوب دێت ئەگەر وێنەیەکت بار نەکردبێت.",
    cover: "وێنە بار بکە یان URL دابنێ. بۆ وێنەی ئەرشیف ئەمە سەرەکیە.",
    pdf: "بۆ کتێب — خوێنەر دەتوانێت بیخوێنێتەوە یان داگری بکات.",
    body: "شریتی سەرەوە فۆرمات دەکات؛ دوگمەی وێنە یان ڕاکێشان بۆ ناو دەق.",
    dashboard: "ئەم لاپەڕەیە بۆ بینینی دۆخی تۆمارەکان و دەستپێکردنی نوێیە. ئاماری سەرەوە فلتەری لیستەکەن.",
  };

  let openBtn = null;
  let popover = null;

  function closePopover() {
    if (popover) popover.hidden = true;
    if (openBtn) openBtn.setAttribute("aria-expanded", "false");
    openBtn = null;
  }

  function ensurePopover() {
    if (popover) return popover;
    popover = document.createElement("div");
    popover.className = "admin-help-popover";
    popover.hidden = true;
    popover.setAttribute("role", "tooltip");
    document.body.appendChild(popover);
    return popover;
  }

  function positionPopover(btn, panel) {
    const rect = btn.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + margin + window.scrollY;
    let left = rect.left + window.scrollX;

    if (left + panelRect.width > window.innerWidth - margin) {
      left = window.innerWidth - panelRect.width - margin + window.scrollX;
    }
    if (top + panelRect.height > window.scrollY + window.innerHeight - margin) {
      top = rect.top + window.scrollY - panelRect.height - margin;
    }

    panel.style.top = `${Math.max(margin + window.scrollY, top)}px`;
    panel.style.left = `${Math.max(margin + window.scrollX, left)}px`;
  }

  function openPopover(btn) {
    const key = btn.getAttribute("data-help");
    const text = btn.getAttribute("data-help-text") || (key && HELP_TEXT[key]) || "";
    if (!text) return;

    if (openBtn === btn) {
      closePopover();
      return;
    }

    closePopover();
    const panel = ensurePopover();
    panel.textContent = text;
    panel.hidden = false;
    positionPopover(btn, panel);
    btn.setAttribute("aria-expanded", "true");
    openBtn = btn;
  }

  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".admin-help");
    if (btn) {
      event.preventDefault();
      event.stopPropagation();
      openPopover(btn);
      return;
    }
    if (!event.target.closest(".admin-help-popover")) closePopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopover();
  });

  window.addEventListener("scroll", closePopover, true);
  window.addEventListener("resize", closePopover);
})();
