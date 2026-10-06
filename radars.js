/* =========================================================
   QUANTUM METEO — RADARS.JS
   =========================================================

   РАДАРЫ ДМРЛ-С

   - 250 км основного радиуса
   - БЕЗ круга 125/150 км
   - БЕЗ Terrain / Terrarium
   - БЕЗ искусственных blind sectors
   - реальные координаты РЛС берутся из /radars,
     если API доступен
   - поддержка реальных blindSectors,
     если сервер их отдаёт
   - тёмная аккуратная карта покрытия
   - лёгкая работа на iPhone
   - index.html менять НЕ нужно

   Формат blindSectors от API:

   blindSectors: [
       {
           from: 210,
           to: 265,
           distance: 250
       }
   ]

   from/to — азимуты в градусах,
   distance — дальность сектора в км.

   ========================================================= */

(function () {

"use strict";


/* =========================================================
   НАСТРОЙКИ
   ========================================================= */

const CONFIG = {

    /* Основное радиолокационное покрытие */
    rangeKm: 250,

    /* Цвет покрытия */
    coverageColor: "#18283b",

    coverageBorder: "#31506e",

    /* Прозрачность покрытия */
    coverageOpacity: 0.16,

    /* Точка РЛС */
    radarColor: "#ffc247",

    radarBorder: "#101820",

    /* Лучи */
    rayColor: "#476985",

    rayOpacity: 0.24,

    rayWeight: 1,

    /* Реальная слепая зона */
    blindColor: "#07101b",

    blindBorder: "#20384d",

    blindOpacity: 0.72,

    /* Количество лучей */
    rayStep: 30

};


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let mapRef = null;

let rootLayer = null;

let coverageLayer = null;

let raysLayer = null;

let radarLayer = null;

let blindLayer = null;

let enabled = false;

let initialized = false;

let radarData = [];


/* =========================================================
   ПОЛУЧЕНИЕ КАРТЫ
   ========================================================= */

function getMap() {

    if (window.QM_MAP) {
        return window.QM_MAP;
    }

    try {

        if (typeof map !== "undefined" && map) {
            return map;
        }

    } catch (e) {}

    return null;
}


/* =========================================================
   API
   ========================================================= */

function getApiBase() {

    let api = "";

    try {
        api = localStorage.getItem("api") || "";
    } catch (e) {}

    return String(api).replace(/\/+$/, "");

}


/* =========================================================
   DISTANCE
   ========================================================= */

function destination(lat, lon, distanceKm, bearing) {

    const R = 6371;

    const d = distanceKm / R;

    const br =
        bearing * Math.PI / 180;

    const lat1 =
        lat * Math.PI / 180;

    const lon1 =
        lon * Math.PI / 180;

    const lat2 =
        Math.asin(
            Math.sin(lat1) * Math.cos(d) +
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
            lon2 * 180 / Math.PI + 540
        ) % 360 - 180

    ];

}


/* =========================================================
   ПРОВЕРКА РЛС
   ========================================================= */

function validRadar(r) {

    return !!(
        r &&
        Number.isFinite(+r.lat) &&
        Number.isFinite(+r.lon)
    );

}


/* =========================================================
   ЗАГРУЗКА РЕАЛЬНЫХ РЛС С API
   ========================================================= */

async function loadRadarData() {

    const api = getApiBase();

    if (!api) {
        return [];
    }

    const urls = [

        api + "/radars",

        api + "/api/radars"

    ];

    for (const url of urls) {

        try {

            const response =
                await fetch(
                    url,
                    {
                        cache: "no-store"
                    }
                );

            if (!response.ok) {
                continue;
            }

            const data =
                await response.json();

            if (Array.isArray(data)) {

                const result =
                    data.filter(validRadar);

                if (result.length) {
                    return result;
                }

            }

        } catch (e) {}

    }

    return [];

}


/* =========================================================
   РЕЗЕРВНЫЕ КООРДИНАТЫ
   =========================================================

   Используются только если API не ответил.

   Это НЕ маски и НЕ расчёт blind zones.
   ========================================================= */

const FALLBACK_RADARS = [

    ["Архангельск",64.54,40.54],
    ["Барабинск",55.35,78.35],
    ["Белгород",50.60,36.60],
    ["Брянск",53.25,34.37],
    ["Валдай",57.98,33.25],
    ["Великие Луки",56.34,30.52],
    ["Владивосток",43.12,131.89],
    ["Внуково",55.60,37.27],
    ["Воейково",59.94,30.68],
    ["Волгоград",48.71,44.51],
    ["Вологда",59.22,39.89],
    ["Ижевск",56.85,53.21],
    ["Казань",55.79,49.12],
    ["Киров",58.60,49.67],
    ["Кострома",57.77,40.93],
    ["Котлас",61.25,46.63],
    ["Краснодар",45.04,38.98],
    ["Курск",51.73,36.19],
    ["Минеральные Воды",44.22,43.14],
    ["Москва-Профсоюзная",55.67,37.55],
    ["Миллерово",48.92,40.40],
    ["Нижний Новгород",56.33,44.00],
    ["Новосибирск",55.03,82.92],
    ["Оренбург",51.77,55.10],
    ["Петрозаводск",61.79,34.36],
    ["Петропавловск-Камчатский",53.05,158.65],
    ["Самара",53.18,50.15],
    ["Смоленск",54.78,32.04],
    ["Ставрополь",45.04,41.97],
    ["Тамбов",52.72,41.45],
    ["Тула",54.19,37.62],
    ["Уфа",54.74,55.97],
    ["Шереметьево",55.97,37.41],
    ["Элиста",46.31,44.27]

].map(function (r, i) {

    return {

        id: "fallback-" + i,

        name: r[0],

        lat: r[1],

        lon: r[2]

    };

});


/* =========================================================
   СОЗДАНИЕ СЛОЁВ
   ========================================================= */

function createLayers() {

    if (!mapRef || !window.L) {
        return false;
    }

    rootLayer =
        L.layerGroup();

    coverageLayer =
        L.layerGroup();

    raysLayer =
        L.layerGroup();

    radarLayer =
        L.layerGroup();

    blindLayer =
        L.layerGroup();


    rootLayer.addLayer(
        coverageLayer
    );

    rootLayer.addLayer(
        raysLayer
    );

    rootLayer.addLayer(
        radarLayer
    );

    rootLayer.addLayer(
        blindLayer
    );


    return true;

}


/* =========================================================
   РИСОВАНИЕ 250 КМ
   ========================================================= */

function drawCoverage(radar) {

    const circle =
        L.circle(
            [
                +radar.lat,
                +radar.lon
            ],
            {

                radius:
                    (
                        +radar.range_km ||
                        CONFIG.rangeKm
                    ) * 1000,

                color:
                    CONFIG.coverageBorder,

                weight: 1,

                opacity: 0.65,

                fillColor:
                    CONFIG.coverageColor,

                fillOpacity:
                    CONFIG.coverageOpacity,

                interactive: false

            }
        );


    circle.addTo(
        coverageLayer
    );

}


/* =========================================================
   ЛУЧИ
   ========================================================= */

function drawRays(radar) {

    const lat =
        +radar.lat;

    const lon =
        +radar.lon;

    const range =
        +radar.range_km ||
        CONFIG.rangeKm;


    for (
        let bearing = 0;
        bearing < 360;
        bearing += CONFIG.rayStep
    ) {

        const end =
            destination(
                lat,
                lon,
                range,
                bearing
            );


        L.polyline(
            [
                [lat, lon],
                end
            ],
            {

                color:
                    CONFIG.rayColor,

                weight:
                    CONFIG.rayWeight,

                opacity:
                    CONFIG.rayOpacity,

                interactive: false

            }
        ).addTo(
            raysLayer
        );

    }

}


/* =========================================================
   ТОЧКА РЛС
   ========================================================= */

function drawRadar(radar) {

    const lat =
        +radar.lat;

    const lon =
        +radar.lon;


    const marker =
        L.circleMarker(
            [lat, lon],
            {

                radius: 5,

                color:
                    CONFIG.radarBorder,

                weight: 1.5,

                fillColor:
                    CONFIG.radarColor,

                fillOpacity: 1,

                interactive: true

            }
        );


    const title =
        radar.name ||
        radar.id ||
        "ДМРЛ-С";


    marker.bindTooltip(
        title,
        {
            direction: "top",
            offset: [0,-5],
            opacity: 0.95
        }
    );


    marker.addTo(
        radarLayer
    );

}


/* =========================================================
   РЕАЛЬНЫЕ СЛЕПЫЕ СЕКТОРА
   =========================================================

   ВАЖНО:

   Мы НЕ вычисляем их по DEM.

   Если сервер передаёт:

       blindSectors: [
           {
               from: 200,
               to: 260,
               distance: 250
           }
       ]

   тогда сектор будет показан.

   Если сервер ничего не передаёт —
   сектор НЕ рисуется.

   ========================================================= */

function drawBlindSector(
    radar,
    sector
) {

    if (!sector) {
        return;
    }


    let from =
        Number(sector.from);

    let to =
        Number(sector.to);


    if (
        !Number.isFinite(from) ||
        !Number.isFinite(to)
    ) {
        return;
    }


    const range =
        Number(
            sector.distance ||
            radar.range_km ||
            CONFIG.rangeKm
        );


    if (!Number.isFinite(range)) {
        return;
    }


    const points = [

        [
            +radar.lat,
            +radar.lon
        ]

    ];


    /*
       Поддерживаем переход
       через 360 градусов.
    */

    let a = from;

    let end = to;

    while (end < a) {
        end += 360;
    }


    /*
       Не делаем слишком много точек.
    */

    const step = 3;


    for (
        let angle = a;
        angle <= end;
        angle += step
    ) {

        points.push(
            destination(
                +radar.lat,
                +radar.lon,
                range,
                angle % 360
            )
        );

    }


    points.push(
        destination(
            +radar.lat,
            +radar.lon,
            range,
            end % 360
        )
    );


    points.push(
        [
            +radar.lat,
            +radar.lon
        ]
    );


    L.polygon(
        points,
        {

            color:
                CONFIG.blindBorder,

            weight: 1,

            opacity: 0.75,

            fillColor:
                CONFIG.blindColor,

            fillOpacity:
                CONFIG.blindOpacity,

            interactive: false

        }
    ).addTo(
        blindLayer
    );

}


/* =========================================================
   ОБРАБОТКА МАСОК
   ========================================================= */

function drawRealMasks(radar) {

    /*
       Поддерживаем несколько названий,
       чтобы API можно было расширить
       без изменения index.html.
    */

    const sectors =
        radar.blindSectors ||
        radar.blind ||
        radar.masks ||
        radar.sectors;


    if (!Array.isArray(sectors)) {
        return;
    }


    for (const sector of sectors) {

        drawBlindSector(
            radar,
            sector
        );

    }

}


/* =========================================================
   ПОЛНАЯ ОТРИСОВКА
   ========================================================= */

function render() {

    if (!mapRef) {
        return;
    }


    if (!rootLayer) {

        if (!createLayers()) {
            return;
        }

    }


    coverageLayer.clearLayers();

    raysLayer.clearLayers();

    radarLayer.clearLayers();

    blindLayer.clearLayers();


    for (const radar of radarData) {

        if (!validRadar(radar)) {
            continue;
        }


        drawCoverage(radar);

        drawRays(radar);

        drawRadar(radar);

        /*
           Только реальные данные,
           пришедшие от API.
        */

        drawRealMasks(radar);

    }

}


/* =========================================================
   ВКЛЮЧЕНИЕ
   ========================================================= */

function show() {

    mapRef =
        getMap();

    if (!mapRef) {
        return;
    }


    if (!rootLayer) {

        createLayers();

    }


    if (!mapRef.hasLayer(rootLayer)) {

        rootLayer.addTo(
            mapRef
        );

    }


    enabled = true;

}


/* =========================================================
   ВЫКЛЮЧЕНИЕ
   ========================================================= */

function hide() {

    if (
        mapRef &&
        rootLayer &&
        mapRef.hasLayer(rootLayer)
    ) {

        mapRef.removeLayer(
            rootLayer
        );

    }


    enabled = false;

}


/* =========================================================
   ПЕРЕКЛЮЧАТЕЛЬ
   ========================================================= */

function toggle(force) {

    if (force === true) {

        show();

        return;

    }


    if (force === false) {

        hide();

        return;

    }


    if (enabled) {

        hide();

    } else {

        show();

    }

}


/* =========================================================
   ПОИСК КНОПКИ ПОКРЫТИЯ
   ========================================================= */

function findCoverageButton() {

    return document.querySelector(
        '#lp .it[data-k="coverage"]'
    );

}


/* =========================================================
   СОСТОЯНИЕ КНОПКИ
   ========================================================= */

function updateButton() {

    const button =
        findCoverageButton();

    if (!button) {
        return;
    }


    if (enabled) {

        button.classList.remove(
            "off"
        );

    } else {

        button.classList.add(
            "off"
        );

    }

}


/* =========================================================
   CLICK
   ========================================================= */

function bindButton() {

    const button =
        findCoverageButton();

    if (!button) {
        return false;
    }


    if (
        button.dataset.qmRadarBound === "1"
    ) {

        return true;

    }


    button.dataset.qmRadarBound =
        "1";


    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();


            toggle();

            updateButton();

        },
        true
    );


    return true;

}


/* =========================================================
   ЗАГРУЗКА ДАННЫХ
   ========================================================= */

async function initData() {

    const remote =
        await loadRadarData();


    if (remote.length) {

        radarData =
            remote;

    } else {

        radarData =
            FALLBACK_RADARS;

    }


    render();

}


/* =========================================================
   INIT
   ========================================================= */

async function init() {

    if (initialized) {
        return;
    }


    initialized = true;


    mapRef =
        getMap();


    if (!mapRef) {

        setTimeout(
            init,
            300
        );

        return;

    }


    createLayers();


    /*
       Не включаем слой автоматически.
       Он появляется только при нажатии
       «РЛС и покрытие».
    */

    bindButton();

    updateButton();


    await initData();


    /*
       index.html может создать панель
       чуть позже. Поэтому проверяем
       кнопку ещё несколько раз.
    */

    let tries = 0;

    const timer =
        setInterval(
            function () {

                bindButton();

                updateButton();

                tries++;

                if (tries > 20) {

                    clearInterval(
                        timer
                    );

                }

            },
            250
        );


    /*
       Если пользователь двигает карту,
       ничего тяжёлого не пересчитываем.
       Все объекты географические.
    */

    mapRef.on(
        "zoomend",
        function () {

            if (enabled) {
                updateButton();
            }

        }
    );

}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.QM_RADARS = {

    show: show,

    hide: hide,

    toggle: toggle,

    render: render,

    reload: initData,

    getData: function () {

        return radarData.slice();

    }

};


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

} else {

    init();

}

})();
