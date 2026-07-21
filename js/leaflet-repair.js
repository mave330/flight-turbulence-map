/**
 * Leaflet layout repair for environments where leaflet.css is blocked,
 * rejected by SRI, cached incorrectly, or overridden by another stylesheet.
 * This uses inline styles, so it does not depend on CSS cascade order.
 */
(() => {
  "use strict";

  const ABSOLUTE_SELECTORS = [
    ".leaflet-pane",
    ".leaflet-tile",
    ".leaflet-marker-icon",
    ".leaflet-marker-shadow",
    ".leaflet-tile-container",
    ".leaflet-pane > svg",
    ".leaflet-pane > canvas",
    ".leaflet-image-layer",
    ".leaflet-layer"
  ].join(",");

  function forceAbsolute(el) {
    el.style.setProperty("position", "absolute", "important");
    el.style.setProperty("left", "0", "important");
    el.style.setProperty("top", "0", "important");
  }

  function repairMap(map) {
    if (!map) return;

    map.style.setProperty("position", "relative", "important");
    map.style.setProperty("overflow", "hidden", "important");
    map.style.setProperty("isolation", "isolate", "important");
    map.style.setProperty("contain", "layout paint", "important");
    map.style.setProperty("width", "100%", "important");
    map.style.setProperty("z-index", "0", "important");

    map.querySelectorAll(ABSOLUTE_SELECTORS).forEach(forceAbsolute);

    map.querySelectorAll("img.leaflet-tile").forEach((tile) => {
      forceAbsolute(tile);
      tile.style.setProperty("width", "256px", "important");
      tile.style.setProperty("height", "256px", "important");
      tile.style.setProperty("max-width", "none", "important");
      tile.style.setProperty("max-height", "none", "important");
      tile.style.setProperty("margin", "0", "important");
      tile.style.setProperty("padding", "0", "important");
      tile.style.setProperty("display", "block", "important");
    });

    const panes = {
      ".leaflet-tile-pane": 200,
      ".leaflet-overlay-pane": 400,
      ".leaflet-shadow-pane": 500,
      ".leaflet-marker-pane": 600,
      ".leaflet-tooltip-pane": 650,
      ".leaflet-popup-pane": 700
    };
    for (const [selector, z] of Object.entries(panes)) {
      map.querySelectorAll(selector).forEach((el) =>
        el.style.setProperty("z-index", String(z), "important")
      );
    }
  }

  function start() {
    const map = document.getElementById("map");
    if (!map) {
      requestAnimationFrame(start);
      return;
    }

    repairMap(map);

    const observer = new MutationObserver(() => repairMap(map));
    observer.observe(map, { childList: true, subtree: true });

    window.addEventListener("resize", () => repairMap(map), { passive: true });
    document.addEventListener("visibilitychange", () => repairMap(map));

    // Re-apply after Leaflet creates panes and after fitBounds animations.
    [0, 50, 150, 400, 1000, 2500].forEach((delay) =>
      setTimeout(() => repairMap(map), delay)
    );

    window.__repairLeafletMap = () => repairMap(map);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
