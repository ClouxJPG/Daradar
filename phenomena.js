/* =========================================================
   Quantum Meteo — Phenomena overlay
   Источник: /api/phenomena

   - index.html НЕ ИЗМЕНЯЕТСЯ
   - режим S: ручное переключение кадров таймлайном
   - режимы R/H: удаляется только слой метеоявлений
   - без автоматической анимации
   - остальные слои карты не затрагиваются
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
  let active = false;
  let destroyed = false;
  let requestId = 0;
  let modeObserver = null;
  let domObserver = null;
  let timelineObserver = null;
  let lastPointerX = NaN;

  function log(...args) {
    console.info("[Quantum Phenomena]", ...args);
  }

  function warn(...args) {
    console.warn("[Quantum Phenomena]", ...args);
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
        (mode === "S" || mode === "R" || mode === "H") &&
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
        warn("Не удалось удалить слой:", error);
      }
    }

    layer = null;
    active = false;
    frameIndex = -1;
  }

  /*
   * Получение позиции таймлайна.
   * Поддерживаются input[type=range] и canvas.
   */
  function getTimelinePosition() {
    const range = document.querySelector(
      '#range, input[type="range"], #timeline input'
    );

    if (range) {
      const min = Number(range.min || 0);
      const max = Number(range.max || 100);
      const value = Number(range.value);

      if (
        Number.isFinite(value) &&
        Number.isFinite(min) &&
        Number.isFinite(max) &&
        max > min
      ) {
        return Math.max(
          0,
          Math.min(1, (value - min) / (max - min))
        );
      }
    }

    const canvas = document.querySelector("#bar");

    if (canvas) {
      const rect = canvas.getBoundingClientRect();

      if (
        rect.width > 0 &&
        Number.isFinite(lastPointerX)
      ) {
        return Math.max(
          0,
          Math.min(1, (lastPointerX - rect.left) / rect.width)
        );
      }
    }

    return null;
  }

  function getFrameIndex() {
    if (!frames.length) return -1;

    const position = getTimelinePosition();

    if (position === null) {
      return 0;
    }

    return Math.round(position * (frames.length - 1));
  }

  function createLayer(index) {
    if (
      destroyed ||
      getMode() !== "S" ||
      !map ||
      !frames.length
    ) {
      return;
    }

    const frame = frames[index];

    if (!frame || !frame.png) return;

    if (layer && map.hasLayer(layer)) {
      layer.setUrl(frameUrl(frame));
      frameIndex = index;
      active = true;
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

    layer.addTo(map);
    frameIndex = index;
    active = true;
  }

  function updateFrame() {
    if (
      destroyed ||
      getMode() !== "S" ||
      !frames.length
    ) {
      return;
    }

    const nextIndex = getFrameIndex();

    if (nextIndex < 0 || nextIndex >= frames.length) {
      return;
    }

    if (!layer || !active || !map.hasLayer(layer)) {
      createLayer(nextIndex);
      return;
    }

    if (nextIndex === frameIndex) return;

    const frame = frames[nextIndex];

    if (!frame || !frame.png) return;

    try {
      layer.setUrl(frameUrl(frame));
      frameIndex = nextIndex;

      log(
        "Выбран кадр:",
        frameIndex + 1,
        "/",
        frames.length
      );
    } catch (error) {
      warn("Не удалось переключить кадр:", error);
    }
  }

  async function load() {
    if (destroyed || loading) return;

    if (frames.length) {
      updateFrame();
      return;
    }

    map = getMap();

    if (!map || typeof window.L === "undefined") {
      scheduleRetry();
      return;
    }

    if (getMode() !== "S") return;

    loading = true;
    const thisRequest = ++requestId;

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

      if (destroyed || thisRequest !== requestId) return;

      if (data && data.ok === false) {
        throw new Error(
          data.details || data.error || "Ошибка API"
        );
      }

      if (!Array.isArray(data.frames)) {
        throw new Error("API не вернул массив frames");
      }

      const validFrames = data.frames.filter(function (frame) {
        return (
          frame &&
          typeof frame.png === "string" &&
          frame.png.length > 0
        );
      });

      if (!validFrames.length) {
        throw new Error("Нет корректных PNG-кадров");
      }

      if (getMode() !== "S") {
        log("Режим изменился во время загрузки.");
        return;
      }

      map = getMap();

      if (!map) {
        throw new Error("Карта Quantum Meteo недоступна");
      }

      frames = validFrames;

      const bounds = getBounds(data);
      const index = getFrameIndex();
      frameIndex = -1;

      layer = window.L.imageOverlay(
        frameUrl(frames[index >= 0 ? index : 0]),
        bounds,
        {
          opacity: 1,
          interactive: false,
          className: "quantum-phenomena-overlay",
          alt: "Метеоявления Meteoinfo"
        }
      );

      layer.addTo(map);
      active = true;
      frameIndex = index >= 0 ? index : 0;

      log("Слой добавлен:", {
        frames: frames.length,
        width: data.width,
        height: data.height,
        bounds: bounds
      });
    } catch (error) {
      console.error(
        "[Quantum Phenomena] Не удалось загрузить кадры:",
        error
      );

      removeLayer();
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

  function installStyles() {
    if (
      document.getElementById("quantum-phenomena-style")
    ) {
      return;
    }

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

  function onTimelineInteraction(event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (
      target.closest(
        "#bar, #range, #hrs, #n1, #n2, #n3, #n4, #n5, #di, input[type='range']"
      )
    ) {
      if (
        target.id === "bar" ||
        target.closest("#bar")
      ) {
        lastPointerX = event.clientX;
      }

      requestAnimationFrame(updateFrame);
    }
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

    document.addEventListener(
      "pointerdown",
      onTimelineInteraction,
      true
    );

    document.addEventListener(
      "pointermove",
      onTimelineInteraction,
      true
    );

    document.addEventListener(
      "input",
      onTimelineInteraction,
      true
    );

    document.addEventListener(
      "change",
      onTimelineInteraction,
      true
    );

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

    const timelineLabel = document.querySelector("#dl");

    if (timelineLabel) {
      timelineObserver = new MutationObserver(function () {
        updateFrame();
      });

      timelineObserver.observe(timelineLabel, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    log("Модуль запущен.", {
      mapAvailable: !!map,
      mode: getMode()
    });

    syncMode();

    setTimeout(syncMode, 500);
    setTimeout(syncMode, 1500);
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

      if (modeObserver) {
        modeObserver.disconnect();
        modeObserver = null;
      }

      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
      }

      if (timelineObserver) {
        timelineObserver.disconnect();
        timelineObserver = null;
      }

      if (syncTimer !== null) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }

      document.removeEventListener(
        "pointerdown",
        onTimelineInteraction,
        true
      );

      document.removeEventListener(
        "pointermove",
        onTimelineInteraction,
        true
      );

      document.removeEventListener(
        "input",
        onTimelineInteraction,
        true
      );

      document.removeEventListener(
        "change",
        onTimelineInteraction,
        true
      );

      log("Модуль остановлен.");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
