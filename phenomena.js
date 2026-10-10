/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena
   Источник: /api/phenomena
   Отображение в режиме S.
   Режимы R/H не изменяются.
   Диагностика:
   - наличие window.quantumMeteoMap;
   - загрузка Leaflet;
   - доступность карты;
   - ошибки загрузки GIF.
   index.html должен содержать:
   window.quantumMeteoMap = map;
   сразу после создания карты Leaflet.
   ========================================================= */
(() => {
  "use strict";
  const SOURCE = "/api/phenomena";
  const BOUNDS = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];
  let overlay = null;
  let objectUrl = null;
  let loading = false;
  let enabled = false;
  let requestId = 0;
  // Диагностическая панель на странице.
  function diagnostic(text, isError = false) {
    let panel = document.getElementById("phenomena-debug");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "phenomena-debug";
      Object.assign(panel.style, {
        position: "fixed",
        left: "10px",
        right: "10px",
        bottom: "70px",
        zIndex: "999999",
        padding: "10px 12px",
        borderRadius: "8px",
        background: "rgba(12,18,28,0.96)",
        color: "#ffffff",
        font: "12px/1.5 monospace",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        maxHeight: "35vh",
        overflowY: "auto",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "none"
      });
      document.body.appendChild(panel);
    }
    panel.style.display = "block";
    panel.style.borderColor = isError ? "#ff5555" : "#45b7ff";
    panel.textContent = "[Quantum Meteo — диагностика]\n" + text;
  }
  function getMap() {
    const map = window.quantumMeteoMap;
    if (
      map &&
      typeof map.addLayer === "function" &&
      typeof map.hasLayer === "function"
    ) {
      return map;
    }
    return null;
  }
  function message(text) {
    const element = document.getElementById("msg");
    if (element) {
      element.textContent = text || "";
    }
  }
  function releaseImage() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }
  function removeLayer() {
    requestId++;
    enabled = false;
    const map = getMap();
    if (map && overlay && map.hasLayer(overlay)) {
      map.removeLayer(overlay);
    }
    overlay = null;
    loading = false;
    releaseImage();
  }
  async function showLayer() {
    enabled = true;
    const map = getMap();
    // Диагностика доступности Leaflet и объекта карты.
    diagnostic(
      "window.quantumMeteoMap: " +
        (window.quantumMeteoMap ? "есть" : "НЕТ") +
      "\nwindow.L: " +
        (window.L ? "есть" : "НЕТ") +
      "\nmapFound: " +
        Boolean(map) +
      "\nmapType: " +
        (map && map.constructor
          ? map.constructor.name
          : "недоступен") +
      "\nmapContainer: " +
        (map && map.getContainer
          ? map.getContainer().id
          : "недоступен"),
      !map
    );
    if (!map) {
      message("Карта Leaflet недоступна");
      return;
    }
    if (!window.L || typeof window.L.imageOverlay !== "function") {
      diagnostic(
        "Карта найдена, но L.imageOverlay недоступен.\n" +
        "Проверь подключение Leaflet.",
        true
      );
      message("Ошибка: Leaflet не готов");
      return;
    }
    if (overlay && map.hasLayer(overlay)) {
      message("");
      return;
    }
    if (loading) {
      return;
    }
    loading = true;
    const currentRequest = ++requestId;
    message("Загрузка метеоявлений Meteoinfo…");
    let temporaryUrl = null;
    try {
      const response = await fetch(
        SOURCE + "?_=" + Date.now(),
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin"
        }
      );
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const blob = await response.blob();
      const header = new Uint8Array(
        await blob.slice(0, 6).arrayBuffer()
      );
      const signature = String.fromCharCode(...header);
      if (
        signature !== "GIF87a" &&
        signature !== "GIF89a"
      ) {
        throw new Error(
          "Ответ /api/phenomena не является GIF"
        );
      }
      temporaryUrl = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => {
          reject(new Error("Браузер не смог открыть GIF"));
        };
        image.src = temporaryUrl;
      });
      if (currentRequest !== requestId || !enabled) {
        URL.revokeObjectURL(temporaryUrl);
        temporaryUrl = null;
        return;
      }
      const currentMap = getMap();
      if (!currentMap) {
        throw new Error(
          "window.quantumMeteoMap исчез во время загрузки"
        );
      }
      if (overlay && currentMap.hasLayer(overlay)) {
        currentMap.removeLayer(overlay);
      }
      releaseImage();
      objectUrl = temporaryUrl;
      temporaryUrl = null;
      overlay = window.L.imageOverlay(
        objectUrl,
        BOUNDS,
        {
          opacity: 1,
          interactive: false,
          className: "quantum-phenomena-overlay",
          alt: "Метеоявления Meteoinfo"
        }
      );
      overlay.addTo(currentMap);
      overlay.setZIndex(450);
      diagnostic(
        "Карта найдена.\n" +
        "GIF загружен: " + image.naturalWidth +
        " × " + image.naturalHeight + "\n" +
        "Слой добавлен на карту."
      );
      message("");
    } catch (error) {
      console.error(
        "[Quantum Meteo] Ошибка метеоявлений:",
        error
      );
      if (temporaryUrl) {
        URL.revokeObjectURL(temporaryUrl);
      }
      diagnostic(
        "Ошибка: " + (error.message || "неизвестная ошибка"),
        true
      );
      if (currentRequest === requestId) {
        message(
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
    if (!target || typeof target.closest !== "function") {
      return;
    }
    const button = target.closest(".st .b[data-m]");
    if (!button) {
      return;
    }
    if (button.dataset.m === "S") {
      // Даём штатному обработчику режима S выполниться.
      setTimeout(() => {
        if (button.dataset.m === "S") {
          showLayer();
        }
      }, 0);
    } else {
      removeLayer();
      message("");
    }
  }
  function init() {
    // Не используем capture-фазу.
    document.addEventListener(
      "click",
      handleModeClick,
      false
    );
    window.addEventListener("pagehide", removeLayer);
  }
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
