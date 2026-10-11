
/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena
   API: /api/phenomena
   Режим: S

   - Получение прозрачных PNG-кадров из серверного API
   - Без сглаживания: imageSmoothingEnabled = false
   - Привязка к Leaflet
   - Удаление слоя при переключении на R/H
   - Без диагностических панелей

   index.html не изменять.
   Используется window.quantumMeteoMap.
   ========================================================= */

(() => {
  "use strict";

  const SOURCE = "/api/phenomena";

  // Предварительные границы. Для точной привязки их
  // необходимо откалибровать по исходной карте Meteoinfo.
  const BOUNDS = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];

  const DEFAULT_FRAME_DELAY = 500;

  let map = null;
  let layer = null;
  let canvas = null;
  let context = null;
  let frameImages = [];
  let frameDelays = [];
  let frameIndex = 0;
  let frameTimer = null;
  let resizeHandler = null;
  let enabled = false;
  let loading = false;
  let requestId = 0;

  function getMap() {
    const candidate = window.quantumMeteoMap;

    if (
      candidate &&
      typeof candidate.addLayer === "function" &&
      typeof candidate.hasLayer === "function"
    ) {
      return candidate;
    }

    return null;
  }

  function message(text) {
    const element = document.getElementById("msg");
    if (element) element.textContent = text || "";
  }

  function stopAnimation() {
    if (frameTimer !== null) {
      clearTimeout(frameTimer);
      frameTimer = null;
    }
  }

  function releaseResources() {
    stopAnimation();

    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }

    for (const image of frameImages) {
      image.onload = null;
      image.onerror = null;
      image.src = "";
    }

    frameImages = [];
    frameDelays = [];
    frameIndex = 0;
    canvas = null;
    context = null;
  }

  function removeLayer() {
    requestId++;
    enabled = false;
    loading = false;

    if (map && layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }

    if (layer && typeof layer.destroy === "function") {
      layer.destroy();
    }

    layer = null;
    map = getMap();
    releaseResources();
  }

  function drawFrame(index) {
    if (!canvas || !context || !frameImages.length) return;

    const image = frameImages[index];

    if (!image || !image.complete || !image.naturalWidth) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Запрещаем интерполяцию пикселей.
    context.imageSmoothingEnabled = false;

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  function scheduleNextFrame() {
    stopAnimation();

    if (!enabled || !frameImages.length) return;

    if (frameImages.length < 2) return;

    const delay = Math.max(
      100,
      Math.min(
        5000,
        Number(frameDelays[frameIndex]) || DEFAULT_FRAME_DELAY
      )
    );

    frameTimer = setTimeout(() => {
      if (!enabled || !frameImages.length) return;

      frameIndex = (frameIndex + 1) % frameImages.length;
      drawFrame(frameIndex);
      scheduleNextFrame();
    }, delay);
  }

  function createCanvasLayer(targetMap, width, height) {
    const L = window.L;

    const PhenomenaLayer = L.Layer.extend({
      onAdd: function (leafletMap) {
        this._map = leafletMap;

        canvas = document.createElement("canvas");
        canvas.className = "quantum-phenomena-canvas";

        canvas.width = width;
        canvas.height = height;

        Object.assign(canvas.style, {
          position: "absolute",
          display: "block",
          pointerEvents: "none",
          imageRendering: "pixelated",
          zIndex: "450"
        });

        context = canvas.getContext("2d", {
          alpha: true
        });

        if (!context) {
          throw new Error("Canvas 2D недоступен");
        }

        context.imageSmoothingEnabled = false;

        leafletMap.getPanes().overlayPane.appendChild(canvas);

        this._bounds = L.latLngBounds(BOUNDS);
        this._reset = this._reset.bind(this);

        leafletMap.on(
          "move zoom resize viewreset",
          this._reset
        );

        resizeHandler = this._reset;
        window.addEventListener("resize", resizeHandler);

        this._reset();
        drawFrame(frameIndex);
        scheduleNextFrame();
      },

      _reset: function () {
        if (!this._map || !canvas) return;

        const topLeft = this._map.latLngToLayerPoint(
          this._bounds.getNorthWest()
        );

        const bottomRight = this._map.latLngToLayerPoint(
          this._bounds.getSouthEast()
        );

        const widthOnMap = bottomRight.x - topLeft.x;
        const heightOnMap = bottomRight.y - topLeft.y;

        L.DomUtil.setPosition(canvas, topLeft);

        canvas.style.width = Math.max(0, widthOnMap) + "px";
        canvas.style.height = Math.max(0, heightOnMap) + "px";
      },

      onRemove: function (leafletMap) {
        leafletMap.off(
          "move zoom resize viewreset",
          this._reset
        );

        if (canvas && canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }

        stopAnimation();

        this._map = null;
      },

      destroy: function () {
        stopAnimation();
      }
    });

    return new PhenomenaLayer();
  }

  async function loadFrames() {
    const response = await fetch(
      SOURCE + "?_=" + Date.now(),
      {
        cache: "no-store",
        credentials: "same-origin"
      }
    );

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const result = await response.json();

    if (
      !result ||
      result.ok !== true ||
      !Array.isArray(result.frames) ||
      result.frames.length === 0
    ) {
      throw new Error(
        result && result.error
          ? result.error
          : "API не вернул PNG-кадры"
      );
    }

    const width = Number(result.width);
    const height = Number(result.height);

    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1
    ) {
      throw new Error("Некорректные размеры кадров");
    }

    const images = [];
    const delays = [];

    for (const frame of result.frames) {
      if (
        !frame ||
        typeof frame.png !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(frame.png)
      ) {
        throw new Error("Некорректный PNG-кадр");
      }

      const image = new Image();
      image.decoding = "async";
      image.src = "data:image/png;base64," + frame.png;

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(
          new Error("Не удалось загрузить PNG-кадр")
        );
      });

      if (
        image.naturalWidth !== width ||
        image.naturalHeight !== height
      ) {
        throw new Error("Размер PNG-кадра не совпадает с API");
      }

      images.push(image);
      delays.push(Number(frame.delay) || DEFAULT_FRAME_DELAY);
    }

    return { images, delays, width, height };
  }

  async function showLayer() {
    if (loading) {
      enabled = true;
      return;
    }

    map = getMap();

    if (
      !map ||
      !window.L ||
      typeof window.L.Layer !== "function"
    ) {
      message("Карта Leaflet недоступна");
      return;
    }

    if (layer && map.hasLayer(layer)) {
      enabled = true;
      message("");
      return;
    }

    enabled = true;
    loading = true;

    const currentRequest = ++requestId;
    message("Загрузка метеоявлений…");

    try {
      const result = await loadFrames();

      if (currentRequest !== requestId || !enabled) return;

      frameImages = result.images;
      frameDelays = result.delays;
      frameIndex = 0;

      layer = createCanvasLayer(
        map,
        result.width,
        result.height
      );

      layer.addTo(map);
      message("");
    } catch (error) {
      console.error("[Quantum Meteo] Phenomena:", error);

      if (currentRequest === requestId) {
        message(
          "Ошибка метеоявлений: " +
          (error.message || "неизвестная ошибка")
        );
      }

      releaseResources();

      if (layer && map && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }

      layer = null;
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
        if (
          button.isConnected &&
          button.dataset.m === "S"
        ) {
          showLayer();
        }
      }, 0);
    } else {
      removeLayer();
      message("");
    }
  }

  function init() {
    document.addEventListener("click", handleModeClick, false);
    window.addEventListener("pagehide", removeLayer);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
