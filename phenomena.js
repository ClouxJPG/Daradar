/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena
   Источник: /api/phenomena
   Отображение в режиме S.
   Режимы R/H не изменяются.
   Требование:
   index.html должен содержать:
   window.quantumMeteoMap = map;
   сразу после создания карты Leaflet.
   ========================================================= */
(() => {
  "use strict";
  const SOURCE = "/api/phenomena";
  // Предварительные географические границы исходной GIF.
  // Из-за полей и легенды исходной карты совмещение нужно проверить.
  const BOUNDS = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];
  let overlay = null;
  let objectUrl = null;
  let loading = false;
  let enabled = false;
  let requestId = 0;
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
    if (!map) {
      message("Карта Leaflet ещё не готова");
      return;
    }
    if (overlay && map.hasLayer(overlay)) {
      message("");
      return;
    }
    // Не запускаем параллельные загрузки GIF.
    if (loading) return;
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
      // Проверяем содержимое GIF по сигнатуре, а не только MIME.
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
      // Если пользователь уже переключил режим, не добавляем слой.
      if (currentRequest !== requestId || !enabled) {
        URL.revokeObjectURL(temporaryUrl);
        temporaryUrl = null;
        return;
      }
      const currentMap = getMap();
      if (!currentMap) {
        throw new Error("Карта Leaflet недоступна");
      }
      if (overlay && currentMap.hasLayer(overlay)) {
        currentMap.removeLayer(overlay);
      }
      releaseImage();
      objectUrl = temporaryUrl;
      temporaryUrl = null;
      overlay = L.imageOverlay(
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
      message("");
    } catch (error) {
      console.error(
        "[Quantum Meteo] Ошибка метеоявлений:",
        error
      );
      if (temporaryUrl) {
        URL.revokeObjectURL(temporaryUrl);
      }
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
    const button = event.target.closest(".st .b[data-m]");
    if (!button) return;
    if (button.dataset.m === "S") {
      // Не отменяем существующий обработчик режима S.
      showLayer();
    } else {
      // При переходе в R или H убираем слой метеоявлений.
      removeLayer();
      message("");
    }
  }
  function init() {
    document.addEventListener(
      "click",
      handleModeClick,
      true
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
