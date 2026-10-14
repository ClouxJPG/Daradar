/* =========================================================
   Quantum Meteo — Phenomena overlay
   Источник: /api/phenomena
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - режим S: анимированный слой метеоявлений
   - режимы R/H: слой удаляется
   - автоматическое повторное определение режима
   - защита от устаревших запросов и ошибок загрузки
   ========================================================= */
(function () {
  "use strict";
  const API = "/api/phenomena";
  const GLOBAL_KEY = "__quantumPhenomenaLayer";
  const RETRY_MS = 500;
  const MAX_DELAY = 10000;
  const FALLBACK_BOUNDS = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];
  let map = null;
  let layer = null;
  let frames = [];
  let frameIndex = 0;
  let animationTimer = null;
  let retryTimer = null;
  let syncTimer = null;
  let loading = false;
  let active = false;
  let destroyed = false;
  let requestId = 0;
  let modeObserver = null;
  let domObserver = null;
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
    // Сначала ищем явно выбранный режим.
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
    // В текущем index.html начальный режим — S.
    // Если кнопки ещё не готовы, возвращаем null,
    // чтобы не добавлять слой в неверный режим.
    return null;
  }
  function stopAnimation() {
    if (animationTimer !== null) {
      clearTimeout(animationTimer);
      animationTimer = null;
    }
  }
  function stopRetry() {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }
  function removeLayer() {
    stopAnimation();
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
    warn("API не вернул границы карты; используются резервные.");
    return FALLBACK_BOUNDS;
  }
  function frameUrl(frame) {
    return "data:image/png;base64," + frame.png;
  }
  function scheduleNext() {
    stopAnimation();
    if (
      destroyed ||
      !active ||
      !layer ||
      !frames.length ||
      getMode() !== "S"
    ) {
      return;
    }
    const current = frames[frameIndex];
    const sourceDelay = Number(current && current.delay);
    const delay =
      Number.isFinite(sourceDelay) && sourceDelay > 0
        ? Math.max(100, Math.min(sourceDelay, MAX_DELAY))
        : 700;
    animationTimer = setTimeout(function () {
      animationTimer = null;
      if (
        destroyed ||
        !active ||
        !layer ||
        getMode() !== "S"
      ) {
        syncMode();
        return;
      }
      frameIndex = (frameIndex + 1) % frames.length;
      const next = frames[frameIndex];
      if (next && next.png) {
        try {
          layer.setUrl(frameUrl(next));
        } catch (error) {
          console.error(
            "[Quantum Phenomena] Ошибка смены кадра:",
            error
          );
        }
      }
      scheduleNext();
    }, delay);
  }
  async function load() {
    if (destroyed || loading || active) return;
    map = getMap();
    if (!map) {
      scheduleRetry();
      return;
    }
    if (typeof window.L === "undefined") {
      console.error(
        "[Quantum Phenomena] Leaflet не загружен."
      );
      scheduleRetry();
      return;
    }
    if (getMode() !== "S") return;
    loading = true;
    const thisRequest = ++requestId;
    log("Запрашиваю кадры:", API);
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
          data.details || data.error || "API вернул ok:false"
        );
      }
      if (!Array.isArray(data.frames) || !data.frames.length) {
        throw new Error("В ответе API нет кадров frames.");
      }
      const validFrames = data.frames.filter(function (frame) {
        return (
          frame &&
          typeof frame.png === "string" &&
          frame.png.length > 0
        );
      });
      if (!validFrames.length) {
        throw new Error("Все кадры PNG пустые или некорректные.");
      }
      // Если пользователь переключился во время загрузки,
      // не добавляем слой в R/H.
      if (getMode() !== "S") {
        log("Режим изменился во время загрузки; кадры не добавлены.");
        return;
      }
      map = getMap();
      if (!map) {
        throw new Error("Карта Quantum Meteo недоступна.");
      }
      frames = validFrames;
      frameIndex = 0;
      const bounds = getBounds(data);
      layer = window.L.imageOverlay(
        frameUrl(frames[0]),
        bounds,
        {
          opacity: 1,
          interactive: false,
          className: "quantum-phenomena-overlay",
          alt: "Анимированные метеоявления Meteoinfo"
        }
      );
      layer.addTo(map);
      active = true;
      scheduleNext();
      log("Слой добавлен.", {
        frames: frames.length,
        width: data.width,
        height: data.height,
        bounds: bounds
      });
    } catch (error) {
      console.error(
        "[Quantum Phenomena] Не удалось показать GIF:",
        error
      );
      removeLayer();
      scheduleRetry();
    } finally {
      loading = false;
      // Если за время запроса выбран S, а слой не добавился,
      // повторяем проверку после завершения загрузки.
      if (
        !destroyed &&
        getMode() === "S" &&
        !active
      ) {
        scheduleRetry();
      }
    }
  }
  function scheduleRetry() {
    if (destroyed || retryTimer !== null) return;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (getMode() === "S") {
        load();
      }
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
      load();
      return;
    }
    if (mode === "R" || mode === "H") {
      requestId++;
      stopRetry();
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
    }, 50);
  }
  function init() {
    if (destroyed) return;
    map = getMap();
    if (!map) {
      setTimeout(init, 250);
      return;
    }
    installStyles();
    // Слушаем нажатия на кнопки режима.
    document.addEventListener("click", function (event) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-m="S"], [data-m="R"], [data-m="H"]')
      ) {
        scheduleSync();
      }
    });
    // Следим за изменением классов кнопок.
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
    // Если приложение создаёт кнопки позже — начинаем наблюдать
    // за ними и синхронизируем слой после появления.
    domObserver = new MutationObserver(function () {
      observeModeButtons();
      scheduleSync();
    });
    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    log("Модуль запущен.", {
      mapAvailable: !!map,
      mode: getMode()
    });
    syncMode();
    // Повторная проверка после завершения инициализации UI.
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
      stopAnimation();
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
      if (syncTimer !== null) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
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
