/* =========================================================
   Quantum Meteo — radars.js
   РЛС + покрытие

   ВАЖНО:
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - источник РЛС: /radars
   - используются реальные rings, если сервер их отдаёт
   - если rings не распознаны — надёжный fallback 250 км
   - никаких DEM / Terrarium
   - никаких выдуманных слепых зон
   - никаких кругов 125/150 км
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     НАСТРОЙКИ
     ========================================================= */

  const RANGE_KM = 250;

  /* Покрытие */
  const COVER_COLOR = "#2478a8";
  const COVER_FILL_OPACITY = 0.16;
  const COVER_LINE_OPACITY = 0.55;

  /* РЛС */
  const RADAR_COLOR = "#075f91";
  const RADAR_SIZE = 7;

  /* Лучи */
  const RAY_COLOR = "#16628c";
  const RAY_OPACITY = 0.08;
  const RAY_WEIGHT = 1;

  const UPDATE_INTERVAL = 60000;

  /* =========================================================
     СОСТОЯНИЕ
     ========================================================= */

  let map = null;
  let layer = null;

  let enabled = false;
  let loading = false;

  let objects = [];
  let radarData = [];

  /* =========================================================
     MAP
     ========================================================= */

  function getMap() {
    return window.map || null;
  }

  /* =========================================================
     API
     ========================================================= */

  function getApi() {
    try {
      const value = localStorage.getItem("api");

      if (!value) {
        return "";
      }

      return value.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  function getRadarURL() {
    const api = getApi();

    /*
     * Если API задано:
     *
     * https://example.com
     * ->
     * https://example.com/radars
     */

    if (api) {
      return api + "/radars";
    }

    /*
     * Если API не задано,
     * пробуем текущий origin.
     */

    return "/radars";
  }

  /* =========================================================
     ЧИСЛА
     ========================================================= */

  function number(value) {
    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : null;
  }

  /* =========================================================
     КООРДИНАТЫ
     ========================================================= */

  function validLatLon(lat, lon) {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }

  /* =========================================================
     DISTANCE
     ========================================================= */

  function destination(
    lat,
    lon,
    bearing,
    distanceKm
  ) {
    const R = 6371;

    const br =
      bearing *
      Math.PI /
      180;

    const lat1 =
      lat *
      Math.PI /
      180;

    const lon1 =
      lon *
      Math.PI /
      180;

    const d =
      distanceKm /
      R;

    const lat2 =
      Math.asin(
        Math.sin(lat1) *
          Math.cos(d) +

        Math.cos(lat1) *
          Math.sin(d) *
          Math.cos(br)
      );

    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(br) *
          Math.sin(d) *
          Math.cos(lat1),

        Math.cos(d) -
          Math.sin(lat1) *
          Math.sin(lat2)
      );

    return [
      lat2 * 180 / Math.PI,

      (
        lon2 * 180 / Math.PI +
        540
      ) % 360 - 180
    ];
  }

  /* =========================================================
     250 KM КРУГ
     ========================================================= */

  function makeCircle(
    lat,
    lon,
    radiusKm
  ) {
    const result = [];

    for (
      let angle = 0;
      angle <= 360;
      angle += 3
    ) {
      result.push(
        destination(
          lat,
          lon,
          angle,
          radiusKm
        )
      );
    }

    return result;
  }

  /* =========================================================
     POINT
     ========================================================= */

  function normalizePoint(value) {

    /*
     * [lat, lon]
     */

    if (
      Array.isArray(value) &&
      value.length >= 2
    ) {
      const lat =
        number(value[0]);

      const lon =
        number(value[1]);

      if (
        validLatLon(
          lat,
          lon
        )
      ) {
        return [
          lat,
          lon
        ];
      }
    }

    /*
     * {lat, lon}
     */

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const lat =
        number(
          value.lat ??
          value.latitude
        );

      const lon =
        number(
          value.lon ??
          value.lng ??
          value.longitude
        );

      if (
        validLatLon(
          lat,
          lon
        )
      ) {
        return [
          lat,
          lon
        ];
      }
    }

    return null;
  }

  /* =========================================================
     GEOMETRY
     ========================================================= */

  function extractPolygons(
    value,
    result = []
  ) {
    if (value == null) {
      return result;
    }

    /*
     * Один объект с geometry
     */

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      if (value.geometry) {
        extractPolygons(
          value.geometry,
          result
        );
      }

      if (value.coordinates) {
        extractPolygons(
          value.coordinates,
          result
        );
      }

      if (value.points) {
        extractPolygons(
          value.points,
          result
        );
      }

      if (value.polygon) {
        extractPolygons(
          value.polygon,
          result
        );
      }

      if (value.polygons) {
        extractPolygons(
          value.polygons,
          result
        );
      }

      if (value.mask) {
        extractPolygons(
          value.mask,
          result
        );
      }

      if (value.masks) {
        extractPolygons(
          value.masks,
          result
        );
      }

      if (value.sector) {
        extractPolygons(
          value.sector,
          result
        );
      }

      if (value.sectors) {
        extractPolygons(
          value.sectors,
          result
        );
      }

      return result;
    }

    if (!Array.isArray(value)) {
      return result;
    }

    /*
     * [lat, lon]
     */

    const one =
      normalizePoint(value);

    if (one) {
      return result;
    }

    /*
     * [[lat,lon], ...]
     */

    if (
      value.length >= 3 &&
      value.every(
        item =>
          normalizePoint(item)
      )
    ) {
      result.push(
        value.map(
          normalizePoint
        )
      );

      return result;
    }

    /*
     * Вложенные полигоны
     */

    for (const item of value) {
      extractPolygons(
        item,
        result
      );
    }

    return result;
  }

  /* =========================================================
     RADII
     ========================================================= */

  function extractRadii(
    value,
    result = []
  ) {
    if (value == null) {
      return result;
    }

    /*
     * Число = радиус.
     */

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      if (
        value > 0 &&
        value <= 1000
      ) {
        result.push(value);
      }

      return result;
    }

    /*
     * Строковое число.
     */

    if (
      typeof value === "string"
    ) {
      const n =
        Number(value);

      if (
        Number.isFinite(n) &&
        n > 0 &&
        n <= 1000
      ) {
        result.push(n);
      }

      return result;
    }

    /*
     * Массив.
     */

    if (Array.isArray(value)) {

      /*
       * [lat, lon] — это координаты,
       * не радиус.
       */

      if (
        value.length === 2 &&
        number(value[0]) !== null &&
        number(value[1]) !== null &&
        Math.abs(
          Number(value[0])
        ) <= 90 &&
        Math.abs(
          Number(value[1])
        ) <= 180
      ) {
        return result;
      }

      for (
        const item of value
      ) {
        extractRadii(
          item,
          result
        );
      }

      return result;
    }

    /*
     * Объект.
     */

    if (
      typeof value === "object"
    ) {
      const keys = [
        "radius",
        "radius_km",
        "range",
        "range_km",
        "distance",
        "distance_km",
        "km"
      ];

      for (
        const key of keys
      ) {
        const n =
          number(value[key]);

        if (
          n !== null &&
          n > 0 &&
          n <= 1000
        ) {
          result.push(n);
        }
      }

      /*
       * Возможные контейнеры.
       */

      for (
        const key of [
          "rings",
          "ranges",
          "distances"
        ]
      ) {
        if (
          value[key] != null
        ) {
          extractRadii(
            value[key],
            result
          );
        }
      }
    }

    return result;
  }

  /* =========================================================
     РИСУЕМ POLYGON
     ========================================================= */

  function drawPolygon(
    points
  ) {
    if (
      !layer ||
      !points ||
      points.length < 3
    ) {
      return false;
    }

    const valid =
      points.every(
        p =>
          Array.isArray(p) &&
          p.length >= 2 &&
          validLatLon(
            Number(p[0]),
            Number(p[1])
          )
      );

    if (!valid) {
      return false;
    }

    const polygon =
      L.polygon(
        points,
        {
          color:
            COVER_COLOR,

          weight: 1,

          opacity:
            COVER_LINE_OPACITY,

          fillColor:
            COVER_COLOR,

          fillOpacity:
            COVER_FILL_OPACITY,

          interactive:
            false
        }
      );

    polygon.addTo(layer);

    objects.push(
      polygon
    );

    return true;
  }

  /* =========================================================
     РИСУЕМ CIRCLE
     ========================================================= */

  function drawCircle(
    radar,
    radiusKm,
    fill = true
  ) {
    if (
      !layer ||
      !validLatLon(
        radar.lat,
        radar.lon
      )
    ) {
      return false;
    }

    const circle =
      L.circle(
        [
          radar.lat,
          radar.lon
        ],
        {
          radius:
            radiusKm * 1000,

          color:
            COVER_COLOR,

          weight: 1,

          opacity:
            COVER_LINE_OPACITY,

          fillColor:
            COVER_COLOR,

          fillOpacity:
            fill
              ? COVER_FILL_OPACITY
              : 0,

          interactive:
            false
        }
      );

    circle.addTo(layer);

    objects.push(
      circle
    );

    return true;
  }

  /* =========================================================
     RINGS
     ========================================================= */

  function drawRings(
    radar
  ) {
    if (
      radar.rings == null
    ) {
      return false;
    }

    let drawn =
      false;

    /*
     * Сначала пробуем настоящую
     * геометрию.
     */

    const polygons =
      extractPolygons(
        radar.rings
      );

    for (
      const polygon of polygons
    ) {
      if (
        drawPolygon(
          polygon
        )
      ) {
        drawn = true;
      }
    }

    /*
     * Потом радиусы.
     */

    const radii =
      extractRadii(
        radar.rings
      );

    const unique =
      [
        ...new Set(
          radii.map(
            x =>
              Math.round(
                x * 10
              ) / 10
          )
        )
      ];

    for (
      const radius of unique
    ) {
      /*
       * Не рисуем 125/150 км.
       */

      if (
        radius === 125 ||
        radius === 150
      ) {
        continue;
      }

      if (
        drawCircle(
          radar,
          radius,
          false
        )
      ) {
        drawn = true;
      }
    }

    return drawn;
  }

  /* =========================================================
     FALLBACK
     ========================================================= */

  function drawFallback(
    radar
  ) {
    /*
     * Если сервер не дал
     * распознаваемую геометрию,
     * всегда показываем 250 км.
     *
     * Это гарантирует, что
     * переключатель не оставит
     * только точки и лучи.
     */

    drawCircle(
      radar,
      RANGE_KM,
      true
    );
  }

  /* =========================================================
     RAYS
     ========================================================= */

  function drawRays(
    radar
  ) {
    if (
      !layer
    ) {
      return;
    }

    for (
      let angle = 0;
      angle < 360;
      angle += 30
    ) {
      const end =
        destination(
          radar.lat,
          radar.lon,
          angle,
          RANGE_KM
        );

      const line =
        L.polyline(
          [
            [
              radar.lat,
              radar.lon
            ],

            end
          ],
          {
            color:
              RAY_COLOR,

            weight:
              RAY_WEIGHT,

            opacity:
              RAY_OPACITY,

            interactive:
              false
          }
        );

      line.addTo(layer);

      objects.push(
        line
      );
    }
  }

  /* =========================================================
     RADAR POINT
     ========================================================= */

  function drawRadarPoint(
    radar
  ) {
    const point =
      L.circleMarker(
        [
          radar.lat,
          radar.lon
        ],
        {
          radius:
            RADAR_SIZE,

          color:
            "#ffffff",

          weight: 2,

          opacity: 1,

          fillColor:
            RADAR_COLOR,

          fillOpacity: 1,

          interactive:
            false
        }
      );

    point.addTo(layer);

    objects.push(
      point
    );
  }

  /* =========================================================
     ONE RADAR
     ========================================================= */

  function drawRadar(
    radar
  ) {
    const lat =
      number(radar.lat);

    const lon =
      number(radar.lon);

    if (
      !validLatLon(
        lat,
        lon
      )
    ) {
      return;
    }

    const r = {
      ...radar,
      lat,
      lon
    };

    /*
     * Реальные rings.
     */

    let coverage =
      drawRings(r);

    /*
     * Если rings отсутствуют
     * или имеют неизвестный формат —
     * гарантированный 250 км.
     */

    if (!coverage) {
      drawFallback(r);
    }

    /*
     * Лучи.
     */

    drawRays(r);

    /*
     * Точка.
     */

    drawRadarPoint(r);
  }

  /* =========================================================
     CLEAR
     ========================================================= */

  function clearObjects() {
    for (
      const object of objects
    ) {
      try {
        object.remove();
      } catch {}
    }

    objects = [];
  }

  /* =========================================================
     LOAD
     ========================================================= */

  async function loadRadars() {

    if (loading) {
      return radarData;
    }

    loading = true;

    try {
      const url =
        getRadarURL();

      console.log(
        "Quantum Meteo: loading",
        url
      );

      const response =
        await fetch(
          url,
          {
            cache:
              "no-store"
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          "HTTP " +
          response.status
        );
      }

      const data =
        await response.json();

      if (
        !Array.isArray(data)
      ) {
        throw new Error(
          "/radars returned non-array"
        );
      }

      radarData =
        data.filter(
          radar =>
            radar &&
            validLatLon(
              number(radar.lat),
              number(radar.lon)
            )
        );

      console.log(
        "Quantum Meteo: РЛС:",
        radarData.length
      );

      return radarData;

    } catch (error) {

      console.error(
        "Quantum Meteo: /radars error:",
        error
      );

      radarData = [];

      return [];

    } finally {
      loading = false;
    }
  }

  /* =========================================================
     RENDER
     ========================================================= */

  async function render() {

    map =
      getMap();

    if (
      !map
    ) {
      return;
    }

    if (
      !layer
    ) {
      layer =
        L.layerGroup();
    }

    const radars =
      await loadRadars();

    /*
     * Убираем старую отрисовку
     * только после получения
     * новых данных.
     *
     * Это важно: при ошибке API
     * старая рабочая карта не исчезает.
     */

    if (
      !radars.length
    ) {
      console.warn(
        "Quantum Meteo: новых данных РЛС нет"
      );

      return;
    }

    clearObjects();

    for (
      const radar of radars
    ) {
      drawRadar(
        radar
      );
    }

    /*
     * Слой должен быть виден
     * только если включён.
     */

    if (
      enabled
    ) {
      if (
        !map.hasLayer(layer)
      ) {
        layer.addTo(map);
      }
    } else {
      if (
        map.hasLayer(layer)
      ) {
        layer.removeFrom(map);
      }
    }
  }

  /* =========================================================
     BUTTON
     ========================================================= */

  function bindButton() {

    const button =
      document.querySelector(
        '#lp .it[data-k="coverage"]'
      );

    if (
      !button
    ) {
      return false;
    }

    if (
      button.dataset.radarsBound === "1"
    ) {
      return true;
    }

    button.dataset.radarsBound =
      "1";

    button.addEventListener(
      "click",
      async () => {

        map =
          getMap();

        if (
          !map ||
          !layer
        ) {
          return;
        }

        enabled =
          !enabled;

        button.classList.toggle(
          "off",
          !enabled
        );

        if (
          enabled
        ) {

          /*
           * Сначала показываем слой.
           */

          layer.addTo(
            map
          );

          /*
           * Если данных ещё нет —
           * загружаем.
           */

          if (
            !objects.length
          ) {
            await render();
          }

        } else {

          layer.removeFrom(
            map
          );
        }
      }
    );

    return true;
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    map =
      getMap();

    if (
      !map
    ) {
      setTimeout(
        init,
        100
      );

      return;
    }

    layer =
      L.layerGroup();

    /*
     * Ждём появления панели.
     */

    let attempts = 0;

    const timer =
      setInterval(
        () => {

          attempts++;

          if (
            bindButton()
          ) {
            clearInterval(
              timer
            );
          }

          if (
            attempts >= 100
          ) {
            clearInterval(
              timer
            );
          }

        },
        100
      );

    /*
     * Загружаем заранее,
     * но слой пока скрыт.
     */

    render();

    /*
     * Обновление каждые 60 секунд.
     */

    setInterval(
      () => {

        if (
          enabled
        ) {
          render();
        }

      },
      UPDATE_INTERVAL
    );
  }

  /* =========================================================
     START
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }

})();
