/* =========================================================
   Quantum Meteo — radars.js

   РЕАЛЬНЫЕ ДМРЛ-С
   Только подтверждённые координаты.

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

   Покрытие:
   номинальный радиус ДМРЛ-С = 250 км.
   Это именно радиус инструментальной зоны обнаружения,
   а не выдуманный контур местности.
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       РЕАЛЬНЫЕ КООРДИНАТЫ ДМРЛ-С

       Источник координат:
       Центральное УГМС — текущая наблюдательная сеть.

       Москва-Профсоюзная 55.67, 37.55
       Владимир         56.28, 40.20
       Смоленск         54.85, 32.00
       Тверь            56.90, 35.92
       ===================================================== */

    const RADARS = [
        {
            name: "Москва-Профсоюзная",
            lat: 55.67,
            lon: 37.55
        },

        {
            name: "Владимир",
            lat: 56.28,
            lon: 40.20
        },

        {
            name: "Смоленск",
            lat: 54.85,
            lon: 32.00
        },

        {
            name: "Тверь",
            lat: 56.90,
            lon: 35.92
        }
    ];

    /* =====================================================
       НАСТРОЙКИ
       ===================================================== */

    const COVERAGE_RADIUS_KM = 250;

    const COVERAGE_STYLE = {
        color: "#777",
        fillColor: "#777",
        fillOpacity: 0.18,
        weight: 0,
        stroke: false,
        interactive: false
    };

    const RADAR_STYLE = {
        radius: 6.5,
        color: "#000",
        weight: 2,
        opacity: 1,
        fillColor: "#fff",
        fillOpacity: 1,
        interactive: true
    };

    let map = null;

    let radarLayer = null;
    let coverageLayer = null;

    let visible = false;

    /* =====================================================
       ПОЛУЧАЕМ СУЩЕСТВУЮЩУЮ LEAFLET-КАРТУ

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
           ПОКРЫТИЕ
           ================================================= */

        RADARS.forEach(function (radar) {

            const circle = L.circle(
                [radar.lat, radar.lon],
                {
                    radius: COVERAGE_RADIUS_KM * 1000,
                    ...COVERAGE_STYLE
                }
            );

            coverageLayer.addLayer(circle);
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
                `
                <div style="
                    font-family:Arial,sans-serif;
                    font-size:14px;
                    line-height:1.4;
                ">
                    <b>ДМРЛ-С ${radar.name}</b><br>
                    <span>
                        ${radar.lat.toFixed(2)}° с.ш.,
                        ${radar.lon.toFixed(2)}° в.д.
                    </span>
                </div>
                `
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

        if (coverageLayer && map.hasLayer(coverageLayer)) {
            map.removeLayer(coverageLayer);
        }

        if (radarLayer && map.hasLayer(radarLayer)) {
            map.removeLayer(radarLayer);
        }

        visible = false;
    }

    /* =====================================================
       ПЕРЕКЛЮЧЕНИЕ
       ===================================================== */

    function setVisible(value) {

        value = !!value;

        if (value) {
            show();
        } else {
            hide();
        }
    }

    /* =====================================================
       UPDATE

       Сохраняем совместимость с существующим
       интерфейсом Quantum Meteo.
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

            if (radarLayer) {
                radarLayer.addTo(map);
            }

            if (coverageLayer) {
                coverageLayer.addTo(map);
            }

            return;
        }

        /*
         * Leaflet сам перемещает Circle/CircleMarker
         * при pan/zoom.
         *
         * Никаких пересчётов пикселей здесь нет.
         */
    }

    /* =====================================================
       ПУБЛИЧНЫЙ API

       НЕ УДАЛЯТЬ:
       index.html использует RadarPoints.setVisible()
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
