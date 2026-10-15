/* =========================================================
   Quantum Meteo — Phenomena overlay

   - Режим S: прозрачные метеоявления
   - Режимы R/H: слой скрывается
   - Нет автоматической анимации
   - Переключение кадров через таймлайн
   - Остальные слои карты не удаляются
   ========================================================= */

(function () {
  "use strict";

  const API = "/api/phenomena";
  const GLOBAL_KEY = "__quantumPhenomenaLayer";
  const RETRY_MS = 1000;

  const FALLBACK_BOUNDS = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];

  let map = null;
  let layer = null;
  let frames = [];
  let frameIndex = -1;
  let retryTimer = null;
  let syncTimer = null;
  let loading = false;
  let destroyed = false;
  let requestId = 0;
  let modeObserver = null;
  let domObserver = null;
  let timelineObserver = null;
  let lastPointerX = NaN;
  let lastPointerY = NaN;

  function log(...args) {
    console.info("[Quantum Phenomena]", ...args);
  }

  function getMap() {
    return window.quantumMeteoMap || null;
  }

  function getMode() {
    const buttons = document.querySelectorAll(
      '.st .b[data-m], #bp .st .b[data-m], button[data-m]'
    );

    for (const button of buttons) {
      const mode = button.dataset.m;

      if (
        ["S", "R", "H"].includes(mode) &&
        (
          button.classList.contains("red") ||
          button.getAttribute("aria-pressed") === "true"
        )
      ) {
        return mode;
      }
    }

    return null;
  }

  function getBounds(data) {
    const b = data && data.bounds;

    if (
      b &&
      Number.isFinite(Number(b.south)) &&
      Number.isFinite(Number(b.west)) &&
      Number.isFinite(Number(b.north)) &&
      Number.isFinite(Number(b.east))
    ) {
      return [
        [Number(b.south), Number(b.west)],
        [Number(b.north), Number(b.east)]
      ];
    }

    return FALLBACK_BOUNDS;
  }

  function frameUrl(frame) {
    return "data:image/png;base64," + frame.png;
  }

  function stopRetry() {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function removeLayer() {
    if (map && layer) {
      try {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      } catch (error) {
        console.warn("[Quantum Phenomena] Ошибка удаления:", error);
      }
    }

    layer = null;
    frameIndex = -1;
  }

  /*
   * Определяем позицию таймлайна по координате
   * последнего нажатия или перемещения по canvas #bar.
   */
  function getTimelinePosition() {
    const range = document.querySelector(
      '#range, input[type="range"], #timeline input'
    );

    if (range) {
      const min = Number(range.min || 0);
      const max = Number(range.max || 100);
      const value = Number(range.value);

      if (Number.isFinite(value) && max > min) {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
      }
    }

    const canvas = document.querySelector("#bar");

    if (canvas && Number.isFinite(lastPointerX)) {
      const rect = canvas.getBoundingClientRect();

      if (rect.width > 0) {
        return Math.max(
          0,
          Math.min(1, (lastPointerX - rect.left) / rect.width)
        );
      }
    }

    return null;
  }

  function getSelectedFrame() {
    if (!frames.length) return -1;

    const position = getTimelinePosition();

    if (position === null) return 0;

    return Math.round(position * (frames.length - 1));
  }

  function showFrame(index) {
    if (
      destroyed ||
      getMode() !== "S" ||
      !map ||
      !frames.length
    ) {
      return;
    }

    index = Math.max(0, Math.min(frames.length - 1, index));

    const frame = frames[index];

    if (!frame || !frame.png) return;

    if (layer && map.hasLayer(layer)) {
      if (frameIndex !== index) {
        layer.setUrl(frameUrl(frame));
        frameIndex = index;
        log("Кадр:", index + 1, "/", frames.length);
      }

      return;
    }

    layer = window.L.imageOverlay(
      frameUrl(frame),
      FALLBACK_BOUNDS,
      {
        opacity: 1,
        interactive: false,
        className: "quantum-phenomena-overlay",
        alt: "Метеоявления Meteoinfo"
      }
    );

    layer.setBounds(getBounds(window.__quantumPhenomenaData || {}));
    layer.addTo(map);
    frameIndex = index;
  }

  function updateFrame() {
    if (destroyed || getMode() !== "S" || !frames.length) {
      return;
    }

    const index = getSelectedFrame();

    if (index >= 0) {
      showFrame(index);
    }
  }

  async function load() {
    if (destroyed || loading) return;

    map = getMap();

    if (!map || !window.L) {
      scheduleRetry();
      return;
    }

    if (getMode() !== "S") return;

    if (frames.length) {
      updateFrame();
      return;
    }

    loading = true;
    const currentRequest = ++requestId;

    try {
      const response = await fetch(API, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("API HTTP " + response.status);
      }

      const data = await response.json();

      if (destroyed || currentRequest !== requestId) return;

      if (data.ok === false) {
        throw new Error(data.details || data.error || "Ошибка API");
      }

      if (!Array.isArray(data.frames)) {
        throw new Error("API не вернул кадры");
      }

      frames = data.frames.filter(function (frame) {
        return frame && typeof frame.png === "string" && frame.png.length;
      });

      if (!frames.length) {
        throw new Error("Нет PNG-кадров");
      }

      window.__quantumPhenomenaData = data;
      map = getMap();

      if (!map || getMode() !== "S") return;

      showFrame(getSelectedFrame() >= 0 ? getSelectedFrame() : 0);

      log("Загружено кадров:", frames.length);
    } catch (error) {
      console.error("[Quantum Phenomena] Ошибка:", error);
      scheduleRetry();
    } finally {
      loading = false;
    }
  }

  function scheduleRetry() {
    if (destroyed || retryTimer !== null) return;

    retryTimer = setTimeout(function () {
      retryTimer = null;
      syncMode();
    }, RETRY_MS);
  }

  function syncMode() {
    if (destroyed) return;

    map = getMap();

    if (!map) {
      scheduleRetry();
      return;
    }

    const mode = getMode();

    if (mode === "S") {
      stopRetry();

      if (!frames.length) {
        load();
      } else {
        updateFrame();
      }

      return;
    }

    if (mode === "R" || mode === "H") {
      requestId++;
      stopRetry();
      removeLayer();
    }
  }

  function scheduleSync() {
    if (destroyed) return;

    if (syncTimer !== null) {
      clearTimeout(syncTimer);
    }

    syncTimer = setTimeout(function () {
      syncTimer = null;
      syncMode();
    }, 60);
  }

  function onTimelineEvent(event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (
      target.closest(
        "#bar, #range, #hrs, #n1, #n2, #n3, #n4, #n5, #di, input[type='range']"
      )
    ) {
      const canvas = document.querySelector("#bar");

      if (canvas && (target === canvas || canvas.contains(target))) {
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
      }

      requestAnimationFrame(updateFrame);
    }
  }

  function installStyles() {
    if (document.getElementById("quantum-phenomena-style")) return;

    const style = document.createElement("style");
    style.id = "quantum-phenomena-style";
    style.textContent = `
      .leaflet-image-layer.quantum-phenomena-overlay {
        image-rendering: pixelated !important;
        image-rendering: crisp-edges !important;
        pointer-events: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function init() {
    if (destroyed) return;

    map = getMap();

    if (!map) {
      setTimeout(init, 250);
      return;
    }

    installStyles();

    document.addEventListener("click", function (event) {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest('[data-m="S"], [data-m="R"], [data-m="H"]')
      ) {
        scheduleSync();
      }
    });

    document.addEventListener("pointerdown", onTimelineEvent, true);
    document.addEventListener("pointermove", onTimelineEvent, true);
    document.addEventListener("input", onTimelineEvent, true);
    document.addEventListener("change", onTimelineEvent, true);

    modeObserver = new MutationObserver(scheduleSync);

    function observeModeButtons() {
      document.querySelectorAll(
        '.st .b[data-m], #bp .st .b[data-m], button[data-m]'
      ).forEach(function (button) {
        if (button.dataset.phenomenaObserved === "1") return;

        button.dataset.phenomenaObserved = "1";

        modeObserver.observe(button, {
          attributes: true,
          attributeFilter: ["class", "aria-pressed"]
        });
      });
    }

    observeModeButtons();

    domObserver = new MutationObserver(function () {
      observeModeButtons();
      scheduleSync();
    });

    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    const label = document.querySelector("#dl");

    if (label) {
      timelineObserver = new MutationObserver(updateFrame);

      timelineObserver.observe(label, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    syncMode();

    setTimeout(syncMode, 500);
    setTimeout(syncMode, 1500);

    log("Модуль запущен.");
  }

  window[GLOBAL_KEY] = {
    sync: syncMode,

    reload: function () {
      requestId++;
      stopRetry();
      removeLayer();
      frames = [];
      loading = false;
      syncMode();
    },

    remove: removeLayer,

    destroy: function () {
      destroyed = true;
      requestId++;
      stopRetry();
      removeLayer();

      if (modeObserver) modeObserver.disconnect();
      if (domObserver) domObserver.disconnect();
      if (timelineObserver) timelineObserver.disconnect();

      if (syncTimer !== null) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }

      document.removeEventListener("pointerdown", onTimelineEvent, true);
      document.removeEventListener("pointermove", onTimelineEvent, true);
      document.removeEventListener("input", onTimelineEvent, true);
      document.removeEventListener("change", onTimelineEvent, true);

      log("Модуль остановлен.");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
