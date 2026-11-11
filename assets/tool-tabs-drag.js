/* Horizontal drag scrolling for tool tabs.
 * Native wheel, trackpad, keyboard and touch scrolling remain supported.
 */
(() => {
  const DRAG_THRESHOLD = 6;

  function setup(nav) {
    if (nav.dataset.dragScrollReady === "true") return;
    nav.dataset.dragScrollReady = "true";
    let drag = null;
    let suppressClick = false;

    nav.addEventListener("pointerdown", event => {
      if (event.pointerType !== "mouse" || event.button !== 0 || nav.scrollWidth <= nav.clientWidth) return;
      if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      drag = { id: event.pointerId, startX: event.clientX, scrollLeft: nav.scrollLeft, moved: false };
      suppressClick = false;
    });

    nav.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      const delta = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
      if (!drag.moved) {
        drag.moved = true;
        nav.classList.add("is-drag-scrolling");
        try { nav.setPointerCapture(event.pointerId); } catch (_) {}
      }
      nav.scrollLeft = drag.scrollLeft - delta;
      event.preventDefault();
    });

    function stopDrag(event) {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const moved = drag.moved;
      if (nav.hasPointerCapture?.(drag.id)) {
        try { nav.releasePointerCapture(drag.id); } catch (_) {}
      }
      drag = null;
      nav.classList.remove("is-drag-scrolling");
      // Captured pointerup produces a click on the scroller. Cancel only when
      // a drag happened, preserving normal click-through on individual tabs.
      suppressClick = moved;
    }

    nav.addEventListener("pointerup", stopDrag);
    nav.addEventListener("pointercancel", stopDrag);
    nav.addEventListener("lostpointercapture", () => {
      nav.classList.remove("is-drag-scrolling");
      drag = null;
    });
    nav.addEventListener("click", event => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);
    nav.addEventListener("dragstart", event => event.preventDefault());
    nav.addEventListener("keydown", event => {
      if (event.target !== nav || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      nav.scrollBy({ left: event.key === "ArrowRight" ? 160 : -160, behavior: "smooth" });
    });
    if (!nav.hasAttribute("tabindex")) nav.setAttribute("tabindex", "0");
  }

  function init() {
    document.querySelectorAll(".tool-tabs").forEach(setup);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Some tools append a bottom duplicate tab row after initial parsing.
  const observer = new MutationObserver(() => init());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
