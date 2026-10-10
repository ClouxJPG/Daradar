/* =========================================================
   Daradar — Meteoinfo Phenomena
   Источник: /api/phenomena
   Работает только в режиме S.
   Режимы R и H не изменяет.
   ========================================================= */
(() => {
  'use strict';
  const BUTTON = '.st .b[data-m="S"]';
  const API = '/api/phenomena';
  let map = null;
  let overlay = null;
  let image = null;
  let enabled = false;
  let loading = false;
  let loaded = false;
  let objectUrl = null;
  let requestId = 0;
  // Географические границы изображения.
  // Их нужно уточнить по реальной рамке GIF Метеоинфо.
  // Не выдаём эти границы за проверенную геопривязку.
  const BOUNDS = null;
  function message(text) {
    const el = document.getElementById('msg');
    if (el) el.textContent = text || '';
  }
  function getMap() {
    if (window.DaradarMap instanceof Object) {
      return window.DaradarMap;
    }
    if (window.map && typeof window.map.getBounds === 'function') {
      return window.map;
    }
    return null;
  }
  function removeOverlay() {
    if (overlay && map) {
      try {
        map.removeLayer(overlay);
      } catch (_) {}
    }
    overlay = null;
  }
  function clearImage() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    image = null;
    loaded = false;
  }
  async function loadGif() {
    if (loading || loaded) return;
    loading = true;
    const currentRequest = ++requestId;
    message('Метеоинфо: загрузка GIF…');
    try {
      const response = await fetch(API, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          Accept: 'image/gif'
        }
      });
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      const type = (
        response.headers.get('content-type') || ''
      ).toLowerCase();
      if (!type.includes('image/gif')) {
        throw new Error('Сервер вернул не GIF');
      }
      const blob = await response.blob();
      if (blob.size < 100) {
        throw new Error('GIF пустой или повреждён');
      }
      if (currentRequest !== requestId) return;
      objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (currentRequest !== requestId) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        image = img;
        loaded = true;
        loading = false;
        render();
        if (enabled) {
          message('');
        }
      };
      img.onerror = () => {
        if (currentRequest !== requestId) return;
        loading = false;
        clearImage();
        message('Метеоинфо: GIF не удалось открыть');
      };
      img.src = objectUrl;
    } catch (error) {
      if (currentRequest !== requestId) return;
      loading = false;
      message(
        'Метеоинфо: ошибка загрузки (' +
        (error && error.message ? error.message : 'неизвестная ошибка') +
        ')'
      );
    }
  }
  function render() {
    if (!enabled || !image || !map) {
      removeOverlay();
      return;
    }
    if (!BOUNDS) {
      // Не показываем изображение на случайной территории:
      // без подтверждённых координат слой нельзя точно совместить с картой.
      message(
        'GIF получен. Для отображения на карте нужны точные географические границы изображения.'
      );
      return;
    }
    const bounds = L.latLngBounds(BOUNDS);
    if (!overlay) {
      overlay = L.imageOverlay(image.src, bounds, {
        opacity: 1,
        interactive: false,
        zIndex: 500
      });
      overlay.addTo(map);
    } else {
      overlay.setUrl(image.src);
      overlay.setBounds(bounds);
    }
  }
  function activate() {
    enabled = true;
    if (!map) map = getMap();
    if (!map) {
      message(
        'S: карта пока недоступна. Нужна привязка к карте Daradar.'
      );
      return;
    }
    if (loaded) {
      render();
    } else {
      loadGif();
    }
  }
  function deactivate() {
    enabled = false;
    removeOverlay();
    message('');
  }
  function bind() {
    const buttons = document.querySelectorAll(BUTTON);
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        // Основное приложение меняет S/R/H самостоятельно.
        // Проверяем выбранный режим после обработки события.
        setTimeout(() => {
          const active =
            button.classList.contains('red') ||
            button.classList.contains('on');
          if (active) {
            activate();
          } else {
            deactivate();
          }
        }, 0);
      });
    });
    if (window.L && typeof window.L.map === 'function') {
      map = getMap();
    }
    if (map) {
      map.on('moveend', render);
      map.on('zoomend', render);
    }
  }
  window.DaradarPhenomena = {
    activate,
    deactivate,
    reload() {
      requestId++;
      loading = false;
      removeOverlay();
      clearImage();
      if (enabled) loadGif();
    },
    status() {
      return {
        enabled,
        loading,
        loaded,
        hasMap: !!map,
        georeferenced: !!BOUNDS
      };
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, {
      once: true
    });
  } else {
    bind();
  }
})();
