(function () {
  document.querySelectorAll("[data-video-lane]").forEach(function (lane) {
    lane.querySelectorAll("[data-video-play]").forEach(function (button) {
      button.addEventListener("click", function () {
        const embedUrl = button.getAttribute("data-embed-url");
        const card = button.closest(".video-lane__card");
        const frameHost = card?.querySelector("[data-video-frame]");
        if (!embedUrl || !frameHost || frameHost.querySelector("iframe")) return;

        const iframe = document.createElement("iframe");
        iframe.src = embedUrl;
        iframe.title = button.getAttribute("aria-label") || "ڤیدیۆ";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.loading = "lazy";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";

        button.hidden = true;
        frameHost.hidden = false;
        frameHost.appendChild(iframe);
        iframe.focus();
      });
    });

    const track = lane.querySelector(".video-lane__track");
    if (!track) return;

    const fadeStart = lane.querySelector(".video-lane__fade--start");
    const fadeEnd = lane.querySelector(".video-lane__fade--end");

    function syncFades() {
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 4) {
        lane.classList.add("is-at-start", "is-at-end");
        return;
      }
      lane.classList.toggle("is-at-start", track.scrollLeft <= 4);
      lane.classList.toggle("is-at-end", track.scrollLeft >= max - 4);
    }

    track.addEventListener("scroll", syncFades, { passive: true });
    window.addEventListener("resize", syncFades);
    syncFades();
  });
})();
