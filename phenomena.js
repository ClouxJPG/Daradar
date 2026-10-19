/* =========================================================
   Quantum Meteo — Phenomena overlay

   - Режим S: прозрачные метеоявления
   - Режимы R/H: слой скрывается
   - Нет автоматической анимации
   - Кадры загружаются по запросу
   - Загруженные кадры кэшируются в памяти
   - Не публикует число GIF-кадров в общий таймлайн
   - Остальные слои карты не удаляются
   ========================================================= */

(function () {
  "use strict";

  const API = "/api/phenomena";
  const GLOBAL_KEY = "__quantumPhenomenaLayer";
  const RETRY_MS = 1000;
  const MAX_CACHED_FRAMES = 18;

  const GIF_BOUNDS = [
    [38.2155955810, 14.9892981264],
    [69.6543707199, 72.9237642948]
  ];

  let map = null;
  let layer = null;
  let frameCount = 0;
  let frameIndex = -1;

  const frameCache = new Map();
  const frameRequests = new Map();

  let retryTimer = null;
  let syncTimer = null;
  let loadingInitial = false;
  let destroyed = false;
  let requestId = 0;
  let modeObserver = null;
  let domObserver = null;
  let timelineObserver = null;
  let lastPointerX = NaN;
  let lastRequestedFrame = -1;

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
        console.warn(
          "[Quantum Phenomena] Ошибка удаления:",
          error
        );
      }
    }

    layer = null;
    frameIndex = -1;
  }

  function frameUrl(frame) {
    return "data:image/png;base64," + frame.png;
  }

  function rememberFrame(index, frame) {
    frameCache.delete(index);
    frameCache.set(index, frame);

    while (frameCache.size > MAX_CACHED_FRAMES) {
      const oldestKey = frameCache.keys().next().value;

      if (oldestKey === frameIndex) {
        const value = frameCache.get(oldestKey);

        frameCache.delete(oldestKey);
        frameCache.set(oldestKey, value);
        continue;
      }

      frameCache.delete(oldestKey);
    }
  }

  function publishPhenomenaMetadata(data) {
    /*
     * ВАЖНО:
     * Не передаём frameCount наружу.
     * Количество кадров GIF не должно изменять
     * количество делений общего таймлайна карты.
     */
    window.__quantumPhenomenaData = {
      ok: true,
      bounds: data.bounds || null,
      updatedAt: data.updatedAt || null
    };
  }

  async function fetchFrame(index) {
    if (frameCache.has(index)) {
      const cached = frameCache.get(index);

      frameCache.delete(index);
      frameCache.set(index, cached);

      return cached;
    }

    if (frameRequests.has(index)) {
      return frameRequests.get(index);
    }

    const promise = (async function () {
      const response = await fetch(
        API + "?frame=" + encodeURIComponent(index),
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin"
        }
      );

      if (!response.ok) {
        throw new Error("API HTTP " + response.status);
      }

      const data = await response.json();

      if (
        !data.ok ||
        !data.frame ||
        typeof data.frame.png !== "string"
      ) {
        throw new Error(
          data.error || "API не вернул PNG-кадр"
        );
      }

      if (
        Number.isInteger(data.frameCount) &&
        data.frameCount > 0
      ) {
        frameCount = data.frameCount;
      }

      rememberFrame(data.frame.index, data.frame);
      publishPhenomenaMetadata(data);

      return data.frame;
    })();

    frameRequests.set(index, promise);

    try {
      return await promise;
    } finally {
      frameRequests.delete(index);
    }
  }

  function getTimelinePosition() {
    const range = document.querySelector(
      "#range, input[type='range'], #timeline input"
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

    if (canvas && Number.isFinite(lastPointerX)) {
      const rect = canvas.getBoundingClientRect();

      if (rect.width > 0) {
        return Math.max(
          0,
          Math.min(
            1,
            (lastPointerX - rect.left) / rect.width
          )
        );
      }
    }

    return null;
  }

  function getSelectedFrame() {
    if (!frameCount) return -1;

    const position = getTimelinePosition();

    if (position === null) {
      return frameCount - 1;
    }

    return Math.round(position * (frameCount - 1));
  }

  function displayFrame(index, frame) {
    if (
      destroyed ||
      getMode() !== "S" ||
      !map ||
      !frame ||
      typeof frame.png !== "string"
    ) {
      return;
    }

    if (layer && map.hasLayer(layer)) {
      if (frameIndex !== index) {
        layer.setUrl(frameUrl(frame));
        frameIndex = index;

        log(
          "Кадр:",
          index + 1,
          "/",
          frameCount
        );
      }

      return;
    }

    layer = window.L.imageOverlay(
      frameUrl(frame),
      GIF_BOUNDS,
      {
        opacity: 1,
        interactive: false,
        className: "quantum-phenomena-overlay",
        alt: "Метеоявления Meteoinfo"
      }
    );

    layer.addTo(map);
    frameIndex = index;

    log(
      "Слой добавлен:",
      layer.getBounds().toBBoxString()
    );
  }

  async function showFrame(index) {
    if (
      destroyed ||
      getMode() !== "S" ||
      !map ||
      !frameCount
    ) {
      return;
    }

    index = Math.max(
      0,
      Math.min(frameCount - 1, index)
    );

    if (
      frameIndex === index &&
      layer &&
      map.hasLayer(layer)
    ) {
      return;
    }

    lastRequestedFrame = index;
    const currentRequest = requestId;

    try {
      const frame = await fetchFrame(index);

      if (
        destroyed ||
        currentRequest !== requestId ||
        getMode() !== "S" ||
        lastRequestedFrame !== index
      ) {
        return;
      }

      map = getMap();

      if (!map) return;

      displayFrame(index, frame);
    } catch (error) {
      console.error(
        "[Quantum Phenomena] Ошибка кадра:",
        error
      );

      scheduleRetry();
    }
  }

  async function loadInitial() {
    if (
      destroyed ||
      loadingInitial ||
      getMode() !== "S"
    ) {
      return;
    }

    map = getMap();

    if (!map || !window.L) {
      scheduleRetry();
      return;
    }

    loadingInitial = true;
    const currentRequest = requestId;

    try {
      const response = await fetch(
        API + "?frame=latest",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin"
        }
      );

      if (!response.ok) {
        throw new Error("API HTTP " + response.status);
      }

      const data = await response.json();

      if (
        destroyed ||
        currentRequest !== requestId
      ) {
        return;
      }

      if (
        !data.ok ||
        !data.frame ||
        !data.frame.png
      ) {
        throw new Error(
          data.error || "API не вернул начальный кадр"
        );
      }

      frameCount = Number(data.frameCount) || 1;

      rememberFrame(data.frame.index, data.frame);
      publishPhenomenaMetadata(data);

      map = getMap();

      if (!map || getMode() !== "S") return;

      const selected = getSelectedFrame();

      const index = selected >= 0
        ? selected
        : data.frame.index;

      if (index === data.frame.index) {
        displayFrame(index, data.frame);
      } else {
        await showFrame(index);
      }

      log("Кадров GIF:", frameCount);
    } catch (error) {
      console.error(
        "[Quantum Phenomena] Ошибка загрузки:",
        error
      );

      scheduleRetry();
    } finally {
      loadingInitial = false;
    }
  }

  function updateFrame() {
    if (
      destroyed ||
      getMode() !== "S"
    ) {
      return;
    }

    if (!frameCount) {
      loadInitial();
      return;
    }

    const index = getSelectedFrame();

    if (index >= 0) {
      showFrame(index);
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

      if (!frameCount) {
        loadInitial();
      } else {
        updateFrame();
      }

      return;
    }

    if (mode === "R" || mode === "H") {
      requestId++;
      lastRequestedFrame = -1;

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

      if (
        canvas &&
        (target === canvas || canvas.contains(target))
      ) {
        lastPointerX = event.clientX;
      }

      requestAnimationFrame(updateFrame);
    }
  }

  function installStyles() {
    if (
      document.getElementById(
        "quantum-phenomena-style"
      )
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
        target.closest(
          '[data-m="S"], [data-m="R"], [data-m="H"]'
        )
      ) {
        scheduleSync();
      }
    });

    document.addEventListener(
      "pointerdown",
      onTimelineEvent,
      true
    );

    document.addEventListener(
      "pointermove",
      onTimelineEvent,
      true
    );

    document.addEventListener(
      "input",
      onTimelineEvent,
      true
    );

    document.addEventListener(
      "change",
      onTimelineEvent,
      true
    );

    modeObserver = new MutationObserver(scheduleSync);

    function observeModeButtons() {
      document.querySelectorAll(
        '.st .b[data-m], #bp .st .b[data-m], button[data-m]'
      ).forEach(function (button) {
        if (
          button.dataset.phenomenaObserved === "1"
        ) {
          return;
        }

        button.dataset.phenomenaObserved = "1";

        modeObserver.observe(button, {
          attributes: true,
          attributeFilter: [
            "class",
            "aria-pressed"
          ]
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

      frameCount = 0;
      frameCache.clear();
      frameRequests.clear();

      loadingInitial = false;
      lastRequestedFrame = -1;

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

      document.removeEventListener(
        "pointerdown",
        onTimelineEvent,
        true
      );

      document.removeEventListener(
        "pointermove",
        onTimelineEvent,
        true
      );

      document.removeEventListener(
        "input",
        onTimelineEvent,
        true
      );

      document.removeEventListener(
        "change",
        onTimelineEvent,
        true
      );

      log("Модуль остановлен.");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
