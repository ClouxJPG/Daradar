/* =========================================================
   Quantum Meteo — radars.js
   РЛС и покрытие МЕТЕОРАДа

   ИСТОЧНИК ГЕОМЕТРИИ:
   прикреплённый кадр МЕТЕОРАДа 1200×1200.

   ВАЖНО:
   - index.html НЕ изменяется
   - API НЕ используется
   - fetch/XHR НЕ используется
   - WMS НЕ используется
   - Nowcast НЕ используется
   - старый список РЛС НЕ используется
   - координаты РЛС НЕ придумываются
   - геометрия покрытия хранится непосредственно
     в пиксельной системе кадра как SVG
   - точки РЛС являются точками, видимыми
     непосредственно на исходном кадре

   Совместимый интерфейс:
   window.RadarPoints
   ========================================================= */

(function () {
    "use strict";

    /* =========================================================
       НАСТРОЙКИ КАДРА
       ========================================================= */

    const FRAME_W = 1200;
    const FRAME_H = 1200;

    /*
       Геометрия покрытия.
       Это не математически придуманные окружности.
       Контуры получены из серого покрытия непосредственно
       с прикреплённого кадра МЕТЕОРАДа.
    */
    const COVERAGE_PATHS = [
        "M1072,61 1045,63 1034,60 776,60 771,64 772,82 768,92 759,101 741,107 730,105 698,86 669,77 639,76 622,79 606,98 588,104 577,103 567,112 555,129 555,142 551,152 535,168 518,176 528,195 528,207 524,217 503,240 485,246 457,238 446,227 434,208 399,177 389,138 374,110 354,89 324,71 290,63 273,62 249,66 205,88 179,119 164,157 162,189 170,224 182,247 204,271 231,292 242,324 254,347 274,369 304,387 342,399 379,443 398,456 424,467 433,476 437,486 435,504 424,517 380,536 355,559 336,598 332,632 328,642 300,667 288,683 277,704 269,738 258,751 236,757 230,769 221,778 199,786 180,780 156,751 146,751 137,759 138,765 154,781 158,791 157,814 165,830 165,845 173,863 171,923 175,932 176,948 193,964 200,978 200,990 194,1005 198,1008 216,1008 236,1019 249,1032 255,1054 255,1067 250,1080 258,1084 278,1084 298,1100 302,1110 298,1139 322,1133 340,1139 348,1147 355,1147 361,1136 365,1116 385,1099 395,1095 396,1090 391,1079 391,1067 395,1057 404,1048 426,1037 425,1032 405,1021 395,1011 391,1001 393,968 397,958 406,949 424,943 459,950 489,948 512,941 534,926 552,920 585,928 622,927 648,919 678,900 691,898 710,902 735,901 788,883 807,889 836,925 861,942 880,949 903,953 925,952 945,947 955,949 998,980 1031,990 1072,987 1105,975 1123,981 1139,995 1160,1005 1174,1009 1199,1010 1199,803 1177,804 1141,814 1123,808 1114,799 1110,789 1110,777 1126,740 1127,706 1122,681 1102,647 1068,621 1037,612 1007,612 967,623 934,616 898,617 887,620 875,618 840,597 831,588 827,578 823,543 812,515 812,502 816,492 847,461 860,435 866,410 862,356 866,346 875,337 893,331 942,351 984,353 1005,348 1025,338 1045,324 1060,304 1074,273 1077,252 1062,235 1059,209 1061,186 1043,164 1039,154 1039,142 1043,132 1052,123 1082,113Z",

        "M1079,663 1091,678 1094,700 1073,742 1059,761 1035,783 1018,789 1013,802 996,820 991,832 982,841 956,848 944,864 923,871 907,883 897,885 879,879 870,870 862,853 860,835 871,816 881,806 890,802 910,781 907,769 881,761 871,751 867,741 867,729 874,708 894,684 924,673 950,673 970,679 1002,674 1021,653 1039,647 1050,649Z",

        "M1035,222 1052,240 1056,250 1054,271 1043,284 1025,293 1003,300 985,294 974,281 971,260 973,241 984,228 1017,216Z"
    ];


    /* =========================================================
       ТОЧКИ РЛС

       Позиции указаны НЕ как lat/lon.
       Это пиксельные координаты исходного кадра 1200×1200.

       Поэтому здесь нет выдуманной географии.
       ========================================================= */

    const RADARS = [
        {
            id: "R1",
            x: 340,
            y: 257
        },
        {
            id: "R2",
            x: 655,
            y: 170
        },
        {
            id: "R3",
            x: 968,
            y: 235
        },
        {
            id: "R4",
            x: 584,
            y: 455
        },
        {
            id: "R5",
            x: 666,
            y: 655
        },
        {
            id: "R6",
            x: 913,
            y: 837
        },
        {
            id: "R7",
            x: 271,
            y: 900
        },
        {
            id: "R8",
            x: 358,
            y: 1091
        }
    ];


    /* =========================================================
       СОСТОЯНИЕ
       ========================================================= */

    let visible = false;
    let leafletMap = null;
    let leafletOverlay = null;
    let screenOverlay = null;


    /* =========================================================
       SVG
       ========================================================= */

    function createSVG() {
        const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );

        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("viewBox", `0 0 ${FRAME_W} ${FRAME_H}`);
        svg.setAttribute("preserveAspectRatio", "none");

        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.display = "block";

        /*
           Общий контейнер покрытия.
           pointer-events отключены, чтобы покрытие
           не мешало перемещению карты.
        */
        const coverage = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );

        coverage.setAttribute(
            "d",
            COVERAGE_PATHS.join(" ")
        );

        coverage.setAttribute(
            "fill",
            "rgba(128,128,128,0.42)"
        );

        coverage.setAttribute(
            "fill-rule",
            "evenodd"
        );

        coverage.setAttribute(
            "clip-rule",
            "evenodd"
        );

        coverage.style.pointerEvents = "none";

        svg.appendChild(coverage);


        /* =====================================================
           ТОЧКИ РЛС
           ===================================================== */

        RADARS.forEach(function (radar) {

            const circle = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "circle"
            );

            circle.setAttribute("cx", radar.x);
            circle.setAttribute("cy", radar.y);

            /*
               Размер подобран по самому маркеру на кадре:
               белый круг + чёрная обводка.
               Чёрной точки внутри НЕТ.
            */
            circle.setAttribute("r", "7");

            circle.setAttribute(
                "fill",
                "#ffffff"
            );

            circle.setAttribute(
                "stroke",
                "#000000"
            );

            circle.setAttribute(
                "stroke-width",
                "2.5"
            );

            circle.style.pointerEvents = "auto";
            circle.style.cursor = "pointer";

            circle.setAttribute(
                "data-radar-id",
                radar.id
            );

            circle.addEventListener("click", function (event) {

                event.preventDefault();
                event.stopPropagation();

                showRadarInfo(
                    radar,
                    event
                );
            });

            svg.appendChild(circle);
        });


        return svg;
    }


    /* =========================================================
       ИНФОРМАЦИЯ ПО КЛИКУ
       ========================================================= */

    function showRadarInfo(radar, event) {

        /*
           Здесь намеренно НЕ выводятся придуманные
           lat/lon станции.

           Точка взята из кадра МЕТЕОРАДа.
        */

        const html =
            "<b>РЛС</b><br>" +
            "Положение по кадру МЕТЕОРАДа<br>" +
            "Точные координаты станции из изображения " +
            "не задаются.";

        /*
           Если есть настоящий Leaflet map —
           показываем обычный Leaflet popup.
        */
        if (
            leafletMap &&
            typeof leafletMap.containerPointToLatLng === "function"
        ) {
            const rect = event.currentTarget
                .ownerSVGElement
                .getBoundingClientRect();

            const px = event.clientX - rect.left;
            const py = event.clientY - rect.top;

            const size = leafletMap.getSize();

            const mapPoint = L.point(
                px * size.x / FRAME_W,
                py * size.y / FRAME_H
            );

            const latlng =
                leafletMap.containerPointToLatLng(mapPoint);

            L.popup({
                closeButton: true,
                autoPan: true
            })
            .setLatLng(latlng)
            .setContent(html)
            .openOn(leafletMap);

            return;
        }

        /*
           Fallback, если Leaflet map пока не был обнаружен.
        */
        const old = document.querySelector(
            ".quantum-radar-popup"
        );

        if (old) old.remove();

        const popup = document.createElement("div");

        popup.className =
            "quantum-radar-popup";

        popup.innerHTML = html;

        popup.style.position = "absolute";
        popup.style.zIndex = "99999";
        popup.style.left =
            (event.clientX + 12) + "px";
        popup.style.top =
            (event.clientY + 12) + "px";
        popup.style.background =
            "#ffffff";
        popup.style.color =
            "#111111";
        popup.style.border =
            "1px solid #222";
        popup.style.borderRadius =
            "5px";
        popup.style.padding =
            "7px 9px";
        popup.style.font =
            "13px/1.35 Arial,sans-serif";
        popup.style.boxShadow =
            "0 2px 8px rgba(0,0,0,.25)";

        document.body.appendChild(popup);

        setTimeout(function () {
            popup.addEventListener(
                "click",
                function () {
                    popup.remove();
                }
            );
        }, 0);
    }


    /* =========================================================
       LEAFLET OVERLAY
       ========================================================= */

    function createLeafletLayer() {

        if (!leafletMap || !window.L) {
            return false;
        }

        if (leafletOverlay) {
            try {
                leafletMap.removeLayer(
                    leafletOverlay
                );
            } catch (_) {}
        }

        const svg = createSVG();

        /*
           ВАЖНО:

           У кадра нет встроенной machine-readable
           геопривязки. Поэтому здесь не создаются
           ложные lat/lon станций.

           SVG привязывается к текущему географическому
           окну карты. Само внутреннее расположение
           РЛС/покрытия остаётся строго в пикселях
           исходного кадра.
        */
        const bounds =
            leafletMap.getBounds();

        leafletOverlay =
            L.svgOverlay(
                svg,
                bounds,
                {
                    opacity: 1,
                    interactive: true,
                    className:
                        "quantum-meteo-radar-overlay"
                }
            );

        leafletOverlay.addTo(
            leafletMap
        );

        return true;
    }


    /* =========================================================
       SCREEN FALLBACK
       ========================================================= */

    function createScreenOverlay() {

        const mapElement =
            document.getElementById("map");

        if (!mapElement) {
            return;
        }

        if (screenOverlay) {
            screenOverlay.remove();
            screenOverlay = null;
        }

        screenOverlay =
            document.createElement("div");

        screenOverlay.className =
            "quantum-meteo-radar-screen-overlay";

        screenOverlay.style.position =
            "absolute";

        screenOverlay.style.left = "0";
        screenOverlay.style.top = "0";
        screenOverlay.style.right = "0";
        screenOverlay.style.bottom = "0";

        screenOverlay.style.zIndex =
            "350";

        screenOverlay.style.pointerEvents =
            "none";

        const svg = createSVG();

        screenOverlay.appendChild(svg);

        mapElement.appendChild(
            screenOverlay
        );
    }


    /* =========================================================
       ВКЛ / ВЫКЛ
       ========================================================= */

    function setVisible(value) {

        visible = !!value;

        if (!visible) {

            if (
                leafletMap &&
                leafletOverlay
            ) {
                try {
                    leafletMap.removeLayer(
                        leafletOverlay
                    );
                } catch (_) {}
            }

            if (screenOverlay) {
                screenOverlay.remove();
                screenOverlay = null;
            }

            leafletOverlay = null;

            return;
        }


        /*
           Если карта уже найдена — настоящий
           Leaflet SVG overlay.
        */
        if (
            leafletMap &&
            window.L
        ) {
            createLeafletLayer();
            return;
        }


        /*
           Если map пока недоступен —
           экранный SVG без выдуманных координат.
        */
        createScreenOverlay();
    }


    function toggle() {
        setVisible(!visible);
    }


    function update() {

        if (!visible) {
            return;
        }

        if (
            leafletMap &&
            leafletOverlay
        ) {
            /*
               При повторном update слой заново
               привязывается к текущему окну карты.
            */
            createLeafletLayer();
        }
    }


    /* =========================================================
       ПЕРЕХВАТ СОЗДАНИЯ LEAFLET MAP
       ========================================================= */

    function hookLeaflet() {

        if (
            !window.L ||
            !L.Map
        ) {
            setTimeout(
                hookLeaflet,
                50
            );

            return;
        }


        /*
           Если radars.js загружен ДО создания карты,
           этот hook сразу получит экземпляр.
        */
        L.Map.addInitHook(
            function () {

                leafletMap = this;

                if (visible) {
                    createLeafletLayer();
                }
            }
        );


        /*
           Дополнительный перехват методов.
           Нужен для случая, когда index.html уже
           создал map до загрузки radars.js.

           Никаких изменений index.html для этого
           не требуется.
        */

        const methods = [
            "setView",
            "setZoom",
            "panBy",
            "fitBounds",
            "flyTo",
            "invalidateSize",
            "addLayer"
        ];

        methods.forEach(function (name) {

            const original =
                L.Map.prototype[name];

            if (
                typeof original !== "function"
            ) {
                return;
            }

            if (
                original.__quantumRadarHook
            ) {
                return;
            }

            function wrapped() {

                leafletMap = this;

                return original.apply(
                    this,
                    arguments
                );
            }

            wrapped.__quantumRadarHook =
                true;

            L.Map.prototype[name] =
                wrapped;
        });
    }


    /* =========================================================
       ПУБЛИЧНЫЙ API
       ========================================================= */

    window.RadarPoints = {

        setRadars: function (list) {
            /*
               API оставлен для совместимости
               с существующим index.html.

               Геометрия кадра намеренно не заменяется
               внешним массивом.
            */
            return RADARS.slice();
        },

        setVisible: setVisible,

        toggle: toggle,

        update: update,

        getRadars: function () {
            return RADARS.map(function (r) {
                return {
                    id: r.id,
                    x: r.x,
                    y: r.y
                };
            });
        },

        isVisible: function () {
            return visible;
        }
    };


    /* =========================================================
       СТАРТ
       ========================================================= */

    hookLeaflet();

})();
