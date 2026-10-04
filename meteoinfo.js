/* =========================================================
   CLOrad — Meteoinfo ДМРЛ
   Реальные радарные наблюдения Meteoinfo

   ВАЖНО:
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - RainRadar НЕ ЗАТРАГИВАЕТСЯ
   - GIF НЕ ИСПОЛЬЗУЕТСЯ
   - используется raster tile backend Meteoinfo
   - старый кадр остаётся видимым во время загрузки нового
   - opacity постоянная
   - НИКАКОГО fade
   - НИКАКОГО opacity = 0
   - при смене кадра выполняется swap после загрузки
   - кнопка создаётся автоматически
   ========================================================= */

(() => {
  'use strict';


  /* =========================================================
     НАСТРОЙКИ
     ========================================================= */

  const CONFIG = {

    name: 'ДМРЛ · Meteoinfo',

    opacity: 0.88,

    frameStep: 10 * 60 * 1000,

    refreshInterval: 60 * 1000,

    tileSize: 256,

    minZoom: 4,
    maxZoom: 11,

    minNativeZoom: 5,
    maxNativeZoom: 8,

    bounds: [
      [35, 15],
      [72, 180]
    ],

    zIndex: 410,

    /*
       Приблизительное время ожидания нового кадра.
       Старый кадр всё это время остаётся на карте.
    */
    frameTimeout: 15000
  };


  /* =========================================================
     СОСТОЯНИЕ
     ========================================================= */

  let currentLayer = null;
  let loadingLayer = null;

  let currentTime = null;

  let enabled = false;

  let refreshTimer = null;

  let initialized = false;

  let switching = false;


  /* =========================================================
     ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     ========================================================= */

  function roundRadarTime(time) {

    return Math.floor(
      Number(time) / CONFIG.frameStep
    ) * CONFIG.frameStep;
  }


  function getUnixSeconds(time) {

    return Math.floor(
      Number(time) / 1000
    );
  }


  /*
     Meteoinfo использует перевёрнутую Y-координату
     в данном tile backend.
  */
  function radarY(coords) {

    return (
      Math.pow(2, coords.z) -
      1 -
      coords.y
    );
  }


  function formatTime(time) {

    if (!time) {
      return '--:--';
    }

    const d = new Date(time);

    const hh = String(
      d.getUTCHours()
    ).padStart(2, '0');

    const mm = String(
      d.getUTCMinutes()
    ).padStart(2, '0');

    return `${hh}:${mm} UTC`;
  }


  /* =========================================================
     URL METEOINFO
     ========================================================= */

  function getTileURL(coords, time) {

    const z = coords.z;

    const x = coords.x;

    const y = radarY(coords);

    const inidt =
      getUnixSeconds(time);


    return (
      'https://meteoinfo.ru/res/nowcast/' +

      z +
      '0' +
      x +
      '0' +
      y +

      '/ncgi.php' +

      '?tnz=' +
      encodeURIComponent(z) +

      '&tnx=' +
      encodeURIComponent(x) +

      '&tny=' +
      encodeURIComponent(y) +

      '&layers=1' +

      '&inidt=' +
      encodeURIComponent(inidt)
    );
  }


  /* =========================================================
     GRID LAYER
     ========================================================= */

  const MeteoinfoGrid =
    L.GridLayer.extend({

      createTile(coords, done) {

        const canvas =
          document.createElement('canvas');

        canvas.width =
          CONFIG.tileSize;

        canvas.height =
          CONFIG.tileSize;

        canvas.style.display =
          'block';

        const ctx =
          canvas.getContext('2d');


        const img =
          new Image();


        img.crossOrigin =
          'anonymous';


        let finished = false;


        function finish(error) {

          if (finished) {
            return;
          }

          finished = true;

          done(
            error || null,
            canvas
          );
        }


        img.onload = () => {

          try {

            ctx.clearRect(
              0,
              0,
              CONFIG.tileSize,
              CONFIG.tileSize
            );


            ctx.drawImage(
              img,
              0,
              0,
              CONFIG.tileSize,
              CONFIG.tileSize
            );


            finish(null);

          } catch (error) {

            finish(error);
          }
        };


        img.onerror = () => {

          finish(
            new Error(
              'Meteoinfo tile error'
            )
          );
        };


        img.src =
          getTileURL(
            coords,
            this._radarTime
          );


        /*
           Если сервер завис,
           Leaflet всё равно получит tile.
        */
        setTimeout(() => {

          if (!finished) {
            finish(null);
          }

        }, CONFIG.frameTimeout);


        return canvas;
      }
    });


  /* =========================================================
     СОЗДАНИЕ РАДАРНОГО СЛОЯ
     ========================================================= */

  function createLayer(time) {

    const layer =
      new MeteoinfoGrid({

        tileSize:
          CONFIG.tileSize,

        minZoom:
          CONFIG.minZoom,

        maxZoom:
          CONFIG.maxZoom,

        minNativeZoom:
          CONFIG.minNativeZoom,

        maxNativeZoom:
          CONFIG.maxNativeZoom,

        bounds:
          L.latLngBounds(
            CONFIG.bounds
          ),

        opacity:
          CONFIG.opacity,

        zIndex:
          CONFIG.zIndex,

        updateWhenZooming:
          false,

        updateWhenIdle:
          true,

        keepBuffer:
          2,

        noWrap:
          false,

        className:
          'clorad-meteoinfo-layer'
      });


    layer._radarTime =
      time;


    /*
       Сохраняем постоянную opacity.
    */
    layer.setOpacity(
      CONFIG.opacity
    );


    return layer;
  }


  /* =========================================================
     CSS
     ========================================================= */

  function injectStyles() {

    if (
      document.getElementById(
        'clorad-meteoinfo-style'
      )
    ) {
      return;
    }


    const style =
      document.createElement('style');


    style.id =
      'clorad-meteoinfo-style';


    style.textContent = `

      .clorad-meteoinfo-layer,
      .clorad-meteoinfo-layer canvas {

        transition:
          none !important;

        animation:
          none !important;
      }


      /* =====================================================
         КНОПКА METEOINFO
         ===================================================== */

      #clorad-meteoinfo-button {

        position: absolute;

        left: 12px;

        bottom: 12px;

        z-index: 10000;

        display: flex;

        align-items: center;

        gap: 8px;

        min-height: 40px;

        padding:
          0 13px;

        border:
          1px solid
          rgba(255,255,255,.14);

        border-radius:
          10px;

        background:
          rgba(13,16,22,.92);

        color:
          #ffffff;

        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        font-size:
          13px;

        font-weight:
          600;

        cursor:
          pointer;

        user-select:
          none;

        -webkit-user-select:
          none;

        box-shadow:
          0 4px 18px
          rgba(0,0,0,.35);

        backdrop-filter:
          blur(10px);

        -webkit-backdrop-filter:
          blur(10px);

        transition:
          background .15s ease,
          border-color .15s ease;
      }


      #clorad-meteoinfo-button:hover {

        background:
          rgba(25,29,38,.96);
      }


      #clorad-meteoinfo-button.active {

        border-color:
          rgba(70,160,255,.75);

        background:
          rgba(25,75,125,.94);
      }


      #clorad-meteoinfo-dot {

        width:
          8px;

        height:
          8px;

        border-radius:
          50%;

        background:
          #777;

        flex:
          0 0 auto;
      }


      #clorad-meteoinfo-button.active
      #clorad-meteoinfo-dot {

        background:
          #45a7ff;

        box-shadow:
          0 0 7px
          rgba(69,167,255,.8);
      }


      #clorad-meteoinfo-time {

        opacity:
          .65;

        font-size:
          11px;

        font-weight:
          500;
      }


      @media (max-width: 600px) {

        #clorad-meteoinfo-button {

          left: 10px;

          bottom: 10px;

          min-height: 38px;

          padding:
            0 11px;

          font-size:
            12px;
        }

        #clorad-meteoinfo-time {
          display: none;
        }
      }

    `;


    document.head.appendChild(
      style
    );
  }


  /* =========================================================
     СОЗДАНИЕ КНОПКИ
     ========================================================= */

  function createButton() {

    if (
      document.getElementById(
        'clorad-meteoinfo-button'
      )
    ) {
      return;
    }


    const mapElement =
      map.getContainer();


    /*
       Map должен быть position: relative,
       чтобы кнопка позиционировалась относительно карты.
    */

    const mapStyle =
      window.getComputedStyle(
        mapElement
      );


    if (
      mapStyle.position === 'static'
    ) {

      mapElement.style.position =
        'relative';
    }


    const button =
      document.createElement(
        'button'
      );


    button.id =
      'clorad-meteoinfo-button';


    button.type =
      'button';


    button.innerHTML = `

      <span
        id="clorad-meteoinfo-dot">
      </span>

      <span>
        ДМРЛ · Meteoinfo
      </span>

      <span
        id="clorad-meteoinfo-time">
        OFF
      </span>

    `;


    button.addEventListener(
      'click',
      () => {

        setEnabled(
          !enabled
        );

      }
    );


    mapElement.appendChild(
      button
    );


    updateButton();
  }


  /* =========================================================
     ОБНОВЛЕНИЕ КНОПКИ
     ========================================================= */

  function updateButton() {

    const button =
      document.getElementById(
        'clorad-meteoinfo-button'
      );


    if (!button) {
      return;
    }


    const dot =
      document.getElementById(
        'clorad-meteoinfo-dot'
      );


    const time =
      document.getElementById(
        'clorad-meteoinfo-time'
      );


    button.classList.toggle(
      'active',
      enabled
    );


    if (dot) {

      dot.title =
        enabled ?
        'Слой включён' :
        'Слой выключен';
    }


    if (time) {

      time.textContent =
        enabled && currentTime ?
        formatTime(currentTime) :
        'OFF';
    }
  }


  /* =========================================================
     ПОЛУЧЕНИЕ ВРЕМЕНИ METEOINFO
     ========================================================= */

  async function getCurrentTime() {

    const url =
      'https://meteoinfo.ru/hmc-output/nowcast3/nowcast.php' +
      '?_=' +
      Date.now();


    try {

      const response =
        await fetch(
          url,
          {
            cache:
              'no-store'
          }
        );


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );
      }


      const text =
        await response.text();


      /*
         Пример:

         default="2026-10-04T..."
      */

      const match =
        text.match(
          /default="([^"]+)"/i
        );


      if (match) {

        const parsed =
          Date.parse(
            match[1]
          );


        if (
          Number.isFinite(
            parsed
          )
        ) {

          return roundRadarTime(
            parsed
          );
        }
      }


    } catch (error) {

      console.warn(
        '[Meteoinfo] capabilities error:',
        error
      );
    }


    /*
       Запасной вариант:
       ближайшее 10-минутное время.
    */

    return roundRadarTime(
      Date.now()
    );
  }


  /* =========================================================
     ПРОВЕРКА ЗАГРУЗКИ СЛОЯ
     ========================================================= */

  function waitForLayer(layer) {

    return new Promise(
      resolve => {

        let resolved =
          false;


        const finish = () => {

          if (resolved) {
            return;
          }

          resolved =
            true;

          clearInterval(
            interval
          );

          clearTimeout(
            timeout
          );

          resolve();
        };


        /*
           Даём Leaflet время начать
           загрузку тайлов.
        */

        const interval =
          setInterval(() => {

            if (
              !map.hasLayer(
                layer
              )
            ) {

              finish();

              return;
            }


            const container =
              layer.getContainer &&
              layer.getContainer();


            if (!container) {
              return;
            }


            const canvases =
              container.querySelectorAll(
                'canvas'
              );


            /*
               Новый слой должен иметь хотя бы
               одну реально созданную tile.
            */

            if (
              canvases.length > 0
            ) {

              finish();
            }

          }, 100);


        /*
           Защита от вечного ожидания.
        */

        const timeout =
          setTimeout(
            finish,
            CONFIG.frameTimeout
          );
      }
    );
  }


  /* =========================================================
     ПЕРЕКЛЮЧЕНИЕ КАДРА
     ========================================================= */

  async function switchFrame(time) {

    if (!map) {
      return;
    }


    if (!enabled) {
      return;
    }


    const targetTime =
      roundRadarTime(
        time
      );


    if (
      currentTime ===
      targetTime
    ) {

      return;
    }


    /*
       Если уже загружается именно этот кадр,
       ничего не делаем.
    */

    if (
      loadingLayer &&
      loadingLayer._radarTime ===
      targetTime
    ) {

      return;
    }


    /*
       Если предыдущий preload ещё существует,
       удаляем только его.

       CURRENT LAYER НЕ ТРОГАЕМ.
    */

    if (loadingLayer) {

      try {

        map.removeLayer(
          loadingLayer
        );

      } catch (_) {}

      loadingLayer =
        null;
    }


    switching =
      true;


    /*
       Создаём новый слой.
    */

    const nextLayer =
      createLayer(
        targetTime
      );


    loadingLayer =
      nextLayer;


    /*
       Одинаковая opacity.
       Никаких 0 → 1.
    */

    nextLayer.setOpacity(
      CONFIG.opacity
    );


    /*
       Новый слой добавляется поверх старого.
    */

    nextLayer.addTo(
      map
    );


    /*
       Старый слой продолжает отображаться.
    */

    await waitForLayer(
      nextLayer
    );


    /*
       Пока новый слой грузился,
       пользователь мог запустить другой кадр.
    */

    if (
      loadingLayer !==
      nextLayer
    ) {

      try {

        map.removeLayer(
          nextLayer
        );

      } catch (_) {}

      switching =
        false;

      return;
    }


    /*
       SWAP
       =====================================================

       Только здесь старый слой удаляется.
    */

    const oldLayer =
      currentLayer;


    currentLayer =
      nextLayer;


    currentTime =
      targetTime;


    loadingLayer =
      null;


    /*
       У старого слоя opacity не меняем.
       У нового тоже не меняем.
    */


    if (oldLayer) {

      try {

        map.removeLayer(
          oldLayer
        );

      } catch (_) {}
    }


    switching =
      false;


    updateButton();


    console.log(
      '[CLOrad Meteoinfo] frame:',
      new Date(
        targetTime
      ).toISOString()
    );
  }


  /* =========================================================
     ВКЛЮЧЕНИЕ / ВЫКЛЮЧЕНИЕ
     ========================================================= */

  async function setEnabled(value) {

    enabled =
      Boolean(value);


    updateButton();


    if (!enabled) {

      /*
         Убираем только Meteoinfo.
         RainRadar не трогаем.
      */

      if (loadingLayer) {

        try {

          map.removeLayer(
            loadingLayer
          );

        } catch (_) {}

        loadingLayer =
          null;
      }


      if (currentLayer) {

        try {

          map.removeLayer(
            currentLayer
          );

        } catch (_) {}
      }


      return;
    }


    /*
       Первый запуск.
    */

    if (!currentLayer) {

      await initLayer();

      return;
    }


    currentLayer.addTo(
      map
    );


    updateButton();
  }


  /* =========================================================
     ИНИЦИАЛИЗАЦИЯ
     ========================================================= */

  async function initLayer() {

    if (!map) {
      return;
    }


    if (currentLayer) {
      return;
    }


    const time =
      await getCurrentTime();


    currentTime =
      time;


    const layer =
      createLayer(
        time
      );


    currentLayer =
      layer;


    /*
       Первый слой можно сразу добавить.
       Его opacity сразу CONFIG.opacity.
    */

    layer.addTo(
      map
    );


    updateButton();


    console.log(
      '[CLOrad Meteoinfo] initialized:',
      new Date(
        time
      ).toISOString()
    );
  }


  /* =========================================================
     АВТООБНОВЛЕНИЕ
     ========================================================= */

  async function refresh() {

    if (!enabled) {
      return;
    }


    if (switching) {
      return;
    }


    try {

      const latest =
        await getCurrentTime();


      /*
         Только новый кадр.
      */

      if (
        !currentTime ||
        latest >
        currentTime
      ) {

        await switchFrame(
          latest
        );
      }


    } catch (error) {

      console.warn(
        '[Meteoinfo] refresh error:',
        error
      );
    }


    scheduleRefresh();
  }


  function scheduleRefresh() {

    clearTimeout(
      refreshTimer
    );


    refreshTimer =
      setTimeout(
        refresh,
        CONFIG.refreshInterval
      );
  }


  /* =========================================================
     РУЧНАЯ УСТАНОВКА КАДРА
     ========================================================= */

  async function setTime(time) {

    if (!Number.isFinite(
      Number(time)
    )) {

      return;
    }


    await switchFrame(
      Number(time)
    );
  }


  /* =========================================================
     ПУБЛИЧНЫЙ API
     ========================================================= */

  window.CLOradMeteoinfo = {

    init: async () => {

      injectStyles();

      createButton();

      /*
         Кнопка появляется сразу,
         сам радар остаётся выключенным.
      */

      updateButton();

      if (enabled) {
        await initLayer();
      }

      scheduleRefresh();
    },


    enable: () =>
      setEnabled(true),


    disable: () =>
      setEnabled(false),


    toggle: () =>
      setEnabled(!enabled),


    refresh,


    setTime,


    getLayer: () =>
      currentLayer,


    getTime: () =>
      currentTime,


    isEnabled: () =>
      enabled
  };


  /* =========================================================
     ЗАПУСК
     ========================================================= */

  function start() {

    injectStyles();


    /*
       Ждём существующую Leaflet-карту.
       В твоём index.html она называется map.
    */

    if (
      typeof L === 'undefined' ||
      typeof map === 'undefined' ||
      !map
    ) {

      setTimeout(
        start,
        100
      );

      return;
    }


    createButton();


    /*
       По умолчанию слой выключен.
       Пользователь сам нажимает кнопку.
    */

    enabled =
      false;


    updateButton();


    scheduleRefresh();


    console.log(
      '[CLOrad Meteoinfo] ready'
    );
  }


  start();

})();
