/* =========================================================
   CLOrad — Meteoinfo DMRL Radar
   Реальные радарные наблюдения Meteoinfo

   ГЛАВНОЕ:
   - GIF НЕ ИСПОЛЬЗУЕТСЯ
   - источник: Meteoinfo radar tiles
   - старый кадр остаётся видимым во время загрузки нового
   - opacity НИКОГДА не меняется при смене кадра
   - никаких fade / transition
   - двойная буферизация кадров
   - RainRadar НЕ ЗАТРАГИВАЕТСЯ
   ========================================================= */

(() => {
  'use strict';

  /* =========================================================
     НАСТРОЙКИ
     ========================================================= */

  const META = {
    name: 'Meteoinfo ДМРЛ',
    opacity: 0.88,

    // Шаг радарных кадров Meteoinfo
    frameStep: 10 * 60 * 1000,

    // Проверяем новый кадр раз в минуту
    refreshInterval: 60 * 1000,

    // Максимальное количество одновременно
    // загружаемых тайлов
    keepBuffer: 2,

    // Россия / европейская часть + немного запасной территории
    bounds: [
      [35, 15],
      [72, 180]
    ],

    minZoom: 4,
    maxZoom: 11,
    minNativeZoom: 5,
    maxNativeZoom: 8,

    tileSize: 256
  };


  /* =========================================================
     СОСТОЯНИЕ
     ========================================================= */

  let currentTime = null;
  let currentLayer = null;

  // Предзагружаемый следующий слой
  let loadingLayer = null;

  let refreshTimer = null;
  let initialized = false;

  let enabled = true;


  /* =========================================================
     ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     ========================================================= */

  function roundRadarTime(time) {
    return Math.floor(time / META.frameStep) * META.frameStep;
  }


  function timestamp(time) {
    return Math.floor(time / 1000);
  }


  /*
     Meteoinfo использует перевёрнутую Y-сетку.
  */
  function radarY(coords) {
    return (Math.pow(2, coords.z) - 1) - coords.y;
  }


  /*
     URL конкретной тайлы.

     Это тот же backend Meteoinfo, который используется
     текущим frontend:
     
     /res/nowcast/{z}0{x}0{y}/ncgi.php
  */
  function tileURL(coords, time) {
    const z = coords.z;
    const x = coords.x;
    const y = radarY(coords);

    return (
      'https://meteoinfo.ru/res/nowcast/' +
      z + '0' + x + '0' + y +
      '/ncgi.php' +
      '?tnz=' + z +
      '&tnx=' + x +
      '&tny=' + y +
      '&layers=1' +
      '&inidt=' + timestamp(time)
    );
  }


  /* =========================================================
     РАДАРНЫЙ GRID LAYER
     ========================================================= */

  const MeteoinfoGrid = L.GridLayer.extend({

    createTile(coords, done) {

      const canvas = document.createElement('canvas');

      canvas.width = META.tileSize;
      canvas.height = META.tileSize;

      canvas.style.display = 'block';

      const ctx = canvas.getContext('2d');

      const img = new Image();

      /*
         Нам нужен именно сам радарный растр.
         Никакого удаления "серых" пикселей здесь нет:
         прежний фильтр мог удалять реальные слабые
         радарные значения.
      */
      img.crossOrigin = 'anonymous';

      let finished = false;

      function finish(err) {
        if (finished) return;

        finished = true;

        if (err) {
          done(err, canvas);
        } else {
          done(null, canvas);
        }
      }


      img.onload = () => {

        try {

          ctx.clearRect(
            0,
            0,
            META.tileSize,
            META.tileSize
          );

          ctx.drawImage(
            img,
            0,
            0,
            META.tileSize,
            META.tileSize
          );

        } catch (e) {
          finish(e);
          return;
        }

        finish(null);
      };


      img.onerror = () => {
        finish(new Error('Meteoinfo tile load error'));
      };


      img.src = tileURL(
        coords,
        this._radarTime
      );


      /*
         Защита от зависшей тайлы.
         Сам canvas всё равно возвращается Leaflet,
         поэтому карта не ломается.
      */
      setTimeout(() => {
        if (!finished) {
          finish(null);
        }
      }, 15000);


      return canvas;
    }
  });


  /* =========================================================
     СОЗДАНИЕ СЛОЯ
     ========================================================= */

  function createLayer(time) {

    const layer = new MeteoinfoGrid({

      tileSize: META.tileSize,

      minZoom: META.minZoom,
      maxZoom: META.maxZoom,

      minNativeZoom: META.minNativeZoom,
      maxNativeZoom: META.maxNativeZoom,

      bounds: L.latLngBounds(
        META.bounds
      ),

      opacity: META.opacity,

      zIndex: 410,

      updateWhenZooming: false,
      updateWhenIdle: true,

      keepBuffer: META.keepBuffer,

      noWrap: false,

      // ВАЖНО:
      // никаких CSS transitions
      className: 'clorad-meteoinfo-radar'
    });

    layer._radarTime = time;

    return layer;
  }


  /* =========================================================
     СТИЛИ
     ========================================================= */

  function injectStyle() {

    if (document.getElementById(
      'clorad-meteoinfo-style'
    )) {
      return;
    }

    const style = document.createElement('style');

    style.id = 'clorad-meteoinfo-style';

    style.textContent = `
      .clorad-meteoinfo-radar {
        transition: none !important;
        animation: none !important;
      }

      .clorad-meteoinfo-radar canvas {
        transition: none !important;
        animation: none !important;
      }
    `;

    document.head.appendChild(style);
  }


  /* =========================================================
     ПОЛУЧЕНИЕ ПРЕДПОЛАГАЕМОГО ТЕКУЩЕГО КАДРА
     ========================================================= */

  async function getCurrentTime() {

    /*
       У Meteoinfo уже есть capabilities endpoint,
       который используется существующим frontend.
    */

    const url =
      'https://meteoinfo.ru/hmc-output/nowcast3/nowcast.php' +
      '?_=' + Date.now();

    try {

      const response = await fetch(
        url,
        {
          cache: 'no-store'
        }
      );

      if (!response.ok) {
        throw new Error(
          'HTTP ' + response.status
        );
      }

      const text = await response.text();

      /*
         Ищем:
         default="..."
      */
      const match =
        text.match(/default="([^"]+)"/i);

      if (match) {

        const parsed =
          Date.parse(match[1]);

        if (
          Number.isFinite(parsed)
        ) {
          return roundRadarTime(parsed);
        }
      }

    } catch (error) {

      console.warn(
        '[CLOrad Meteoinfo] capabilities:',
        error
      );
    }

    /*
       Если capabilities недоступен,
       используем локальное время.
    */
    return roundRadarTime(
      Date.now()
    );
  }


  /* =========================================================
     ПЕРВИЧНАЯ ЗАГРУЗКА
     ========================================================= */

  async function init() {

    if (initialized) return;

    initialized = true;

    injectStyle();

    currentTime =
      await getCurrentTime();

    currentLayer =
      createLayer(currentTime);

    /*
       ВАЖНО:
       opacity сразу фиксированная.
       Мы никогда не ставим её в 0.
    */
    currentLayer.setOpacity(
      META.opacity
    );

    currentLayer.addTo(map);

    console.log(
      '[CLOrad Meteoinfo] loaded:',
      new Date(currentTime)
    );

    scheduleRefresh();
  }


  /* =========================================================
     ПРЕДЗАГРУЗКА НОВОГО КАДРА
     ========================================================= */

  async function loadNewFrame(time) {

    if (!map) return;

    if (!enabled) return;

    if (
      currentTime === time
    ) {
      return;
    }


    /*
       Если такой кадр уже загружается,
       повторно его не создаём.
    */
    if (
      loadingLayer &&
      loadingLayer._radarTime === time
    ) {
      return;
    }


    /*
       Убираем старый незавершённый buffer.
       Текущий слой НЕ трогаем.
    */
    if (loadingLayer) {

      try {
        map.removeLayer(
          loadingLayer
        );
      } catch (_) {}

      loadingLayer = null;
    }


    /*
       Создаём новый слой.

       Он НЕ заменяет текущий.
       Текущий продолжает показываться.
    */
    const nextLayer =
      createLayer(time);

    loadingLayer =
      nextLayer;


    /*
       Фиксируем opacity.
       Она точно такая же, как у старого слоя.
    */
    nextLayer.setOpacity(
      META.opacity
    );


    /*
       Добавляем новый слой поверх старого.
       Оба слоя имеют одинаковую opacity.
    */
    nextLayer.addTo(map);


    /*
       Leaflet начинает запрашивать тайлы.
       Ждём завершения загрузки.
    */

    await waitForLayerReady(
      nextLayer
    );


    /*
       Если за время загрузки появился
       ещё более новый кадр — этот кадр
       уже не нужен.
    */
    if (
      loadingLayer !== nextLayer
    ) {
      try {
        map.removeLayer(
          nextLayer
        );
      } catch (_) {}

      return;
    }


    /*
       ТЕПЕРЬ swap.

       Старый кадр убирается только после
       того, как новый подготовлен.
    */

    const oldLayer =
      currentLayer;

    currentLayer =
      nextLayer;

    currentTime =
      time;

    loadingLayer =
      null;


    /*
       Оба слоя уже имеют одинаковую opacity.
       Никакого fade.
    */

    if (oldLayer) {

      try {
        map.removeLayer(
          oldLayer
        );
      } catch (_) {}
    }


    console.log(
      '[CLOrad Meteoinfo] frame:',
      new Date(time)
    );
  }


  /* =========================================================
     ОЖИДАНИЕ ЗАГРУЗКИ ТАЙЛОВ
     ========================================================= */

  function waitForLayerReady(layer) {

    return new Promise(resolve => {

      let finished = false;

      function done() {

        if (finished) return;

        finished = true;

        clearTimeout(timeout);

        resolve();
      }


      /*
         Если тайлы уже появились
         после первого цикла Leaflet.
      */
      setTimeout(() => {

        const container =
          layer.getContainer &&
          layer.getContainer();

        if (container) {

          const tiles =
            container.querySelectorAll(
              'canvas'
            );

          if (tiles.length > 0) {
            done();
          }
        }

      }, 150);


      /*
         Дополнительная проверка.
      */
      const check =
        setInterval(() => {

          if (!map.hasLayer(layer)) {

            clearInterval(check);

            return;
          }


          const container =
            layer.getContainer &&
            layer.getContainer();

          if (!container) return;


          const tiles =
            container.querySelectorAll(
              'canvas'
            );


          /*
             Нам достаточно появления
             хотя бы одной отрисованной тайлы.
          */
          if (tiles.length > 0) {

            clearInterval(check);

            done();
          }

        }, 100);


      /*
         Не зависаем навечно.
      */
      const timeout =
        setTimeout(() => {

          clearInterval(check);

          done();

        }, 12000);
    });
  }


  /* =========================================================
     АВТООБНОВЛЕНИЕ
     ========================================================= */

  function scheduleRefresh() {

    clearTimeout(
      refreshTimer
    );

    refreshTimer =
      setTimeout(
        refreshFrame,
        META.refreshInterval
      );
  }


  async function refreshFrame() {

    try {

      const latest =
        await getCurrentTime();

      if (
        !currentTime ||
        latest > currentTime
      ) {

        await loadNewFrame(
          latest
        );
      }

    } catch (error) {

      console.warn(
        '[CLOrad Meteoinfo] refresh:',
        error
      );
    }

    scheduleRefresh();
  }


  /* =========================================================
     РУЧНАЯ СМЕНА КАДРА
     ========================================================= */

  async function setTime(time) {

    const t =
      roundRadarTime(
        Number(time)
      );

    if (
      !Number.isFinite(t)
    ) {
      return;
    }

    await loadNewFrame(t);
  }


  /* =========================================================
     ПЕРЕКЛЮЧАТЕЛЬ
     ========================================================= */

  function setEnabled(value) {

    enabled = !!value;

    if (!map) return;

    if (!enabled) {

      if (currentLayer) {
        map.removeLayer(
          currentLayer
        );
      }

      if (loadingLayer) {
        map.removeLayer(
          loadingLayer
        );
      }

      return;
    }


    if (currentLayer) {

      currentLayer.addTo(map);

    } else {

      init();
    }
  }


  /* =========================================================
     ПУБЛИЧНЫЙ API
     ========================================================= */

  window.CLOradMeteoinfo = {

    init,

    refresh: refreshFrame,

    setTime,

    setEnabled,

    getTime: () =>
      currentTime,

    getLayer: () =>
      currentLayer,

    enabled: () =>
      enabled
  };


  /* =========================================================
     АВТОЗАПУСК
     ========================================================= */

  function startWhenMapReady() {

    if (
      typeof L === 'undefined'
    ) {

      setTimeout(
        startWhenMapReady,
        100
      );

      return;
    }


    if (
      typeof map === 'undefined' ||
      !map
    ) {

      setTimeout(
        startWhenMapReady,
        100
      );

      return;
    }


    init();
  }


  startWhenMapReady();

})();
