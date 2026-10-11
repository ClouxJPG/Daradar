/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena
   Источник: /api/phenomena
   Режим: S
   Возможности:
   - прозрачный малонасыщенный фон;
   - сохранение цветных метеоявлений;
   - обработка анимированной GIF через Canvas;
   - географическая привязка к карте Leaflet;
   - автоматическое удаление слоя при переходе в R/H;
   - без диагностических панелей.
   index.html должен содержать:
   window.quantumMeteoMap = map;
   ========================================================= */
(() => {
  "use strict";
  const SOURCE = "/api/phenomena";
  const BOUNDS = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];
  const FRAME_INTERVAL = 100;
  // Настройки предварительного удаления фона.
  const MIN_SATURATION = 35;
  const MIN_COLOR_DIFFERENCE = 18;
  const MIN_BRIGHTNESS = 45;
  const MAX_BRIGHTNESS = 248;
  let map = null;
  let layer = null;
  let image = null;
  let canvas = null;
  let context = null;
  let frameTimer = null;
  let resizeHandler = null;
  let enabled = false;
  let loading = false;
  let requestId = 0;
  let imageUrl = null;
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
  function releaseResources() {
    if (frameTimer !== null) {
      clearInterval(frameTimer);
      frameTimer = null;
    }
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.src = "";
      image = null;
    }
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      imageUrl = null;
    }
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
  function makeTransparent() {
    if (!context || !canvas || !image) return;
    const width = canvas.width;
    const height = canvas.height;
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    let pixels;
    try {
      pixels = context.getImageData(0, 0, width, height);
    } catch (error) {
      console.error("[Quantum Meteo] Canvas:", error);
      return;
    }
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3;
      const saturation =
        max === 0 ? 0 : ((max - min) / max) * 255;
      const colorDifference = max - min;
      // Почти белый, серый и малонасыщенный фон
      // исходной метеокарты становится прозрачным.
      const background =
        (
          saturation < MIN_SATURATION &&
          colorDifference < MIN_COLOR_DIFFERENCE
        ) ||
        brightness < MIN_BRIGHTNESS ||
        brightness > MAX_BRIGHTNESS;
      if (background) {
        data[i + 3] = 0;
      }
    }
    context.putImageData(pixels, 0, 0);
  }
  function createCanvasLayer(targetMap) {
    const L = window.L;
    const PhenomenaCanvasLayer = L.Layer.extend({
      onAdd: function (leafletMap) {
        this._map = leafletMap;
        this._canvas = document.createElement("canvas");
        this._canvas.className = "quantum-phenomena-canvas";
        Object.assign(this._canvas.style, {
          position: "absolute",
          pointerEvents: "none",
          zIndex: "450"
        });
        this._canvas.width = image.naturalWidth;
        this._canvas.height = image.naturalHeight;
        const pane = leafletMap.getPanes().overlayPane;
        pane.appendChild(this._canvas);
        canvas = this._canvas;
        context = canvas.getContext("2d", {
          alpha: true,
          willReadFrequently: true
        });
        this._bounds = L.latLngBounds(BOUNDS);
        this._reset = this._reset.bind(this);
        leafletMap.on("move zoom resize viewreset", this._reset);
        this._reset();
        // GIF остаётся анимированной: Canvas периодически
        // считывает текущий кадр из браузерного декодера.
        frameTimer = setInterval(() => {
          if (!enabled || !this._map || !image) return;
          makeTransparent();
        }, FRAME_INTERVAL);
        resizeHandler = () => this._reset();
        window.addEventListener("resize", resizeHandler);
      },
      _reset: function () {
        if (!this._map || !this._canvas) return;
        const topLeft = this._map.latLngToLayerPoint(
          this._bounds.getNorthWest()
        );
        const bottomRight = this._map.latLngToLayerPoint(
          this._bounds.getSouthEast()
        );
        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;
        L.DomUtil.setPosition(this._canvas, topLeft);
        this._canvas.style.width = Math.max(0, width) + "px";
        this._canvas.style.height = Math.max(0, height) + "px";
      },
      onRemove: function (leafletMap) {
        leafletMap.off("move zoom resize viewreset", this._reset);
        if (this._canvas && this._canvas.parentNode) {
          this._canvas.parentNode.removeChild(this._canvas);
        }
        this._canvas = null;
        this._map = null;
      },
      destroy: function () {
        if (frameTimer !== null) {
          clearInterval(frameTimer);
          frameTimer = null;
        }
      }
    });
    return new PhenomenaCanvasLayer();
  }
  async function showLayer() {
    if (loading) {
      enabled = true;
      return;
    }
    map = getMap();
    if (!map || !window.L || typeof window.L.Layer !== "function") {
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
      const blob = await response.blob();
      const signature = String.fromCharCode(
        ...new Uint8Array(
          await blob.slice(0, 6).arrayBuffer()
        )
      );
      if (
        signature !== "GIF87a" &&
        signature !== "GIF89a"
      ) {
        throw new Error("Сервер не вернул GIF");
      }
      const url = URL.createObjectURL(blob);
      const loadedImage = new Image();
      await new Promise((resolve, reject) => {
        loadedImage.onload = resolve;
        loadedImage.onerror = () => {
          reject(new Error("Не удалось декодировать GIF"));
        };
        loadedImage.src = url;
      });
      if (currentRequest !== requestId || !enabled) {
        URL.revokeObjectURL(url);
        return;
      }
      if (!loadedImage.naturalWidth || !loadedImage.naturalHeight) {
        URL.revokeObjectURL(url);
        throw new Error("У GIF неверный размер");
      }
      image = loadedImage;
      imageUrl = url;
      layer = createCanvasLayer(map);
      layer.addTo(map);
      // Сразу обрабатываем первый доступный кадр.
      makeTransparent();
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
      // Даём штатному обработчику переключить режим.
      setTimeout(() => {
        if (button.isConnected && button.dataset.m === "S") {
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
