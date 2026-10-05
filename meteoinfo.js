/* =========================================================
   CLOrad — Meteoinfo DMRL
   Отдельный Meteoinfo.js

   НЕ НУЖНО:
   - менять index.html
   - делать window.map
   - передавать map в этот файл

   Кнопка создаётся прямо поверх #map.
   ========================================================= */

(() => {
    'use strict';

    /* =====================================================
       НАСТРОЙКИ
       ===================================================== */

    const TILE_URL =
        'https://meteoinfo.ru/res/nowcast/{z}0{x}0{y}/ncgi.php' +
        '?tnz={z}' +
        '&tnx={x}' +
        '&tny={y}' +
        '&layers=1' +
        '&inidt={time}';

    const FRAME_STEP = 10 * 60 * 1000;

    const OPACITY = 0.88;

    const BOUNDS = [
        [42.0776, 18.6794],
        [68.2286, 62.6090]
    ];


    /* =====================================================
       СОСТОЯНИЕ
       ===================================================== */

    let map = null;

    let radarLayer = null;

    let enabled = true;

    let currentTime =
        Math.floor(Date.now() / FRAME_STEP) *
        FRAME_STEP;

    let initialized = false;


    /* =====================================================
       CSS
       ===================================================== */

    function addCSS() {

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

                border:
                    1px solid
                    rgba(90,170,110,.75);

                border-radius: 7px;

                background:
                    rgba(8,16,10,.97);

                color:
                    #eaffee;

                font-family:
                    Arial,
                    sans-serif;

                font-size:
                    11px;

                font-weight:
                    600;

                letter-spacing:
                    .2px;

                box-shadow:
                    0 2px 10px
                    rgba(0,0,0,.55);

                cursor:
                    pointer;

                user-select:
                    none;

                -webkit-user-select:
                    none;

                -webkit-tap-highlight-color:
                    transparent;

                touch-action:
                    manipulation;

                transition:
                    none !important;
            }


            #clorad-meteoinfo-button:hover {

                background:
                    rgba(20,60,28,.98);

            }


            #clorad-meteoinfo-button.off {

                background:
                    rgba(25,25,25,.97);

                border-color:
                    rgba(120,120,120,.45);

                color:
                    #999;

            }


            #clorad-meteoinfo-dot {

                display:
                    block;

                width:
                    8px;

                height:
                    8px;

                min-width:
                    8px;

                border-radius:
                    50%;

                background:
                    #52dc76;

                box-shadow:
                    0 0 7px
                    rgba(82,220,118,.8);

            }


            #clorad-meteoinfo-button.off
            #clorad-meteoinfo-dot {

                background:
                    #777;

                box-shadow:
                    none;

            }


            @media(max-width:640px) {

                #clorad-meteoinfo-button {

                    top:
                        10px;

                    left:
                        52px;

                    height:
                        36px;

                    padding:
                        0 10px;

                    font-size:
                        9px;

                }

            }

        `;

        document.head.appendChild(style);
    }


    /* =====================================================
       ИЩЕМ LEAFLET MAP
       ===================================================== */

    function findMap() {

        const mapElement =
            document.getElementById('map');

        if (!mapElement) {
            return null;
        }


        /*
         * Leaflet хранит объект карты
         * в собственном внутреннем ID элемента.
         */

        const leafletId =
            mapElement._leaflet_id;

        if (!leafletId) {
            return null;
        }


        /*
         * Ищем карту среди всех объектов,
         * зарегистрированных Leaflet.
         */

        if (
            L &&
            L.stamp &&
            L.stamp(mapElement) === leafletId
        ) {

            /*
             * Сам DOM-элемент не содержит
             * прямой ссылки на map,
             * поэтому дополнительно проверяем
             * известные варианты.
             */

            if (
                mapElement._leaflet_map
            ) {
                return mapElement._leaflet_map;
            }
        }


        /*
         * Частый вариант у Leaflet:
         * карта может быть доступна через
         * внутренние свойства контейнера.
         */

        for (
            const key of Object.keys(mapElement)
        ) {

            const value =
                mapElement[key];

            if (
                value &&
                typeof value === 'object' &&
                typeof value.addLayer === 'function' &&
                typeof value.removeLayer === 'function' &&
                typeof value.getCenter === 'function' &&
                typeof value.getZoom === 'function'
            ) {

                return value;
            }
        }


        /*
         * Если карта всё ещё не найдена,
         * ищем Leaflet-объекты рекурсивно
         * только среди собственных свойств.
         */

        for (
            const key of Object.keys(mapElement)
        ) {

            const value =
                mapElement[key];

            if (
                value &&
                typeof value === 'object'
            ) {

                try {

                    if (
                        value._container === mapElement &&
                        typeof value.addLayer === 'function'
                    ) {

                        return value;
                    }

                } catch (e) {}

            }
        }


        return null;
    }


    /* =====================================================
       ДОПОЛНИТЕЛЬНЫЙ ПОИСК ЧЕРЕЗ LEAFLET DOM
       ===================================================== */

    function waitForMap() {

        if (initialized) {
            return;
        }


        const found =
            findMap();


        if (found) {

            map =
                found;

            init();

            return;
        }


        /*
         * Проверяем каждые 250 мс.
         */

        setTimeout(
            waitForMap,
            250
        );
    }


    /* =====================================================
       RADAR GRID
       ===================================================== */

    const MeteoinfoGrid =
        L.GridLayer.extend({

            initialize:
                function(timestamp) {

                    this.timestamp =
                        timestamp;


                    L.GridLayer.prototype.initialize.call(
                        this,
                        {

                            tileSize:
                                256,

                            minZoom:
                                4,

                            maxZoom:
                                11,

                            minNativeZoom:
                                5,

                            maxNativeZoom:
                                8,

                            opacity:
                                OPACITY,

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
                                    BOUNDS
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

                            finished =
                                true;

                            done(
                                error,
                                canvas
                            );
                        };


                    /*
                     * Переворачиваем Y.
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
                        TILE_URL
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
                        () => {

                            finish();
                        };


                    img.src =
                        url;


                    /*
                     * Защита от зависшего
                     * запроса.
                     */

                    setTimeout(
                        () => finish(),
                        15000
                    );


                    return canvas;
                }

        });


    /* =====================================================
       СОЗДАНИЕ РАДАРА
       ===================================================== */

    function createRadar(timestamp) {

        return new MeteoinfoGrid(
            timestamp
        );
    }


    /* =====================================================
       КНОПКА
       ===================================================== */

    function createButton() {

        if (
            document.getElementById(
                'clorad-meteoinfo-button'
            )
        ) {
            return;
        }


        const mapElement =
            document.getElementById('map');


        if (!mapElement) {
            return;
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
                Метеоинфо ДМРЛ
            </span>

        `;


        button.title =
            'Включить / выключить Метеоинфо ДМРЛ';


        mapElement.appendChild(
            button
        );


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


                    if (!radarLayer) {

                        radarLayer =
                            createRadar(
                                currentTime
                            );

                        radarLayer.addTo(
                            map
                        );

                    } else {

                        radarLayer.setOpacity(
                            OPACITY
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
    }


    /* =====================================================
       ПЕРЕКЛЮЧЕНИЕ КАДРА
       ===================================================== */

    function changeFrame(timestamp) {

        if (!map || !enabled) {
            return;
        }


        if (
            radarLayer &&
            radarLayer.timestamp === timestamp
        ) {
            return;
        }


        const oldLayer =
            radarLayer;


        const newLayer =
            createRadar(
                timestamp
            );


        /*
         * Новый слой добавляем поверх старого.
         */

        newLayer.addTo(
            map
        );


        let done =
            false;


        const swap =
            () => {

                if (done) {
                    return;
                }


                done =
                    true;


                if (
                    oldLayer &&
                    map.hasLayer(
                        oldLayer
                    )
                ) {

                    map.removeLayer(
                        oldLayer
                    );

                }


                radarLayer =
                    newLayer;


                currentTime =
                    timestamp;

            };


        newLayer.once(
            'load',
            swap
        );


        /*
         * Если часть тайлов уже загрузилась,
         * разрешаем переключение через 15 секунд.
         */

        setTimeout(
            () => {

                if (done) {
                    return;
                }


                if (
                    newLayer._tiles &&
                    Object.keys(
                        newLayer._tiles
                    ).length > 0
                ) {

                    swap();

                }

            },
            15000
        );

    }


    /* =====================================================
       АВТООБНОВЛЕНИЕ
       ===================================================== */

    function startRefresh() {

        setInterval(
            () => {

                if (!enabled) {
                    return;
                }


                const latest =
                    Math.floor(
                        Date.now() /
                        FRAME_STEP
                    ) *
                    FRAME_STEP;


                if (
                    latest !==
                    currentTime
                ) {

                    changeFrame(
                        latest
                    );

                }

            },
            60000
        );
    }


    /* =====================================================
       INIT
       ===================================================== */

    function init() {

        if (initialized) {
            return;
        }


        initialized =
            true;


        addCSS();


        /*
         * Кнопка.
         */

        createButton();


        /*
         * Первый кадр.
         */

        radarLayer =
            createRadar(
                currentTime
            );


        radarLayer.addTo(
            map
        );


        /*
         * Автообновление.
         */

        startRefresh();


        /*
         * Публичное API.
         */

        window.MeteoinfoDMRL = {

            enable() {

                const btn =
                    document.getElementById(
                        'clorad-meteoinfo-button'
                    );

                if (
                    !enabled &&
                    btn
                ) {
                    btn.click();
                }

            },


            disable() {

                const btn =
                    document.getElementById(
                        'clorad-meteoinfo-button'
                    );

                if (
                    enabled &&
                    btn
                ) {
                    btn.click();
                }

            },


            toggle() {

                const btn =
                    document.getElementById(
                        'clorad-meteoinfo-button'
                    );

                if (btn) {
                    btn.click();
                }

            },


            refresh() {

                const latest =
                    Math.floor(
                        Date.now() /
                        FRAME_STEP
                    ) *
                    FRAME_STEP;

                changeFrame(
                    latest
                );

            },


            setFrame(timestamp) {

                changeFrame(
                    Math.floor(
                        timestamp /
                        FRAME_STEP
                    ) *
                    FRAME_STEP
                );

            }

        };


        console.log(
            '[Meteoinfo] Метеоинфо ДМРЛ подключён'
        );

    }


    /* =====================================================
       ЗАПУСК
       ===================================================== */

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            waitForMap
        );

    } else {

        waitForMap();

    }

})();
