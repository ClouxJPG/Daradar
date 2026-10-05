/* =========================================================
   CLOrad — Meteoinfo DMRL
   Кнопка гарантированно находится ПОВЕРХ карты

   Файл: Meteoinfo.js
   ========================================================= */

(() => {
  'use strict';

  const CONFIG = {
    tileUrl:
      'https://meteoinfo.ru/res/nowcast/{z}0{x}0{y}/ncgi.php' +
      '?tnz={z}&tnx={x}&tny={y}' +
      '&layers=1' +
      '&inidt={time}',

    frameStep: 10 * 60 * 1000,
    opacity: 0.88,

    bounds: [
      [42.0776, 18.6794],
      [68.2286, 62.6090]
    ],

    minZoom: 4,
    maxZoom: 11,
    minNativeZoom: 5,
    maxNativeZoom: 8
  };


  /* =========================================================
     ЖДЁМ КАРТУ
     ========================================================= */

  function start() {

    const mapElement =
      document.getElementById('map');

    if (!mapElement) {
      console.error(
        '[Meteoinfo] Не найден #map'
      );
      return;
    }


    /*
      Leaflet-карта уже должна существовать.
      Ищем её через известную переменную.
    */

    let map = window.map;

    if (!(map instanceof L.Map)) {

      /*
        Проверяем CLOrad-переменную.
      */

      if (
        window.cloradMap instanceof L.Map
      ) {
        map = window.cloradMap;
      }
    }


    if (!(map instanceof L.Map)) {

      setTimeout(
        start,
        300
      );

      return;
    }


    init(map);
  }


  /* =========================================================
     ОСНОВНОЙ ЗАПУСК
     ========================================================= */

  function init(map) {

    /*
      Чтобы модуль не создал всё дважды.
    */

    if (
      document.getElementById(
        'clorad-meteoinfo-button'
      )
    ) {
      return;
    }


    let enabled = true;

    let currentTime =
      Math.floor(
        Date.now() / CONFIG.frameStep
      ) * CONFIG.frameStep;


    let radarLayer = null;

    let newRadarLayer = null;


    /* =======================================================
       CSS
       ======================================================= */

    const style =
      document.createElement('style');

    style.id =
      'clorad-meteoinfo-style';


    style.textContent = `

      /*
        КОНТЕЙНЕР КНОПКИ

        Он находится непосредственно внутри #map.
      */

      #clorad-meteoinfo-button {

        position: absolute;

        top: 12px;
        left: 55px;

        z-index: 999999;

        display: flex;

        align-items: center;
        justify-content: center;

        gap: 7px;

        height: 38px;

        padding: 0 13px;

        border: 1px solid
          rgba(100,170,115,.65);

        border-radius: 7px;

        background:
          rgba(8,17,10,.96);

        color:
          #e9ffed;

        font-family:
          Arial,
          sans-serif;

        font-size: 11px;

        font-weight: 600;

        letter-spacing: .2px;

        box-shadow:
          0 2px 10px
          rgba(0,0,0,.55);

        cursor: pointer;

        user-select: none;

        -webkit-user-select: none;

        -webkit-tap-highlight-color:
          transparent;

        touch-action: manipulation;

      }


      #clorad-meteoinfo-button:hover {

        background:
          rgba(20,55,27,.98);

      }


      #clorad-meteoinfo-button.off {

        background:
          rgba(20,20,20,.96);

        border-color:
          rgba(130,130,130,.45);

        color:
          #999;

      }


      #clorad-meteoinfo-dot {

        width: 8px;
        height: 8px;

        flex: 0 0 8px;

        border-radius: 50%;

        background:
          #55dc78;

        box-shadow:
          0 0 7px
          rgba(85,220,120,.8);

      }


      #clorad-meteoinfo-button.off
      #clorad-meteoinfo-dot {

        background:
          #777;

        box-shadow:
          none;

      }


      /*
        На телефоне кнопка становится
        немного компактнее, но НЕ исчезает.
      */

      @media (max-width: 640px) {

        #clorad-meteoinfo-button {

          top: 10px;
          left: 52px;

          height: 36px;

          padding:
            0 9px;

          font-size:
            9px;

        }

      }

    `;


    document.head.appendChild(
      style
    );


    /* =======================================================
       КНОПКА
       ======================================================= */

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
        Метеоинфо ДМРЛ
      </span>

    `;


    button.title =
      'Включить / выключить радарные наблюдения Meteoinfo';


    /*
      ВАЖНО:
      кнопка вставляется прямо в #map.
    */

    mapElement.appendChild(
      button
    );


    /* =======================================================
       СОЗДАНИЕ RADAR GRID
       ======================================================= */

    const RadarGrid =
      L.GridLayer.extend({

        initialize:
          function(timestamp) {

            this.timestamp =
              timestamp;

            L.GridLayer.prototype.initialize
              .call(
                this,
                {

                  tileSize: 256,

                  minZoom:
                    CONFIG.minZoom,

                  maxZoom:
                    CONFIG.maxZoom,

                  minNativeZoom:
                    CONFIG.minNativeZoom,

                  maxNativeZoom:
                    CONFIG.maxNativeZoom,

                  opacity:
                    CONFIG.opacity,

                  zIndex:
                    500,

                  updateWhenZooming:
                    false,

                  updateWhenIdle:
                    true,

                  keepBuffer:
                    2,

                  bounds:
                    L.latLngBounds(
                      CONFIG.bounds
                    )

                }
              );
          },


        createTile:
          function(coords, done) {

            const canvas =
              document.createElement(
                'canvas'
              );


            canvas.width =
              256;

            canvas.height =
              256;


            const img =
              new Image();


            img.crossOrigin =
              'anonymous';


            let finished =
              false;


            const finish =
              (error = null) => {

                if (finished) {
                  return;
                }

                finished = true;

                done(
                  error,
                  canvas
                );
              };


            /*
              Переворачиваем Y
              для Meteoinfo.
            */

            const n =
              Math.pow(
                2,
                coords.z
              );


            const tny =
              (n - 1) -
              coords.y;


            const url =
              CONFIG.tileUrl
                .replace(
                  '{z}',
                  coords.z
                )
                .replace(
                  '{x}',
                  coords.x
                )
                .replace(
                  '{y}',
                  tny
                )
                .replace(
                  '{time}',
                  this.timestamp
                );


            img.onload =
              () => {

                try {

                  const ctx =
                    canvas.getContext(
                      '2d'
                    );

                  ctx.drawImage(
                    img,
                    0,
                    0,
                    256,
                    256
                  );

                } catch (e) {}

                finish();
              };


            img.onerror =
              () => finish();


            img.src =
              url;


            setTimeout(
              () => finish(),
              15000
            );


            return canvas;
          }

      });


    /* =======================================================
       ПЕРВЫЙ РАДАРНЫЙ СЛОЙ
       ======================================================= */

    radarLayer =
      new RadarGrid(
        currentTime
      );


    radarLayer.addTo(
      map
    );


    /* =======================================================
       ПЕРЕКЛЮЧЕНИЕ КАДРА
       ======================================================= */

    function setFrame(timestamp) {

      if (!enabled) {
        return;
      }


      if (
        radarLayer &&
        radarLayer.timestamp === timestamp
      ) {
        return;
      }


      const layer =
        new RadarGrid(
          timestamp
        );


      newRadarLayer =
        layer;


      /*
        Новый слой появляется ПОВЕРХ
        старого.

        Старый не исчезает.
      */

      layer.addTo(
        map
      );


      let swapped =
        false;


      const swap =
        () => {

          if (swapped) {
            return;
          }

          swapped = true;


          /*
            Убираем старый только
            после появления нового.
          */

          if (
            radarLayer &&
            map.hasLayer(
              radarLayer
            )
          ) {

            map.removeLayer(
              radarLayer
            );
          }


          radarLayer =
            layer;


          newRadarLayer =
            null;


          currentTime =
            timestamp;

        };


      layer.once(
        'load',
        swap
      );


      /*
        Если сервер очень медленный —
        даём максимум 15 секунд.
      */

      setTimeout(
        () => {

          if (!swapped) {

            /*
              Если есть загруженные
              тайлы — меняем слой.
            */

            if (
              layer._tiles &&
              Object.keys(
                layer._tiles
              ).length > 0
            ) {

              swap();

            }

          }

        },
        15000
      );

    }


    /* =======================================================
       КНОПКА ВКЛ / ВЫКЛ
       ======================================================= */

    button.addEventListener(
      'click',
      function(e) {

        e.preventDefault();
        e.stopPropagation();


        enabled =
          !enabled;


        if (enabled) {

          button.classList.remove(
            'off'
          );


          if (radarLayer) {

            radarLayer.setOpacity(
              CONFIG.opacity
            );

          } else {

            radarLayer =
              new RadarGrid(
                currentTime
              );

            radarLayer.addTo(
              map
            );

          }

        } else {

          button.classList.add(
            'off'
          );


          if (radarLayer) {

            radarLayer.setOpacity(
              0
            );

          }

        }

      }
    );


    /* =======================================================
       ОБНОВЛЕНИЕ КАЖДУЮ МИНУТУ
       ======================================================= */

    setInterval(
      () => {

        if (!enabled) {
          return;
        }


        const latest =
          Math.floor(
            Date.now() /
            CONFIG.frameStep
          ) *
          CONFIG.frameStep;


        if (
          latest !== currentTime
        ) {

          setFrame(
            latest
          );

        }

      },
      60000
    );


    /* =======================================================
       PUBLIC API
       ======================================================= */

    window.MeteoinfoDMRL = {

      enable() {

        if (!enabled) {
          button.click();
        }

      },


      disable() {

        if (enabled) {
          button.click();
        }

      },


      toggle() {

        button.click();

      },


      refresh() {

        const latest =
          Math.floor(
            Date.now() /
            CONFIG.frameStep
          ) *
          CONFIG.frameStep;

        setFrame(
          latest
        );

      },


      setFrame(timestamp) {

        setFrame(
          Math.floor(
            timestamp /
            CONFIG.frameStep
          ) *
          CONFIG.frameStep
        );

      }

    };


    console.log(
      '[Meteoinfo] DMRL подключён.'
    );

  }


  /* =========================================================
     ЗАПУСК
     ========================================================= */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      start
    );

  } else {

    start();

  }

})();
