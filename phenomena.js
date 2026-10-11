
/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena
   Источник: /api/phenomena
   Режим: S

   - Прозрачные PNG-кадры с сервера.
   - Переключение кадров по таймеру.
   - Без Canvas и сглаживания GIF.
   - Географическая привязка через Leaflet.
   - Удаление слоя при переключении в R/H.
   ========================================================= */

(() => {
  "use strict";

  const API = "/api/phenomena";
  const FRAME_FALLBACK_MS = 500;

  let map = null;
  let layer = null;
  let frameTimer = null;
  let frames = [];
  let frameIndex = 0;
  let enabled = false;
  let loading = false;
  let requestId = 0;
  let currentBounds = null;

  function getMap() {
    const candidate = window.quantumMeteoMap;

    return candidate &&
      typeof candidate.addLayer === "function" &&
      typeof candidate.hasLayer === "function"
      ? candidate
      : null;
  }

  function showMessage(text) {
    const element = document.getElementById("msg");
    if (element) element.textContent = text || "";
  }

  function stopFrameTimer() {
    if (frameTimer !== null) {
      clearTimeout(frameTimer);
      frameTimer = null;
    }
  }

  function removeLayer() {
    requestId++;
    enabled = false;
    loading = false;

    stopFrameTimer();

    if (map && layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }

    layer = null;
    frames = [];
    frameIndex = 0;
    currentBounds = null;
    map = getMap();
  }

  function frameUrl(frame) {
    return "data:image/png;base64," + frame.png;
  }

  function showFrame(index) {
    if (!enabled || !map || !frames.length || !layer) return;

    frameIndex = index % frames.length;

    const frame = frames[frameIndex];
    const url = frameUrl(frame);

    /*
     * Переиспользуем один ImageOverlay.
     * Это предотвращает накопление слоёв на карте.
     */
    layer.setUrl(url);

    const delay = Math.max(
      100,
      Number(frame.delay) || FRAME_FALLBACK_MS
    );

    stopFrameTimer();

    if (frames.length > 1) {
      frameTimer = setTimeout(() => {
        if (!enabled) return;
        showFrame((frameIndex + 1) % frames.length);
      }, delay);
    }
  }

  async function showLayer() {
    if (loading) {
      enabled = true;
      return;
    }

    map = getMap();

    if (!map || !window.L) {
      showMessage("Карта Leaflet недоступна");
      return;
    }

    if (layer && map.hasLayer(layer)) {
      enabled = true;
      return;
    }

    enabled = true;
    loading = true;

    const currentRequest = ++requestId;
    showMessage("Загрузка метеоявлений…");

    try {
      const response = await fetch(
        API + "?_=" + Date.now(),
        {
          cache: "no-store",
          credentials: "same-origin"
        }
      );

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();

      if (!data.ok || !Array.isArray(data.frames) || !data.frames.length) {
        throw new Error("Сервер не вернул PNG-кадры");
      }

      if (currentRequest !== requestId || !enabled) return;

      const boundsData = data.bounds;

      if (
        !boundsData ||
        !Number.isFinite(boundsData.south) ||
        !Number.isFinite(boundsData.west) ||
        !Number.isFinite(boundsData.north) ||
        !Number.isFinite(boundsData.east)
      ) {
        throw new Error("Некорректные границы изображения");
      }

      currentBounds = [
        [boundsData.south, boundsData.west],
        [boundsData.north, boundsData.east]
      ];

      frames = data.frames.filter(
        frame =>
          frame &&
          typeof frame.png === "string" &&
          frame.png.length > 0
      );

      if (!frames.length) {
        throw new Error("Нет пригодных PNG-кадров");
      }

      frameIndex = 0;

      layer = window.L.imageOverlay(
        frameUrl(frames[0]),
        currentBounds,
        {
          opacity: 1,
          interactive: false,
          className: "quantum-phenomena-frame"
        }
      );

      layer.addTo(map);

      showMessage("");
      showFrame(0);
    } catch (error) {
      console.error("[Quantum Meteo] Phenomena:", error);

      if (currentRequest === requestId) {
        removeLayer();
        showMessage(
          "Ошибка метеоявлений: " +
          (error.message || "неизвестная ошибка")
        );
      }
    } finally {
      if (currentRequest === requestId) {
        loading = false;
      }
    }
  }

  function handleModeClick(event) {
    const target = event.target;

    if (!target || typeof target.closest !== "function") return;

    const button = target.closest(".st .b[data-m]");
    if (!button) return;

    if (button.dataset.m === "S") {
      setTimeout(() => {
        if (button.isConnected && button.dataset.m === "S") {
          showLayer();
        }
      }, 0);
    } else {
      removeLayer();
      showMessage("");
    }
  }

  function init() {
    document.addEventListener("click", handleModeClick, false);

    window.addEventListener("pagehide", () => {
      removeLayer();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
