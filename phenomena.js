/* =========================================================
   Quantum Meteo — Phenomena overlay
   Источник: /api/phenomena

   - index.html не изменяется
   - режим S: слой метеоявлений
   - режимы R/H: слой удаляется
   - кадры переключаются по delay из API
   - исходная карта и остальные слои не меняются
   ========================================================= */

(function () {
  "use strict";

  const API = "/api/phenomena";
  const GLOBAL_KEY = "__quantumPhenomenaLayer";

  const FALLBACK_BOUNDS = [
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
  let modeObserver = null;
  let syncTimer = null;

  function getMap() {
    return window.quantumMeteoMap || null;
  }

  function getMode() {
    // Основной код Quantum Meteo подсвечивает выбранную
    // кнопку классом red в ui().
    const selected = document.querySelector(
      ".st .b.red[data-m]"
    );

    if (selected) {
      const mode = selected.dataset.m;

      if (mode === "S" || mode === "R" || mode === "H") {
        return mode;
      }
    }

    // Резерв: проверяем все кнопки, если разметка изменится.
    const buttons = document.querySelectorAll(
      ".st .b[data-m]"
    );

    for (const button of buttons) {
      if (
        button.classList.contains("red") ||
        button.getAttribute("aria-pressed") === "true"
      ) {
        const mode = button.dataset.m;

        if (mode === "S" || mode === "R" || mode === "H") {
          return mode;
        }
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

    return FALLBACK_BOUNDS;
  }

  function frameUrl(frame) {
    return "data:image/png;base64," + frame.png;
  }

  function scheduleNext() {
    stopAnimation();

    if (!active || !frames.length || !layer) return;

    const current = frames[frameIndex];
    const sourceDelay = Number(current && current.delay);

    const delay =
      Number.isFinite(sourceDelay) && sourceDelay > 0
        ? Math.max(100, Math.min(sourceDelay, 10000))
        : 700;

    timer = setTimeout(function () {
      if (!active || !frames.length || !layer) return;

      frameIndex = (frameIndex + 1) % frames.length;

      const next = frames[frameIndex];

      if (next && next.png) {
        layer.setUrl(frameUrl(next));
      }

      scheduleNext();
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
        method: "GET",
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("API HTTP " + response.status);
      }

      const data = await response.json();

      if (thisRequest !== requestId) return;

      if (!Array.isArray(data.frames) || !data.frames.length) {
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
        throw new Error("В API нет корректных PNG-кадров");
      }

      // Если режим изменился во время загрузки, ничего не добавляем.
      if (getMode() !== "S") return;

      map = getMap();

      if (!map) return;

      frames = validFrames;
      frameIndex = 0;

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

      scheduleNext();

      console.info(
        "Quantum Meteo: метеоявления загружены",
        {
          frames: frames.length,
          width: data.width,
          height: data.height
        }
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

    if (mode === "S") {
      load();
      return;
    }

    if (mode === "R" || mode === "H") {
      requestId++;
      removeLayer();
    }
  }

  function installStyles() {
    if (document.getElementById("quantum-phenomena-style")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "quantum-phenomena-style";
    style.textContent = `
      .leaflet-image-layer.quantum-phenomena-overlay {
        image-rendering: pixelated !important;
        image-rendering: crisp-edges !important;
      }
    `;

    document.head.appendChild(style);
  }

  function scheduleSync() {
    if (syncTimer !== null) {
      clearTimeout(syncTimer);
    }

    syncTimer = setTimeout(function () {
      syncTimer = null;
      syncMode();
    }, 0);
  }

  function init() {
    map = getMap();

    if (!map) {
      setTimeout(init, 250);
      return;
    }

    installStyles();

    // Слушаем изменения выбранного режима.
    document.addEventListener("click", function (event) {
      if (event.target.closest(".st .b[data-m]")) {
        scheduleSync();
      }
    });

    // Подстраховка: основной интерфейс обновляет класс кнопки
    // после вызова ui(). Наблюдатель реагирует на это изменение.
    modeObserver = new MutationObserver(function () {
      scheduleSync();
    });

    document.querySelectorAll(".st .b[data-m]").forEach(function (button) {
      modeObserver.observe(button, {
        attributes: true,
        attributeFilter: ["class", "aria-pressed"]
      });
    });

    syncMode();
  }

  window[GLOBAL_KEY] = {
    sync: syncMode,

    reload: function () {
      requestId++;
      removeLayer();
      frames = [];
      loading = false;
      syncMode();
    },

    remove: removeLayer,

    destroy: function () {
      requestId++;
      removeLayer();

      if (modeObserver) {
        modeObserver.disconnect();
        modeObserver = null;
      }

      if (syncTimer !== null) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
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
