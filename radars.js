/* =========================================================
   Quantum Meteo — radars.js
   РЛС + зоны покрытия + реальные rings из /radars

   ВАЖНО:
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - никаких DEM / Terrarium
   - никаких выдуманных слепых зон
   - никаких кругов 125/150 км
   - используется rings, которые отдаёт сервер
   - если rings отсутствуют — используется bounds/250 км
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     НАСТРОЙКИ
     ========================================================= */

  const RADAR_RANGE_KM = 250;

  // Цвет покрытия
  const COVER_FILL = "#2478a8";
  const COVER_FILL_OPACITY = 0.13;
  const COVER_LINE = "#16628c";
  const COVER_LINE_OPACITY = 0.42;

  // Точки РЛС
  const RADAR_COLOR = "#075f91";
  const RADAR_SIZE = 7;

  // Лучи — специально слабые
  const RAY_COLOR = "#16628c";
  const RAY_OPACITY = 0.12;
  const RAY_WEIGHT = 1;

  const UPDATE_INTERVAL = 60000;

  /* =========================================================
     СОСТОЯНИЕ
     ========================================================= */

  let radarLayer = null;
  let radarObjects = [];
  let enabled = false;
  let loading = false;

  /* =========================================================
     ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
     ========================================================= */

  function getMap() {
    return window.map || null;
  }

  function getApi() {
    try {
      const a = localStorage.getItem("api");
      return a ? a.replace(/\/+$/, "") : "";
    } catch {
      return "";
    }
  }

  function apiUrl(path) {
    const api = getApi();

    if (!api) {
      return path;
    }

    if (/^https?:\/\//i.test(api)) {
      return api + path;
    }

    return api + path;
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

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
     КИЛОМЕТРЫ -> ГЕОГРАФИЧЕСКИЕ КООРДИНАТЫ
     ========================================================= */

  function destination(lat, lon, bearingDeg, distanceKm) {
    const R = 6371;

    const br = bearingDeg * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;

    const d = distanceKm / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(br)
    );

    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(br) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) -
        Math.sin(lat1) * Math.sin(lat2)
      );

    return [
      lat2 * 180 / Math.PI,
      ((lon2 * 180 / Math.PI + 540) % 360) - 180
    ];
  }

  /* =========================================================
     РЕАЛЬНЫЙ КРУГ 250 КМ
     ========================================================= */

  function makeFallbackCircle(radar) {
    if (!validLatLon(radar.lat, radar.lon)) {
      return null;
    }

    const points = [];

    for (let a = 0; a <= 360; a += 4) {
      points.push(
        destination(
          radar.lat,
          radar.lon,
          a,
          Number(radar.range_km) || RADAR_RANGE_KM
        )
      );
    }

    return points;
  }

  /* =========================================================
     РАЗБОР RINGS
     
     Поддерживаются реальные варианты структуры:
     
     250
     [250, 200]
     {radius:250}
     {range:250}
     {km:250}
     [[lat,lon], ...]
     [{lat,lon}, ...]
     [[[lat,lon],...], ...]
     
     НИЧЕГО НЕ ГЕНЕРИРУЕМ,
     ЕСЛИ В RINGS ЕСТЬ ГЕОМЕТРИЯ.
     ========================================================= */

  function isPoint(v) {
    return (
      Array.isArray(v) &&
      v.length >= 2 &&
      num(v[0]) !== null &&
      num(v[1]) !== null &&
      Math.abs(Number(v[0])) <= 90 &&
      Math.abs(Number(v[1])) <= 180
    );
  }

  function isObjectPoint(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return false;
    }

    const lat = num(v.lat ?? v.latitude);
    const lon = num(v.lon ?? v.lng ?? v.longitude);

    return validLatLon(lat, lon);
  }

  function normalizePoint(v) {
    if (isPoint(v)) {
      return [Number(v[0]), Number(v[1])];
    }

    if (isObjectPoint(v)) {
      return [
        Number(v.lat ?? v.latitude),
        Number(v.lon ?? v.lng ?? v.longitude)
      ];
    }

    return null;
  }

  function extractGeometry(value, result = []) {
    if (!value) {
      return result;
    }

    /* Один объект-точка */
    const objectPoint = normalizePoint(value);

    if (objectPoint) {
      result.push([objectPoint]);
      return result;
    }

    /* Массив */
    if (Array.isArray(value)) {

      /* [lat,lon] */
      if (isPoint(value)) {
        result.push([
          [Number(value[0]), Number(value[1])]
        ]);
        return result;
      }

      /* [{lat,lon}, ...] или [[lat,lon], ...] */
      if (
        value.length &&
        value.every(v => normalizePoint(v))
      ) {
        result.push(
          value.map(v => normalizePoint(v))
        );
        return result;
      }

      /* Вложенная геометрия */
      for (const item of value) {
        extractGeometry(item, result);
      }

      return result;
    }

    /* Объект с geometry */
    if (typeof value === "object") {

      if (value.geometry) {
        extractGeometry(value.geometry, result);
      }

      if (value.coordinates) {
        extractGeometry(value.coordinates, result);
      }

      if (value.points) {
        extractGeometry(value.points, result);
      }

      if (value.polygon) {
        extractGeometry(value.polygon, result);
      }

      if (value.polygons) {
        extractGeometry(value.polygons, result);
      }

      if (value.sector) {
        extractGeometry(value.sector, result);
      }

      if (value.sectors) {
        extractGeometry(value.sectors, result);
      }

      if (value.mask) {
        extractGeometry(value.mask, result);
      }

      if (value.masks) {
        extractGeometry(value.masks, result);
      }
    }

    return result;
  }

  /* =========================================================
     ИЗВЛЕЧЕНИЕ РАДИУСОВ ИЗ RINGS
     ========================================================= */

  function radiusFromObject(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      return null;
    }

    const candidates = [
      v.radius,
      v.range,
      v.range_km,
      v.distance,
      v.km,
      v.radius_km
    ];

    for (const x of candidates) {
      const n = num(x);

      if (n !== null && n > 0 && n <= 1000) {
        return n;
      }
    }

    return null;
  }

  function extractRadii(rings) {
    const result = [];

    function walk(v) {
      if (v == null) {
        return;
      }

      if (typeof v === "number") {
        if (v > 0 && v <= 1000) {
          result.push(v);
        }
        return;
      }

      if (typeof v === "string") {
        const n = Number(v);

        if (Number.isFinite(n) && n > 0 && n <= 1000) {
          result.push(n);
        }

        return;
      }

      if (Array.isArray(v)) {

        /*
         * Координатная пара — это НЕ радиус.
         */
        if (isPoint(v)) {
          return;
        }

        for (const x of v) {
          walk(x);
        }

        return;
      }

      if (typeof v === "object") {

        const r = radiusFromObject(v);

        if (r !== null) {
          result.push(r);
        }

        /*
         * Не пытаемся интерпретировать координаты
         * как расстояния.
         */
        for (const key of [
          "rings",
          "ranges",
          "distances"
        ]) {
          if (v[key] != null) {
            walk(v[key]);
          }
        }
      }
    }

    walk(rings);

    return [...new Set(
      result.map(x => Math.round(x * 10) / 10)
    )];
  }

  /* =========================================================
     ОТРИСОВКА ГЕОМЕТРИИ ИЗ RINGS
     ========================================================= */

  function drawRingGeometry(radar, rings) {
    const map = getMap();

    if (!map || !rings) {
      return false;
    }

    const geometries = extractGeometry(rings);

    let drawn = false;

    for (const geometry of geometries) {

      if (!geometry || geometry.length < 3) {
        continue;
      }

      const valid = geometry.every(
        p => Array.isArray(p) &&
             p.length >= 2 &&
             validLatLon(
               Number(p[0]),
               Number(p[1])
             )
      );

      if (!valid) {
        continue;
      }

      const polygon = L.polygon(
        geometry,
        {
          stroke: true,
          color: COVER_LINE,
          weight: 1,
          opacity: COVER_LINE_OPACITY,
          fill: true,
          fillColor: COVER_FILL,
          fillOpacity: COVER_FILL_OPACITY,
          interactive: false
        }
      );

      polygon.addTo(radarLayer);

      radarObjects.push(polygon);

      drawn = true;
    }

    return drawn;
  }

  /* =========================================================
     КРУГИ ИЗ RINGS
     ========================================================= */

  function drawRadii(radar, rings) {
    const map = getMap();

    if (!map) {
      return false;
    }

    const radii = extractRadii(rings);

    if (!radii.length) {
      return false;
    }

    let drawn = false;

    /*
     * Рисуем только реальные rings.
     * Никаких 150/125 км.
     */
    for (const radius of radii) {

      const circle = L.circle(
        [radar.lat, radar.lon],
        {
          radius: radius * 1000,
          stroke: true,
          color: COVER_LINE,
          weight: 1,
          opacity: COVER_LINE_OPACITY,
          fill: false,
          interactive: false
        }
      );

      circle.addTo(radarLayer);

      radarObjects.push(circle);

      drawn = true;
    }

    return drawn;
  }

  /* =========================================================
     FALLBACK ПО BOUNDS
     ========================================================= */

  function drawBoundsFallback(radar) {
    const map = getMap();

    if (!map) {
      return;
    }

    /*
     * Если сервер дал bounds,
     * используем их как реальную область.
     */

    if (
      Array.isArray(radar.bounds) &&
      radar.bounds.length >= 4
    ) {

      const a = Number(radar.bounds[0]);
      const b = Number(radar.bounds[1]);
      const c = Number(radar.bounds[2]);
      const d = Number(radar.bounds[3]);

      if (
        validLatLon(a, b) &&
        validLatLon(c, d)
      ) {

        const rectangle = L.rectangle(
          [
            [a, b],
            [c, d]
          ],
          {
            stroke: true,
            color: COVER_LINE,
            weight: 1,
            opacity: 0.25,
            fill: true,
            fillColor: COVER_FILL,
            fillOpacity: 0.04,
            interactive: false
          }
        );

        rectangle.addTo(radarLayer);

        radarObjects.push(rectangle);

        return;
      }
    }

    /* Последний fallback — реальный номинальный радиус */
    const circlePoints = makeFallbackCircle(radar);

    if (!circlePoints) {
      return;
    }

    const polygon = L.polygon(
      circlePoints,
      {
        stroke: true,
        color: COVER_LINE,
        weight: 1,
        opacity: COVER_LINE_OPACITY,
        fill: true,
        fillColor: COVER_FILL,
        fillOpacity: COVER_FILL_OPACITY,
        interactive: false
      }
    );

    polygon.addTo(radarLayer);

    radarObjects.push(polygon);
  }

  /* =========================================================
     РАДИАЛЬНЫЕ ЛУЧИ
     ========================================================= */

  function drawRays(radar) {
    const map = getMap();

    if (!map) {
      return;
    }

    /*
     * Лучи нужны только визуально.
     * Они не являются слепыми зонами.
     */

    for (let angle = 0; angle < 360; angle += 30) {

      const p = destination(
        radar.lat,
        radar.lon,
        angle,
        RADAR_RANGE_KM
      );

      const line = L.polyline(
        [
          [radar.lat, radar.lon],
          p
        ],
        {
          color: RAY_COLOR,
          weight: RAY_WEIGHT,
          opacity: RAY_OPACITY,
          interactive: false
        }
      );

      line.addTo(radarLayer);

      radarObjects.push(line);
    }
  }

  /* =========================================================
     ТОЧКА РЛС
     ========================================================= */

  function drawRadarPoint(radar) {
    const map = getMap();

    if (!map) {
      return;
    }

    const point = L.circleMarker(
      [radar.lat, radar.lon],
      {
        radius: RADAR_SIZE,
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillColor: RADAR_COLOR,
        fillOpacity: 1,
        interactive: false
      }
    );

    point.addTo(radarLayer);

    radarObjects.push(point);
  }

  /* =========================================================
     ОЧИСТКА
     ========================================================= */

  function clearRadarObjects() {

    for (const object of radarObjects) {
      try {
        object.remove();
      } catch {}
    }

    radarObjects = [];
  }

  /* =========================================================
     ОТРИСОВКА ОДНОЙ РЛС
     ========================================================= */

  function drawRadar(radar) {

    if (
      !radar ||
      !validLatLon(
        Number(radar.lat),
        Number(radar.lon)
      )
    ) {
      return;
    }

    radar.lat = Number(radar.lat);
    radar.lon = Number(radar.lon);

    /*
     * Сначала реальные rings.
     */

    let hasCoverage = false;

    if (radar.rings != null) {

      hasCoverage =
        drawRingGeometry(
          radar,
          radar.rings
        );

      if (!hasCoverage) {
        hasCoverage =
          drawRadii(
            radar,
            radar.rings
          );
      }
    }

    /*
     * Если rings не дали геометрию —
     * используем bounds / номинальное покрытие.
     */

    if (!hasCoverage) {
      drawBoundsFallback(radar);
    }

    /*
     * Лучи и точка.
     */

    drawRays(radar);
    drawRadarPoint(radar);
  }

  /* =========================================================
     ЗАГРУЗКА РЛС
     ========================================================= */

  async function loadRadars() {

    if (loading) {
      return;
    }

    loading = true;

    try {

      const response = await fetch(
        apiUrl("/radars"),
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          "HTTP " + response.status
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error(
          "Ответ /radars не является массивом"
        );
      }

      return data.filter(
        radar =>
          radar &&
          validLatLon(
            Number(radar.lat),
            Number(radar.lon)
          )
      );

    } catch (error) {

      console.error(
        "Quantum Meteo radar error:",
        error
      );

      return [];

    } finally {
      loading = false;
    }
  }

  /* =========================================================
     РЕНДЕР
     ========================================================= */

  async function render() {

    const map = getMap();

    if (!map) {
      return;
    }

    if (!radarLayer) {
      radarLayer = L.layerGroup();
    }

    clearRadarObjects();

    const radars = await loadRadars();

    if (!radars.length) {
      console.warn(
        "Quantum Meteo: РЛС не получены"
      );
      return;
    }

    for (const radar of radars) {
      drawRadar(radar);
    }

    /*
     * Если слой был выключен — объекты не показываем.
     */

    if (!enabled) {
      try {
        radarLayer.removeFrom(map);
      } catch {}
    }

    console.log(
      "Quantum Meteo: загружено РЛС:",
      radars.length
    );
  }

  /* =========================================================
     ПЕРЕКЛЮЧАТЕЛЬ В СУЩЕСТВУЮЩЕЙ ПАНЕЛИ
     ========================================================= */

  function bindLayerButton() {

    const button =
      document.querySelector(
        '#lp .it[data-k="coverage"]'
      );

    if (!button) {
      return false;
    }

    /*
     * Не добавляем второй обработчик.
     */

    if (button.dataset.radarsBound === "1") {
      return true;
    }

    button.dataset.radarsBound = "1";

    button.addEventListener(
      "click",
      async () => {

        const map = getMap();

        if (!map || !radarLayer) {
          return;
        }

        enabled = !enabled;

        button.classList.toggle(
          "off",
          !enabled
        );

        if (enabled) {

          radarLayer.addTo(map);

          /*
           * Если данных ещё нет — загружаем.
           */

          if (!radarObjects.length) {
            await render();
          }

        } else {

          radarLayer.removeFrom(map);
        }
      }
    );

    return true;
  }

  /* =========================================================
     ИНИЦИАЛИЗАЦИЯ
     ========================================================= */

  function init() {

    const map = getMap();

    if (!map) {
      setTimeout(init, 100);
      return;
    }

    radarLayer = L.layerGroup();

    /*
     * Панель может появиться чуть позже.
     */

    let attempts = 0;

    const timer = setInterval(() => {

      attempts++;

      if (bindLayerButton()) {
        clearInterval(timer);
      }

      if (attempts > 100) {
        clearInterval(timer);
      }

    }, 100);

    /*
     * Первичная загрузка.
     * Сами объекты пока скрыты.
     */

    render();

    /*
     * Обновление координат/rings.
     */

    setInterval(
      () => {
        if (enabled) {
          render();
        }
      },
      UPDATE_INTERVAL
    );
  }

  /* =========================================================
     ЗАПУСК
     ========================================================= */

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
