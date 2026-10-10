/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena
   Источник: /api/phenomena
   Включается только в режиме S.
   Режимы R/H не изменяет.
   ========================================================= */
(() => {
  "use strict";
  const SOURCE = "/api/phenomena";
  /*
   * Предварительные границы изображения.
   * Их необходимо проверить по совпадению с городами.
   */
  const BOUNDS = [
    [38.2156, 14.9893],
    [69.6544, 72.9238]
  ];
  let map = null;
  let overlay = null;
  let loading = false;
  let enabled = false;
  let requestId = 0;
  function findMap() {
    if (!window.L || !L.Map) return null;
    /*
     * Карта объявлена как локальная const в index.html,
     * поэтому ищем экземпляр Leaflet по контейнеру.
     */
    const instances = L.Map._instances || {};
    for (const key of Object.keys(instances)) {
      const candidate = instances[key];
      if (
        candidate &&
        candidate.getContainer &&
        candidate.getContainer().id === "map"
      ) {
        return candidate;
      }
    }
    return null;
  }
  function getMap() {
    map = findMap();
    return map;
  }
  function message(text) {
    const el = document.getElementById("msg");
    if (el) el.textContent = text || "";
  }
  function removeLayer() {
    requestId++;
    enabled = false;
    if (map && overlay && map.hasLayer(overlay)) {
      map.removeLayer(overlay);
    }
    overlay = null;
  }
  async function showLayer() {
    if (loading) {
      enabled = true;
      return;
    }
    map = getMap();
    if (!map) {
      message("Не удалось найти карту Leaflet");
      return;
    }
    if (overlay && map.hasLayer(overlay)) {
      enabled = true;
      return;
    }
    enabled = true;
    loading = true;
    const currentRequest = ++requestId;
    message("Загрузка метеоявлений Meteoinfo…");
    try {
      /*
       * Сначала загружаем GIF, затем добавляем её
       * на карту. Анимация исходной GIF сохраняется.
       */
      const response = await fetch(
        SOURCE + "?_=" + Date.now(),
        {
          method: "GET",
          cache: "no-store"
        }
      );
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const blob = await response.blob();
      if (
        !blob.type.toLowerCase().includes("gif")
      ) {
        throw new Error(
          "API не вернул изображение GIF"
        );
      }
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        if (
          currentRequest !== requestId ||
          !enabled
        ) {
          URL.revokeObjectURL(url);
          loading = false;
          return;
        }
        map = getMap();
        if (!map) {
          URL.revokeObjectURL(url);
          loading = false;
          message("Карта Leaflet недоступна");
          return;
        }
        if (overlay && map.hasLayer(overlay)) {
          map.removeLayer(overlay);
        }
        overlay = L.imageOverlay(
          url,
          BOUNDS,
          {
            opacity: 1,
            interactive: false,
            crossOrigin: false,
            className: "quantum-phenomena-overlay",
            alt: "Метеоявления Meteoinfo"
          }
        );
        overlay.addTo(map);
        overlay.setZIndex(450);
        /*
         * Не отзываем URL сразу после загрузки:
         * браузеру он нужен для показа анимированной GIF.
         */
        overlay.once("remove", () => {
          URL.revokeObjectURL(url);
        });
        loading = false;
        message("");
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        loading = false;
        if (currentRequest === requestId) {
          message("Не удалось декодировать GIF Meteoinfo");
        }
      };
      image.src = url;
    } catch (error) {
      loading = false;
      if (currentRequest === requestId) {
        console.error(
          "[Quantum Meteo] Phenomena:",
          error
        );
        message(
          "Ошибка метеоявлений: " +
          (error.message || "неизвестная ошибка")
        );
      }
    }
  }
  function handleModeClick(event) {
    const button = event.target.closest(
      ".st .b[data-m]"
    );
    if (!button) return;
    if (button.dataset.m === "S") {
      /*
       * Переключаем режим на S и загружаем GIF.
       * Таймлайн и существующие R/H обработчики
       * не заменяются.
       */
      showLayer();
    } else {
      removeLayer();
      message("");
    }
  }
  function init() {
    /*
     * Capture нужен, чтобы обработать нажатие,
     * не заменяя существующий обработчик кнопки.
     */
    document.addEventListener(
      "click",
      handleModeClick,
      true
    );
    /*
     * Удаляем GIF при выходе со страницы.
     */
    window.addEventListener("pagehide", () => {
      removeLayer();
    });
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
