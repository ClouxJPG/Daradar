/* =========================================================
   CLOrad — Meteoinfo DMRL
   Отдельный модуль Meteoinfo.js

   НЕ ТРЕБУЕТ ИЗМЕНЕНИЯ index.html

   Что делает:
   - подключает реальные радарные наблюдения Meteoinfo
   - использует Meteoinfo radar tile endpoint
   - добавляет отдельную кнопку «Метеоинфо ДМРЛ»
   - работает на мобильных устройствах
   - позволяет включать / выключать слой
   - сохраняет старый кадр до загрузки нового
   - без fade / transition / затемнения
   - автоматически обновляет последний кадр
   ========================================================= */

(() => {
  'use strict';

  /* =========================================================
     НАСТРОЙКИ
     ========================================================= */

  const CONFIG = {

    // Meteoinfo radar tiles
    tileUrl:
      'https://meteoinfo.ru/res/nowcast/{z}0{x}0{y}/ncgi.php' +
      '?tnz={z}&tnx={x}&tny={y}' +
      '&layers=1' +
      '&inidt={time}',

    // Шаг кадров — 10 минут
    frameStep: 10 * 60 * 1000,

    // Сколько старых кадров держать
    framesBack: 18,

    // Начальная прозрачность
    opacity: 0.88,

    // Z-index над картой
    zIndex: 320,

    // Масштабы
    minZoom: 4,
    maxZoom: 11,
    nativeMinZoom: 5,
    nativeMaxZoom: 8,

    // Географические границы радара
    bounds: [
      [42.0776, 18.6794],
      [68.2286, 62.6090]
    ],

    // Автообновление
    refreshInterval: 60 * 1000,

    // Таймаут ожидания нового кадра
    loadTimeout: 15000
  };


  /* =========================================================
     ПРОВЕРКА LEAFLET
     ========================================================= */

  if (typeof L === 'undefined') {
    console.error(
      '[Meteoinfo] Leaflet не найден. ' +
      'Подключи Leaflet перед Meteoinfo.js.'
    );
    return;
  }


  /* =========================================================
     ПОИСК MAP
     ========================================================= */

  let map = null;

  function findMap() {

    // Если карта уже записана глобально
    if (window.map && window.map instanceof L.Map) {
      return window.map;
    }

    // Ищем Leaflet-карту среди элементов страницы
    const mapElement = document.getElementById('map');

    if (!mapElement) {
      console.error(
        '[Meteoinfo] Не найден элемент #map.'
      );
      return null;
    }

    // Leaflet не предоставляет прямого API поиска
    // карты по DOM-элементу, поэтому проверяем
    // существующие объекты через известную переменную.
    if (window.cloradMap instanceof L.Map) {
      return window.cloradMap;
    }

    return null;
  }


  /* =========================================================
     ОЖИДАНИЕ ИНИЦИАЛИЗАЦИИ КАРТЫ
     ========================================================= */

  function waitForMap(callback, attempts = 100) {

    const found = findMap();

    if (found) {
      map = found;
      callback();
      return;
    }

    if (attempts <= 0) {
      console.error(
        '[Meteoinfo] Не удалось найти Leaflet map.'
      );
      return;
    }

    setTimeout(() => {
      waitForMap(callback, attempts - 1);
    }, 100);
  }


  /* =========================================================
     ВРЕМЯ КАДРА
     ========================================================= */

  function floorTime(time) {
    return Math.floor(time / CONFIG.frameStep) *
           CONFIG.frameStep;
  }


  function makeFrames() {

    const latest = floorTime(Date.now());

    const result = [];

    for (
      let i = CONFIG.framesBack;
      i >= 0;
      i--
    ) {
      result.push(
        latest - i * CONFIG.frameStep
      );
    }

    return result;
  }


  /* =========================================================
     ФОРМАТ ВРЕМЕНИ
     ========================================================= */

  function formatTime(timestamp) {

    const d = new Date(timestamp);

    const hh = String(
      d.getHours()
    ).padStart(2, '0');

    const mm = String(
      d.getMinutes()
    ).padStart(2, '0');

    return `${hh}:${mm}`;
  }


  function formatDate(timestamp) {

    const d = new Date(timestamp);

    const dd = String(
      d.getDate()
    ).padStart(2, '0');

    const mm = String(
      d.getMonth() + 1
    ).padStart(2, '0');

    return `${dd}.${mm}`;
  }


  /* =========================================================
     URL РАДАРНОГО TILE
     ========================================================= */

  function getTileUrl(coords, timestamp) {

    /*
      ВАЖНО:

      Leaflet использует Y сверху вниз.

      Meteoinfo в этом endpoint использует
      перевёрнутую координату Y.
    */

    const max = Math.pow(
      2,
      coords.z
    );

    const tny =
      (max - 1) - coords.y;

    return CONFIG.tileUrl
      .replace('{z}', coords.z)
      .replace('{x}', coords.x)
      .replace('{y}', tny)
      .replace('{time}', timestamp);
  }


  /* =========================================================
     RADAR GRID LAYER
     ========================================================= */

  const MeteoinfoGrid =
    L.GridLayer.extend({

      initialize: function(timestamp, options) {

        this.timestamp = timestamp;

        L.GridLayer.prototype.initialize.call(
          this,
          Object.assign({

            tileSize: 256,

            opacity: CONFIG.opacity,

            zIndex: CONFIG.zIndex,

            minZoom: CONFIG.minZoom,

            maxZoom: CONFIG.maxZoom,

            minNativeZoom:
              CONFIG.nativeMinZoom,

            maxNativeZoom:
              CONFIG.nativeMaxZoom,

            bounds:
              L.latLngBounds(
                CONFIG.bounds
              ),

            updateWhenZooming: false,

            updateWhenIdle: true,

            keepBuffer: 2

          }, options || {})
        );
      },


      createTile: function(coords, done) {

        const canvas =
          document.createElement('canvas');

        canvas.width = 256;
        canvas.height = 256;

        const ctx =
          canvas.getContext('2d');

        const img =
          new Image();

        img.crossOrigin = 'anonymous';

        let finished = false;

        const finish = (
          error = null
        ) => {

          if (finished) {
            return;
          }

          finished = true;

          done(
            error,
            canvas
          );
        };


        img.onload = () => {

          try {

            ctx.drawImage(
              img,
              0,
              0,
              256,
              256
            );

          } catch (error) {

            console.warn(
              '[Meteoinfo] Ошибка canvas:',
              error
            );

          }

          finish();
        };


        img.onerror = () => {

          /*
            Ошибка отдельного tile
            не должна уничтожать весь слой.
          */

          finish();
        };


        img.src =
          getTileUrl(
            coords,
            this.timestamp
          );


        /*
          Защита от зависшего запроса.
        */

        setTimeout(() => {
          finish();
        }, CONFIG.loadTimeout);


        return canvas;
      }

    });


  /* =========================================================
     СОСТОЯНИЕ
     ========================================================= */

  let radarLayer = null;

  let pendingLayer = null;

  let radarEnabled = true;

  let currentFrame =
    floorTime(Date.now());

  let generation = 0;

  let refreshTimer = null;

  let frameList = [];


  /* =========================================================
     СОЗДАНИЕ НОВОГО КАДРА
     ========================================================= */

  function createRadarLayer(timestamp) {

    return new MeteoinfoGrid(
      timestamp,
      {
        opacity:
          CONFIG.opacity,

        zIndex:
          CONFIG.zIndex
      }
    );
  }


  /* =========================================================
     ПЕРЕКЛЮЧЕНИЕ КАДРА
     БЕЗ ЧЁРНОГО МИГАНИЯ
     ========================================================= */

  function switchFrame(timestamp) {

    if (!map) {
      return;
    }

    if (
      radarLayer &&
      radarLayer.timestamp === timestamp
    ) {
      updateStatus(timestamp);
      return;
    }


    const myGeneration =
      ++generation;


    /*
      Новый слой создаётся поверх старого.

      Старый слой НЕ скрываем.
      Поэтому карта не становится чёрной.
    */

    const newLayer =
      createRadarLayer(timestamp);

    pendingLayer = newLayer;

    newLayer.setOpacity(
      CONFIG.opacity
    );

    newLayer.addTo(map);


    let swapped = false;


    const swap = () => {

      if (swapped) {
        return;
      }

      swapped = true;


      /*
        Если пользователь уже выбрал
        другой кадр — этот слой устарел.
      */

      if (
        myGeneration !== generation
      ) {

        if (map.hasLayer(newLayer)) {
          map.removeLayer(newLayer);
        }

        return;
      }


      const oldLayer =
        radarLayer;


      radarLayer =
        newLayer;

      pendingLayer =
        null;

      currentFrame =
        timestamp;


      /*
        Старый слой удаляем только
        ПОСЛЕ загрузки нового.
      */

      if (
        oldLayer &&
        map.hasLayer(oldLayer)
      ) {

        map.removeLayer(
          oldLayer
        );
      }


      updateStatus(timestamp);

      updateButton();

      updateTimeline();
    };


    /*
      GridLayer вызывает load,
      когда необходимые tiles
      текущего viewport загружены.
    */

    newLayer.once(
      'load',
      swap
    );


    /*
      Если сервер отвечает очень медленно,
      не оставляем бесконечный pending.

      При этом старый слой остаётся.
    */

    setTimeout(() => {

      if (
        swapped ||
        myGeneration !== generation
      ) {
        return;
      }

      /*
        Даём слою шанс появиться,
        если хотя бы часть тайлов
        уже загрузилась.
      */

      if (
        newLayer._tiles &&
        Object.keys(
          newLayer._tiles
        ).length > 0
      ) {

        swap();

      } else {

        /*
          Ничего не загружено.
          Старый кадр оставляем.
        */

        if (
          map.hasLayer(newLayer)
        ) {
          map.removeLayer(
            newLayer
          );
        }

        pendingLayer =
          null;

      }

    }, CONFIG.loadTimeout);
  }


  /* =========================================================
     КНОПКА МЕТЕОИНФО ДМРЛ
     ========================================================= */

  const MeteoinfoControl =
    L.Control.extend({

      options: {
        position: 'topleft'
      },


      onAdd: function() {

        const container =
          L.DomUtil.create(
            'div',
            'meteoinfo-control'
          );


        const button =
          L.DomUtil.create(
            'button',
            'meteoinfo-button',
            container
          );


        button.type =
          'button';

        button.id =
          'meteoinfo-dmrl-button';


        button.innerHTML =
          '<span class="meteoinfo-dot"></span>' +
          '<span>Метеоинфо ДМРЛ</span>';


        button.title =
          'Метеоинфо — радарные наблюдения';


        L.DomEvent.disableClickPropagation(
          container
        );

        L.DomEvent.on(
          button,
          'click',
          function(e) {

            L.DomEvent.stopPropagation(e);

            toggleRadar();
          }
        );


        return container;
      }

    });


  /* =========================================================
     CSS КНОПКИ
     ========================================================= */

  function injectStyles() {

    if (
      document.getElementById(
        'meteoinfo-js-style'
      )
    ) {
      return;
    }


    const style =
      document.createElement('style');

    style.id =
      'meteoinfo-js-style';


    style.textContent = `

      .meteoinfo-control {
        margin-top: 10px !important;
      }

      .meteoinfo-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;

        min-height: 36px;
        padding: 0 11px;

        border: 1px solid rgba(120,145,125,.42);
        border-radius: 7px;

        background: rgba(9,16,11,.94);

        color: #c9d5cb;

        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;

        font-size: 10px;
        font-weight: 600;

        letter-spacing: .35px;

        box-shadow:
          0 2px 9px rgba(0,0,0,.42);

        cursor: pointer;

        -webkit-tap-highlight-color:
          transparent;

        user-select: none;

        transition:
          none !important;
      }


      .meteoinfo-button:hover {
        background:
          rgba(15,28,18,.98);

        border-color:
          rgba(120,180,130,.65);
      }


      .meteoinfo-button.active {
        background:
          rgba(22,70,36,.97);

        border-color:
          rgba(90,180,110,.78);

        color:
          #eaffef;
      }


      .meteoinfo-button.off {
        background:
          rgba(20,20,20,.94);

        border-color:
          rgba(130,130,130,.32);

        color:
          #9b9b9b;
      }


      .meteoinfo-dot {
        display: block;

        width: 7px;
        height: 7px;

        border-radius: 50%;

        background: #55d879;

        box-shadow:
          0 0 6px rgba(85,216,121,.65);
      }


      .meteoinfo-button.off
      .meteoinfo-dot {
        background: #777;

        box-shadow: none;
      }


      @media (max-width: 640px) {

        .meteoinfo-control {
          margin-top: 8px !important;
          margin-left: 4px !important;
        }

        .meteoinfo-button {
          min-height: 38px;
          padding: 0 10px;

          font-size: 9px;

          border-radius: 7px;
        }

      }

    `;


    document.head.appendChild(
      style
    );
  }


  /* =========================================================
     TOGGLE
     ========================================================= */

  function toggleRadar() {

    if (!map) {
      return;
    }


    radarEnabled =
      !radarEnabled;


    if (radarEnabled) {

      if (!radarLayer) {

        switchFrame(
          currentFrame
        );

      } else {

        radarLayer.setOpacity(
          CONFIG.opacity
        );
      }

    } else {

      /*
        Просто скрываем слой.

        Никаких переходов,
        fade и затемнения.
      */

      if (radarLayer) {

        radarLayer.setOpacity(
          0
        );
      }
    }


    updateButton();
  }


  /* =========================================================
     СОСТОЯНИЕ КНОПКИ
     ========================================================= */

  function updateButton() {

    const button =
      document.getElementById(
        'meteoinfo-dmrl-button'
      );

    if (!button) {
      return;
    }


    if (radarEnabled) {

      button.classList.add(
        'active'
      );

      button.classList.remove(
        'off'
      );

    } else {

      button.classList.remove(
        'active'
      );

      button.classList.add(
        'off'
      );
    }
  }


  /* =========================================================
     ИНФО О ТЕКУЩЕМ КАДРЕ
     ========================================================= */

  function updateStatus(timestamp) {

    const text =
      `Метеоинфо ДМРЛ · ` +
      `${formatDate(timestamp)} ` +
      `${formatTime(timestamp)}`;


    /*
      Если в index.html уже есть
      подходящие элементы — обновляем их.
    */

    const candidates = [
      'data-badge',
      'timeLabel',
      'time-label',
      'timeLabelText',
      'mp-time'
    ];


    candidates.forEach(id => {

      const el =
        document.getElementById(id);

      if (!el) {
        return;
      }

      el.textContent =
        text;
    });


    /*
      Создаём небольшой собственный статус,
      если его ещё нет.
    */

    let status =
      document.getElementById(
        'meteoinfo-status'
      );


    if (!status) {

      status =
        document.createElement(
          'div'
        );

      status.id =
        'meteoinfo-status';


      status.style.position =
        'absolute';

      status.style.left =
        '10px';

      status.style.bottom =
        '10px';

      status.style.zIndex =
        '1000';

      status.style.padding =
        '5px 8px';

      status.style.border =
        '1px solid rgba(120,145,125,.32)';

      status.style.borderRadius =
        '5px';

      status.style.background =
        'rgba(7,12,8,.88)';

      status.style.color =
        '#aebbb1';

      status.style.font =
        '9px ui-monospace, monospace';

      status.style.pointerEvents =
        'none';


      const mapElement =
        document.getElementById(
          'map'
        );

      if (mapElement) {
        mapElement.appendChild(
          status
        );
      }
    }


    status.textContent =
      text;
  }


  /* =========================================================
     ТАЙМЛАЙН
     ========================================================= */

  function buildTimeline() {

    frameList =
      makeFrames();

    updateTimeline();
  }


  function updateTimeline() {

    const slider =
      document.getElementById(
        'mp-slider'
      );


    if (!slider) {
      return;
    }


    const index =
      frameList.indexOf(
        currentFrame
      );


    if (index >= 0) {

      slider.min =
        0;

      slider.max =
        frameList.length - 1;

      slider.value =
        index;
    }


    const labelIds = [
      'timeLabel',
      'mp-time',
      'time-label'
    ];


    labelIds.forEach(id => {

      const el =
        document.getElementById(id);

      if (!el) {
        return;
      }

      el.textContent =
        formatTime(
          currentFrame
        );
    });
  }


  /* =========================================================
     ПОДКЛЮЧЕНИЕ К СУЩЕСТВУЮЩЕМУ SLIDER
     ========================================================= */

  function connectExistingTimeline() {

    const slider =
      document.getElementById(
        'mp-slider'
      );


    if (!slider) {
      return;
    }


    if (
      slider.dataset.meteoinfoBound
    ) {
      return;
    }


    slider.dataset.meteoinfoBound =
      '1';


    slider.addEventListener(
      'input',
      () => {

        const index =
          Number(
            slider.value
          );


        if (
          !frameList[index]
        ) {
          return;
        }


        switchFrame(
          frameList[index]
        );
      }
    );
  }


  /* =========================================================
     АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ
     ========================================================= */

  function startAutoRefresh() {

    if (refreshTimer) {
      clearInterval(
        refreshTimer
      );
    }


    refreshTimer =
      setInterval(() => {

        const latest =
          floorTime(
            Date.now()
          );


        /*
          Обновляем только если
          появился новый 10-минутный кадр.
        */

        if (
          latest !== currentFrame &&
          radarEnabled
        ) {

          frameList =
            makeFrames();

          switchFrame(
            latest
          );

          updateTimeline();
        }

      }, CONFIG.refreshInterval);
  }


  /* =========================================================
     КНОПКА ОБНОВЛЕНИЯ
     ========================================================= */

  function connectRefreshButton() {

    const ids = [
      'btn-refresh',
      'refresh',
      'refreshBtn'
    ];


    ids.forEach(id => {

      const button =
        document.getElementById(id);

      if (!button) {
        return;
      }


      if (
        button.dataset.meteoinfoBound
      ) {
        return;
      }


      button.dataset.meteoinfoBound =
        '1';


      button.addEventListener(
        'click',
        () => {

          const latest =
            floorTime(
              Date.now()
            );


          frameList =
            makeFrames();


          switchFrame(
            latest
          );

        }
      );

    });
  }


  /* =========================================================
     ПОДКЛЮЧЕНИЕ
     ========================================================= */

  function init() {

    injectStyles();


    waitForMap(() => {

      /*
        Добавляем кнопку.
      */

      map.addControl(
        new MeteoinfoControl()
      );


      /*
        Начальный кадр.
      */

      currentFrame =
        floorTime(
          Date.now()
        );


      frameList =
        makeFrames();


      /*
        Первый слой.
      */

      radarLayer =
        createRadarLayer(
          currentFrame
        );


      radarLayer.addTo(
        map
      );


      /*
        Слой должен быть видимым.
      */

      radarLayer.setOpacity(
        CONFIG.opacity
      );


      /*
        Обновляем интерфейс.
      */

      updateStatus(
        currentFrame
      );

      updateButton();

      updateTimeline();

      connectExistingTimeline();

      connectRefreshButton();

      startAutoRefresh();


      console.log(
        '[Meteoinfo] DMRL module loaded.'
      );

      console.log(
        '[Meteoinfo] Current frame:',
        new Date(
          currentFrame
        ).toISOString()
      );

    });
  }


  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.MeteoinfoDMRL = {

    enable: () => {

      if (!radarEnabled) {
        toggleRadar();
      }

    },


    disable: () => {

      if (radarEnabled) {
        toggleRadar();
      }

    },


    toggle: toggleRadar,


    refresh: () => {

      const latest =
        floorTime(
          Date.now()
        );

      frameList =
        makeFrames();

      switchFrame(
        latest
      );

    },


    setFrame: (
      timestamp
    ) => {

      switchFrame(
        floorTime(
          timestamp
        )
      );

    },


    getFrame: () =>
      currentFrame,


    getFrames: () =>
      frameList.slice()

  };


  /* =========================================================
     ЗАПУСК
     ========================================================= */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init
    );

  } else {

    init();

  }

})();
