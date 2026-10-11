/* =========================================================
   Quantum Meteo — Phenomena overlay
   Источник: /api/phenomena

   - index.html не изменяется
   - кадры GIF переключаются по их длительности
   - сглаживание не применяется
   - режимы R/H не затрагиваются
   ========================================================= */

(function () {
  "use strict";

  const API = "/api/phenomena";
  const GLOBAL_KEY = "__quantumPhenomenaLayer";

  const BOUNDS_FALLBACK = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];

  let map = null;
  let layer = null;
  let frames = [];
  let frameIndex = 0;
  let timer = null;
  let loading = false;
  let active = false;
  let requestId = 0;

  function getMap() {
    return window.quantumMeteoMap || window.map || null;
  }

  function getMode() {
    const selectors = [
      "[data-mode].active",
      "[data-mode][aria-pressed='true']",
      ".mode-button.active",
      ".mode-btn.active"
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;

      const value = (
        element.dataset.mode ||
        element.textContent ||
        ""
      ).trim().toUpperCase();

      if (value === "S" || value === "R" || value === "H") {
        return value;
      }
    }

    return null;
  }

  function stopAnimation() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function removeLayer() {
    stopAnimation();

    if (map && layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }

    layer = null;
    active = false;
  }

  function getBounds(data) {
    const b = data && data.bounds;

    if (
      b &&
      Number.isFinite(b.south) &&
      Number.isFinite(b.west) &&
      Number.isFinite(b.north) &&
      Number.isFinite(b.east)
    ) {
      return [
        [b.south, b.west],
        [b.north, b.east]
      ];
    }

    return BOUNDS_FALLBACK;
  }

  function frameUrl(frame) {
    return "data:image/png;base64," + frame.png;
  }

  function showFrame(index) {
    if (!map || !layer || !frames.length || !active) return;

    frameIndex = ((index % frames.length) + frames.length) % frames.length;

    const frame = frames[frameIndex];

    if (!frame || !frame.png) {
      scheduleNext();
      return;
    }

    layer.setUrl(frameUrl(frame));
    scheduleNext();
  }

  function scheduleNext() {
    stopAnimation();

    if (!active || !frames.length) return;

    const frame = frames[frameIndex];
    const delay = Math.max(
      100,
      Math.min(10000, Number(frame && frame.delay) || 700)
    );

    timer = setTimeout(function () {
      if (active) showFrame(frameIndex + 1);
    }, delay);
  }

  async function load() {
    if (loading || active) return;

    map = getMap();

    if (!map || typeof L === "undefined") return;

    loading = true;
    const thisRequest = ++requestId;

    try {
      const response = await fetch(API, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("API HTTP " + response.status);
      }

      const data = await response.json();

      if (thisRequest !== requestId) return;

      if (!Array.isArray(data.frames) || data.frames.length === 0) {
        throw new Error("API не вернул кадры GIF");
      }

      frames = data.frames.filter(function (frame) {
        return frame && typeof frame.png === "string";
      });

      if (!frames.length) {
        throw new Error("Нет корректных PNG-кадров");
      }

      layer = L.imageOverlay(
        frameUrl(frames[0]),
        getBounds(data),
        {
          opacity: 1,
          interactive: false,
          className: "quantum-phenomena-overlay"
        }
      );

      layer.addTo(map);
      active = true;
      frameIndex = 0;

      scheduleNext();

      console.info(
        "Quantum Meteo: загружено кадров phenomena:",
        frames.length
      );
    } catch (error) {
      console.error("Quantum Meteo phenomena:", error);
      removeLayer();
    } finally {
      loading = false;
    }
  }

  function syncMode() {
    map = getMap();

    if (!map) return;

    const mode = getMode();

    if (mode && mode !== "S") {
      removeLayer();
      return;
    }

    if (mode === "S") {
      load();
    }
  }

  function installStyles() {
    if (document.getElementById("quantum-phenomena-style")) return;

    const style = document.createElement("style");
    style.id = "quantum-phenomena-style";
    style.textContent = `
      .quantum-phenomena-overlay {
        image-rendering: pixelated !important;
        image-rendering: crisp-edges !important;
      }
    `;

    document.head.appendChild(style);
  }

  function init() {
    installStyles();

    map = getMap();

    if (!map) {
      setTimeout(init, 300);
      return;
    }

    document.addEventListener("click", function () {
      setTimeout(syncMode, 50);
    });

    setInterval(syncMode, 1000);

    syncMode();
  }

  window[GLOBAL_KEY] = {
    reload: function () {
      removeLayer();
      frames = [];
      loading = false;
      syncMode();
    },
    remove: removeLayer,
    sync: syncMode
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
