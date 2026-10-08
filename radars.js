/* =========================================================
   Quantum Meteo — radars.js

   30 РЛС из предоставленного списка координат.
   Координаты используются РОВНО КАК ПЕРЕДАНЫ.

   index.html НЕ ИЗМЕНЯТЬ.

   - без PNG
   - без imageOverlay
   - без fetch / XHR
   - без API
   - без WMS
   - без Nowcast
   - точки привязаны непосредственно к Leaflet-карте
   - белый круг + чёрная обводка
   - чёрной точки внутри НЕТ
   - серое полупрозрачное покрытие
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       РАДАРЫ
       ===================================================== */

    const RADARS = [
        { name: "Санкт-Петербург (Пулково)", lat: 59.8064, lon: 30.2278 },
        { name: "Москва (Внуково)", lat: 55.5961, lon: 37.2675 },
        { name: "Москва (Крылатское)", lat: 55.7628, lon: 37.4083 },
        { name: "Москва (Шереметьево)", lat: 55.9736, lon: 37.4125 },

        { name: "Валдай (Новгородская обл.)", lat: 57.9744, lon: 33.2425 },

        { name: "Самара (Курумоч)", lat: 53.5132, lon: 50.1584 },
        { name: "Ростов-на-Дону", lat: 47.2589, lon: 39.8181 },
        { name: "Волгоград (Гумрак)", lat: 48.7844, lon: 44.3469 },

        { name: "Нижний Новгород (Стригино)", lat: 56.2300, lon: 43.7836 },

        { name: "Краснодар (Пашковский)", lat: 45.0347, lon: 39.1386 },
        { name: "Сочи (Адлер)", lat: 43.4444, lon: 39.9567 },

        { name: "Минеральные Воды", lat: 44.2251, lon: 43.0819 },

        { name: "Пермь (Большое Савино)", lat: 57.9175, lon: 56.0211 },
        { name: "Казань", lat: 55.6062, lon: 49.2787 },
        { name: "Уфа", lat: 54.5575, lon: 55.8744 },
        { name: "Ижевск", lat: 56.8331, lon: 53.4542 },
        { name: "Киров", lat: 58.6433, lon: 49.3486 },
        { name: "Кострома", lat: 57.7919, lon: 41.0233 },

        { name: "Брянск", lat: 53.2142, lon: 34.1764 },

        { name: "Архангельск (Талаги)", lat: 64.5986, lon: 40.7161 },
        { name: "Вологда", lat: 59.2825, lon: 39.9464 },
        { name: "Смоленск", lat: 54.8239, lon: 32.0258 },

        { name: "Ставрополь", lat: 45.1092, lon: 42.1119 },
        { name: "Астрахань", lat: 46.2833, lon: 48.0064 },
        { name: "Оренбург", lat: 51.7956, lon: 55.4597 },

        { name: "Екатеринбург (Кольцово)", lat: 56.7431, lon: 60.8028 },
        { name: "Челябинск (Баландино)", lat: 55.3058, lon: 61.5039 },
        { name: "Тюмень (Рощино)", lat: 57.1683, lon: 65.3178 },

        { name: "Новосибирск (Толмачево)", lat: 55.0125, lon: 82.6506 },
        { name: "Барабинск (Новосибирская обл.)", lat: 55.3533, lon: 78.3589 }
    ];

    /* =====================================================
       НАСТРОЙКИ ПОКРЫТИЯ
       ===================================================== */

    const COVERAGE_RADIUS_KM = 250;

    const COVERAGE_STYLE = {
        color: "#777",
        fillColor: "#777",
        fillOpacity: 0.18,
        opacity: 0,
        weight: 0,
        stroke: false,
        interactive: false
    };

    /* =====================================================
       СТИЛЬ ТОЧЕК РЛС
       ===================================================== */

    const RADAR_STYLE = {
        radius: 6.5,

        color: "#000",
        weight: 2,
        opacity: 1,

        fillColor: "#fff",
        fillOpacity: 1,

        interactive: true
    };

    /* =====================================================
       СОСТОЯНИЕ
       ===================================================== */

    let map = null;

    let radarLayer = null;
    let coverageLayer = null;

    let visible = false;

    /* =====================================================
       ПОЛУЧЕНИЕ СУЩЕСТВУЮЩЕЙ LEAFLET-КАРТЫ

       index.html НЕ МЕНЯЕМ.
       ===================================================== */

    function getMap() {
        try {
            const m = window.eval("map");

            if (m && m instanceof L.Map) {
                return m;
            }
        } catch (e) {}

        return null;
    }

    /* =====================================================
       СОЗДАНИЕ СЛОЁВ
       ===================================================== */

    function createLayers() {

        if (!map) {
            return;
        }

        if (radarLayer || coverageLayer) {
            return;
        }

        radarLayer = L.layerGroup();
        coverageLayer = L.layerGroup();

        /* =================================================
           СЕРЫЕ ЗОНЫ ПОКРЫТИЯ
           ================================================= */

        RADARS.forEach(function (radar) {

            const coverage = L.circle(
                [radar.lat, radar.lon],
                {
                    radius: COVERAGE_RADIUS_KM * 1000,
                    ...COVERAGE_STYLE
                }
            );

            coverageLayer.addLayer(coverage);
        });

        /* =================================================
           ТОЧКИ РЛС
           ================================================= */

        RADARS.forEach(function (radar) {

            const marker = L.circleMarker(
                [radar.lat, radar.lon],
                RADAR_STYLE
            );

            marker.bindPopup(
                '<div style="' +
                    'font-family:Arial,sans-serif;' +
                    'font-size:14px;' +
                    'line-height:1.45;' +
                '">' +

                    '<b>РЛС ' +
                    radar.name +
                    '</b><br>' +

                    radar.lat.toFixed(4) +
                    '° с.ш.<br>' +

                    radar.lon.toFixed(4) +
                    '° в.д.' +

                '</div>'
            );

            radarLayer.addLayer(marker);
        });
    }

    /* =====================================================
       ПОКАЗ
       ===================================================== */

    function show() {

        map = getMap();

        if (!map) {
            setTimeout(show, 50);
            return;
        }

        createLayers();

        if (!radarLayer || !coverageLayer) {
            return;
        }

        if (!map.hasLayer(coverageLayer)) {
            coverageLayer.addTo(map);
        }

        if (!map.hasLayer(radarLayer)) {
            radarLayer.addTo(map);
        }

        visible = true;
    }

    /* =====================================================
       СКРЫТИЕ
       ===================================================== */

    function hide() {

        if (!map) {
            map = getMap();
        }

        if (!map) {
            return;
        }

        if (
            coverageLayer &&
            map.hasLayer(coverageLayer)
        ) {
            map.removeLayer(coverageLayer);
        }

        if (
            radarLayer &&
            map.hasLayer(radarLayer)
        ) {
            map.removeLayer(radarLayer);
        }

        visible = false;
    }

    /* =====================================================
       ПЕРЕКЛЮЧЕНИЕ
       ===================================================== */

    function setVisible(value) {

        if (value) {
            show();
        } else {
            hide();
        }
    }

    /* =====================================================
       UPDATE

       Сохраняет совместимость с существующим интерфейсом.
       ===================================================== */

    function update() {

        if (!visible) {
            return;
        }

        const currentMap = getMap();

        if (!currentMap) {
            return;
        }

        if (currentMap !== map) {

            map = currentMap;

            radarLayer = null;
            coverageLayer = null;

            createLayers();

            if (coverageLayer) {
                coverageLayer.addTo(map);
            }

            if (radarLayer) {
                radarLayer.addTo(map);
            }
        }
    }

    /* =====================================================
       ПУБЛИЧНЫЙ API

       НЕ УДАЛЯТЬ:
       существующий index.html использует
       RadarPoints.setVisible(...)
       ===================================================== */

    window.RadarPoints = {

        setVisible: setVisible,

        update: update,

        toggle: function () {
            setVisible(!visible);
        },

        isVisible: function () {
            return visible;
        },

        getRadars: function () {

            return RADARS.map(function (radar) {

                return {
                    name: radar.name,
                    lat: radar.lat,
                    lon: radar.lon
                };
            });
        }
    };

})();
