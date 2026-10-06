/* =========================================================
   QUANTUM METEO — RADARS.JS
   =========================================================

   ДМРЛ-С:
   - рабочие позиции из официального перечня
   - 250 км радиолокационного покрытия
   - 125 км Doppler-зоны
   - тёмное отображение покрытия
   - реальные расчётные blind sectors
   - Terrain / Terrarium DEM
   - перерасчёт при zoom
   - исправленная привязка к #lp
   - без radars.json
   - без изменения index.html

   ========================================================= */

(function(){

"use strict";


/* =========================================================
   НАСТРОЙКИ
   ========================================================= */

const CONFIG = {

    /* Радиус обзора ДМРЛ-С */
    reflectivityRange: 250000,

    /* Практическая дальность Doppler */
    velocityRange: 125000,

    /*
       Геометрическая высота центра антенны.
       Это модельное значение.
    */
    antennaHeight: 40,

    /*
       Стандартная эффективная кривизна Земли.
    */
    kFactor: 4 / 3,

    /*
       Нижний рабочий угол.
    */
    beamElevationDeg: 0.5,

    /*
       Официальная ширина диаграммы ДМРЛ-С
       около 1 градуса.
    */
    beamWidthDeg: 1.0,

    /*
       Низкий zoom:
       меньше вычислений.
    */
    coarseAzimuths: 24,

    /*
       Высокий zoom:
       детализация blind sectors.
    */
    fineAzimuths: 72,

    /*
       DEM zoom.
    */
    terrainZoom: 9,

    /*
       На низком zoom шаг крупнее.
    */
    coarseRangeStep: 10000,

    /*
       На высоком zoom точнее.
    */
    fineRangeStep: 5000,

    /*
       Blind sector не рисуем,
       если он меньше этого расстояния.
    */
    minimumBlindDistance: 15000,

    /*
       Цвета.
    */
    colors: {

        coverage: "#111b2b",
        coverageBorder: "#07101d",

        velocity: "#173b5e",
        velocityBorder: "#0a2945",

        radar: "#ffb52e",
        radarBorder: "#111111",

        blind: "#070b12",
        blindBorder: "#020408",

        ray: "#263a55"

    },

    /*
       Прозрачности.
    */
    opacity: {

        coverage: 0.10,
        velocity: 0.14,
        blind: 0.58,
        ray: 0.15
    },

    /*
       Максимум blind sectors одновременно.
       Защита iPhone от лишней нагрузки.
    */
    maxBlindRadars: 12

};


/* =========================================================
   EARTH
   ========================================================= */

const EARTH_RADIUS = 6371000;


/* =========================================================
   РАБОЧИЕ ДМРЛ-С
   =========================================================

   Основа списка:
   официальный перечень ДМРЛ-С Росгидромета.

   Владимир и Орёл НЕ включены,
   поскольку в указанном перечне их
   метеорологическая адаптация ещё
   не была завершена.

   ========================================================= */

const RADARS = [

    {
        id: "arkhangelsk",
        name: "Архангельск",
        lat: 64.54,
        lon: 40.54
    },

    {
        id: "barabinsk",
        name: "Барабинск",
        lat: 55.35,
        lon: 78.35
    },

    {
        id: "belgorod",
        name: "Белгород",
        lat: 50.60,
        lon: 36.60
    },

    {
        id: "bryansk",
        name: "Брянск",
        lat: 53.25,
        lon: 34.37
    },

    {
        id: "valday",
        name: "Валдай",
        lat: 57.98,
        lon: 33.25
    },

    {
        id: "velikie-luki",
        name: "Великие Луки",
        lat: 56.34,
        lon: 30.52
    },

    {
        id: "vladivostok",
        name: "Владивосток",
        lat: 43.12,
        lon: 131.89
    },

    {
        id: "vnukovo",
        name: "Внуково",
        lat: 55.60,
        lon: 37.27
    },

    {
        id: "voeikovo",
        name: "Воейково",
        lat: 59.94,
        lon: 30.68
    },

    {
        id: "volgograd",
        name: "Волгоград",
        lat: 48.71,
        lon: 44.51
    },

    {
        id: "vologda",
        name: "Вологда",
        lat: 59.22,
        lon: 39.89
    },

    {
        id: "izhevsk",
        name: "Ижевск",
        lat: 56.85,
        lon: 53.21
    },

    {
        id: "kazan",
        name: "Казань",
        lat: 55.79,
        lon: 49.12
    },

    {
        id: "kirov",
        name: "Киров",
        lat: 58.60,
        lon: 49.67
    },

    {
        id: "kostroma",
        name: "Кострома",
        lat: 57.77,
        lon: 40.93
    },

    {
        id: "kotlas",
        name: "Котлас",
        lat: 61.25,
        lon: 46.63
    },

    {
        id: "krasnodar",
        name: "Краснодар",
        lat: 45.04,
        lon: 38.98
    },

    {
        id: "kursk",
        name: "Курск",
        lat: 51.73,
        lon: 36.19
    },

    {
        id: "mineralnye-vody",
        name: "Минеральные Воды",
        lat: 44.22,
        lon: 43.14
    },

    {
        id: "moscow-profsoyuznaya",
        name: "Москва-Профсоюзная",
        lat: 55.67,
        lon: 37.55
    },

    {
        id: "millerovo",
        name: "Миллерово",
        lat: 48.92,
        lon: 40.40
    },

    {
        id: "nizhny-novgorod",
        name: "Нижний Новгород",
        lat: 56.33,
        lon: 44.00
    },

    {
        id: "novosibirsk",
        name: "Новосибирск",
        lat: 55.03,
        lon: 82.92
    },

    {
        id: "orenburg",
        name: "Оренбург",
        lat: 51.77,
        lon: 55.10
    },

    {
        id: "petrozavodsk",
        name: "Петрозаводск",
        lat: 61.79,
        lon: 34.36
    },

    {
        id: "petropavlovsk",
        name: "Петропавловск-Камчатский",
        lat: 53.05,
        lon: 158.65
    },

    {
        id: "samara",
        name: "Самара",
        lat: 53.18,
        lon: 50.15
    },

    {
        id: "smolensk",
        name: "Смоленск",
        lat: 54.78,
        lon: 32.04
    },

    {
        id: "stavropol",
        name: "Ставрополь",
        lat: 45.04,
        lon: 41.97
    },

    {
        id: "tambov",
        name: "Тамбов",
        lat: 52.72,
        lon: 41.45
    },

    {
        id: "tula",
        name: "Тула",
        lat: 54.19,
        lon: 37.62
    },

    {
        id: "ufa",
        name: "Уфа",
        lat: 54.74,
        lon: 55.97
    },

    {
        id: "sheremetyevo",
        name: "Шереметьево",
        lat: 55.97,
        lon: 37.41
    },

    {
        id: "elista",
        name: "Элиста",
        lat: 46.31,
        lon: 44.27
    }

];


/* =========================================================
   STATE
   ========================================================= */

let mapRef = null;

let enabled = false;

let rootLayer = null;

let coverageLayer = null;

let velocityLayer = null;

let rayLayer = null;

let radarLayer = null;

let blindLayer = null;

let renderToken = 0;

let initialized = false;


/* =========================================================
   TERRAIN CACHE
   ========================================================= */

const terrainCache = new Map();

const terrainPromises = new Map();


/* =========================================================
   MAP
   ========================================================= */

function getMap(){

    if(window.QM_MAP)
        return window.QM_MAP;

    try{

        if(typeof map !== "undefined" && map)
            return map;

    }catch(e){}

    return null;
}


/* =========================================================
   DISTANCE
   ========================================================= */

function distanceMeters(
    lat1,
    lon1,
    lat2,
    lon2
){

    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;

    const dLat =
        (lat2-lat1) * Math.PI / 180;

    const dLon =
        (lon2-lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat/2) ** 2 +
        Math.cos(p1) *
        Math.cos(p2) *
        Math.sin(dLon/2) ** 2;

    return 2 *
        EARTH_RADIUS *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );
}


/* =========================================================
   DESTINATION
   ========================================================= */

function destination(
    lat,
    lon,
    distance,
    bearing
){

    const br =
        bearing * Math.PI / 180;

    const lat1 =
        lat * Math.PI / 180;

    const lon1 =
        lon * Math.PI / 180;

    const d =
        distance / EARTH_RADIUS;

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
            lon2 * 180 / Math.PI + 540
        ) % 360 - 180

    ];
}


/* =========================================================
   WEB MERCATOR
   ========================================================= */

function lonToX(lon,z){

    const n = 2 ** z;

    return (
        (lon + 180) / 360
    ) * n;
}


function latToY(lat,z){

    const n = 2 ** z;

    const r =
        lat * Math.PI / 180;

    return (
        (
            1 -
            Math.asinh(
                Math.tan(r)
            ) / Math.PI
        ) / 2
    ) * n;
}


/* =========================================================
   TERRARIUM TILE
   ========================================================= */

function terrainTileUrl(
    z,
    x,
    y
){

    /*
       ВАЖНО:

       Terrarium = PNG с высотой.

       Skadi = HGT/GZIP.

       Старый код ошибочно использовал
       skadi/...png.
    */

    return (
        "https://s3.amazonaws.com/" +
        "elevation-tiles-prod/terrarium/" +
        z + "/" +
        x + "/" +
        y + ".png"
    );
}


/* =========================================================
   LOAD TERRAIN TILE
   ========================================================= */

function loadTerrainTile(
    z,
    x,
    y
){

    const n = 2 ** z;

    x = ((x % n) + n) % n;

    if(y < 0 || y >= n)
        return Promise.resolve(null);

    const key =
        z + "/" + x + "/" + y;

    if(terrainCache.has(key))
        return Promise.resolve(
            terrainCache.get(key)
        );

    if(terrainPromises.has(key))
        return terrainPromises.get(key);

    const promise =
        new Promise(function(resolve){

            const img =
                new Image();

            img.crossOrigin = "anonymous";

            let finished = false;

            const done =
                function(result){

                    if(finished)
                        return;

                    finished = true;

                    terrainPromises.delete(key);

                    resolve(result);

                };

            img.onload =
                function(){

                    try{

                        const canvas =
                            document.createElement(
                                "canvas"
                            );

                        canvas.width = 256;
                        canvas.height = 256;

                        const ctx =
                            canvas.getContext(
                                "2d",
                                {
                                    willReadFrequently:true
                                }
                            );

                        ctx.drawImage(
                            img,
                            0,
                            0
                        );

                        const data =
                            ctx.getImageData(
                                0,
                                0,
                                256,
                                256
                            ).data;

                        const result = {
                            data:data,
                            width:256,
                            height:256
                        };

                        terrainCache.set(
                            key,
                            result
                        );

                        done(result);

                    }catch(e){

                        done(null);

                    }

                };

            img.onerror =
                function(){

                    done(null);

                };

            /*
               Защита от зависшего запроса.
            */

            setTimeout(
                function(){
                    done(null);
                },
                7000
            );

            img.src =
                terrainTileUrl(
                    z,
                    x,
                    y
                );

        });

    terrainPromises.set(
        key,
        promise
    );

    return promise;
}


/* =========================================================
   ELEVATION
   ========================================================= */

async function elevationAt(
    lat,
    lon
){

    const z =
        CONFIG.terrainZoom;

    const xf =
        lonToX(lon,z);

    const yf =
        latToY(lat,z);

    const tx =
        Math.floor(xf);

    const ty =
        Math.floor(yf);

    const px =
        Math.max(
            0,
            Math.min(
                255,
                Math.floor(
                    (xf-tx) * 256
                )
            )
        );

    const py =
        Math.max(
            0,
            Math.min(
                255,
                Math.floor(
                    (yf-ty) * 256
                )
            )
        );

    const tile =
        await loadTerrainTile(
            z,
            tx,
            ty
        );

    if(!tile)
        return null;

    const i =
        (py * 256 + px) * 4;

    const r =
        tile.data[i];

    const g =
        tile.data[i+1];

    const b =
        tile.data[i+2];

    return (
        r * 256 +
        g +
        b / 256
    ) - 32768;
}


/* =========================================================
   EFFECTIVE BEAM HEIGHT
   ========================================================= */

function beamHeight(
    radarElevation,
    distance
){

    const angle =
        CONFIG.beamElevationDeg *
        Math.PI / 180;

    const kEarth =
        EARTH_RADIUS *
        CONFIG.kFactor;

    return (
        radarElevation +
        CONFIG.antennaHeight +
        distance * Math.tan(angle) +
        (
            distance * distance
        ) / (
            2 * kEarth
        )
    );
}


/* =========================================================
   COVERAGE CIRCLES
   ========================================================= */

function drawCoverage(){

    if(!mapRef)
        return;

    coverageLayer.clearLayers();
    velocityLayer.clearLayers();
    rayLayer.clearLayers();
    radarLayer.clearLayers();

    const renderer =
        L.canvas({
            padding:0.5
        });

    RADARS.forEach(function(r){

        /* =========================================
           250 KM
           ========================================= */

        L.circle(
            [r.lat,r.lon],
            {
                renderer:renderer,

                radius:
                    CONFIG.reflectivityRange,

                color:
                    CONFIG.colors.coverageBorder,

                weight:1.1,

                opacity:0.65,

                fillColor:
                    CONFIG.colors.coverage,

                fillOpacity:
                    CONFIG.opacity.coverage,

                interactive:false
            }
        ).addTo(
            coverageLayer
        );


        /* =========================================
           125 KM DOPPLER
           ========================================= */

        L.circle(
            [r.lat,r.lon],
            {
                renderer:renderer,

                radius:
                    CONFIG.velocityRange,

                color:
                    CONFIG.colors.velocityBorder,

                weight:0.8,

                opacity:0.65,

                fillColor:
                    CONFIG.colors.velocity,

                fillOpacity:
                    CONFIG.opacity.velocity,

                interactive:false
            }
        ).addTo(
            velocityLayer
        );


        /* =========================================
           RADIAL RAYS
           ========================================= */

        const rayCount = 24;

        for(
            let i=0;
            i<rayCount;
            i++
        ){

            const bearing =
                i * 360 / rayCount;

            const p =
                destination(
                    r.lat,
                    r.lon,
                    CONFIG.reflectivityRange,
                    bearing
                );

            L.polyline(
                [
                    [r.lat,r.lon],
                    p
                ],
                {
                    renderer:renderer,

                    color:
                        CONFIG.colors.ray,

                    weight:0.55,

                    opacity:
                        CONFIG.opacity.ray,

                    interactive:false
                }
            ).addTo(
                rayLayer
            );

        }


        /* =========================================
           RADAR POINT
           ========================================= */

        const marker =
            L.circleMarker(
                [r.lat,r.lon],
                {
                    renderer:renderer,

                    radius:5,

                    color:
                        CONFIG.colors.radarBorder,

                    weight:1.4,

                    fillColor:
                        CONFIG.colors.radar,

                    fillOpacity:1,

                    bubblingMouseEvents:false
                }
            );

        marker.bindTooltip(
            r.name,
            {
                direction:"top",
                offset:[0,-5],
                opacity:0.95
            }
        );

        marker.bindPopup(
            "<b>ДМРЛ-С</b><br>" +
            r.name +
            "<br><br>" +
            "Зона обзора: 250 км" +
            "<br>" +
            "Doppler: 125 км"
        );

        marker.addTo(
            radarLayer
        );

    });

}


/* =========================================================
   BLIND SECTOR GEOMETRY
   ========================================================= */

function sectorPolygon(
    radar,
    startDistance,
    startBearing,
    endBearing
){

    const points = [];

    const step =
        Math.max(
            1,
            (
                endBearing -
                startBearing
            ) / 8
        );

    for(
        let a=startBearing;
        a<=endBearing+0.001;
        a+=step
    ){

        points.push(
            destination(
                radar.lat,
                radar.lon,
                CONFIG.reflectivityRange,
                a
            )
        );

    }

    /*
       Внутренняя граница.
    */

    const inner = [];

    for(
        let a=endBearing;
        a>=startBearing-0.001;
        a-=step
    ){

        inner.push(
            destination(
                radar.lat,
                radar.lon,
                startDistance,
                a
            )
        );

    }

    return [
        ...points,
        ...inner,
        [radar.lat,radar.lon]
    ];
}


/* =========================================================
   BLIND ZONE FOR ONE RADAR
   ========================================================= */

async function calculateBlindSectors(
    radar,
    token
){

    const map =
        mapRef;

    if(
        !map ||
        token !== renderToken
    )
        return [];

    const zoom =
        map.getZoom();

    /*
       На очень далёком масштабе
       расчёт blind sectors не нужен.
    */

    if(zoom < 5)
        return [];


    const azimuths =
        zoom >= 7
            ? CONFIG.fineAzimuths
            : CONFIG.coarseAzimuths;

    const step =
        zoom >= 7
            ? CONFIG.fineRangeStep
            : CONFIG.coarseRangeStep;


    /*
       Высота позиции радара.
    */

    const radarElevation =
        await elevationAt(
            radar.lat,
            radar.lon
        );

    if(
        radarElevation === null
    )
        return [];


    const result = [];


    for(
        let ai=0;
        ai<azimuths;
        ai++
    ){

        if(token !== renderToken)
            return [];

        const bearing =
            ai *
            360 /
            azimuths;


        let blockedFrom =
            null;


        /*
           Идём от радара наружу.
        */

        for(
            let distance=step;
            distance<=CONFIG.reflectivityRange;
            distance+=step
        ){

            if(token !== renderToken)
                return [];


            const p =
                destination(
                    radar.lat,
                    radar.lon,
                    distance,
                    bearing
                );


            const terrain =
                await elevationAt(
                    p[0],
                    p[1]
                );


            if(terrain === null)
                continue;


            /*
               Центр луча.
            */

            const center =
                beamHeight(
                    radarElevation,
                    distance
                );


            /*
               Нижний край луча.

               Ширина диаграммы ДМРЛ-С
               около 1°.
            */

            const halfBeam =
                CONFIG.beamWidthDeg *
                Math.PI /
                180 /
                2;

            const lowerBeam =
                center -
                distance *
                Math.tan(
                    halfBeam
                );


            /*
               Полное попадание рельефа
               в нижнюю часть луча.
            */

            if(
                terrain >
                center
            ){

                blockedFrom =
                    distance;

                break;

            }


            /*
               Частичное закрытие.
               Если рельеф выше нижнего края,
               сектор уже начинает терять
               низкую часть луча.
            */

            if(
                terrain >
                lowerBeam &&
                blockedFrom === null
            ){

                /*
                   Требуем хотя бы
                   несколько километров
                   реального экранирования.
                */

                if(
                    distance >=
                    CONFIG.minimumBlindDistance
                ){

                    blockedFrom =
                        distance;

                }

            }

        }


        if(
            blockedFrom !== null &&
            blockedFrom <
            CONFIG.reflectivityRange -
            step
        ){

            result.push({

                start:
                    blockedFrom,

                bearing:
                    bearing,

                width:
                    360 / azimuths

            });

        }

    }


    return result;
}


/* =========================================================
   MERGE NEIGHBOURING SECTORS
   ========================================================= */

function mergeSectors(
    sectors
){

    if(!sectors.length)
        return [];

    sectors.sort(
        (a,b) =>
            a.bearing -
            b.bearing
    );

    const merged = [];

    for(
        const sector of sectors
    ){

        const last =
            merged[
                merged.length-1
            ];

        if(
            last &&
            Math.abs(
                (
                    last.bearing +
                    last.width / 2
                ) -
                (
                    sector.bearing -
                    sector.width / 2
                )
            ) <= 1.5
        ){

            last.width +=
                sector.width;

            last.start =
                Math.min(
                    last.start,
                    sector.start
                );

        }else{

            merged.push({
                bearing:
                    sector.bearing,

                width:
                    sector.width,

                start:
                    sector.start
            });

        }

    }

    return merged;
}


/* =========================================================
   DRAW BLIND ZONES
   ========================================================= */

async function drawBlindZones(){

    if(
        !mapRef ||
        !enabled
    )
        return;


    const token =
        ++renderToken;


    blindLayer.clearLayers();


    const zoom =
        mapRef.getZoom();


    /*
       На z < 5 только покрытие.
    */

    if(zoom < 5)
        return;


    /*
       Берём только радары,
       находящиеся рядом с экраном.

       Это сильно снижает нагрузку
       на iPhone.
    */

    const bounds =
        mapRef.getBounds();

    const center =
        mapRef.getCenter();


    const visible =
        RADARS.filter(
            function(r){

                const p =
                    L.latLng(
                        r.lat,
                        r.lon
                    );

                if(
                    bounds.contains(p)
                )
                    return true;

                return (
                    distanceMeters(
                        center.lat,
                        center.lng,
                        r.lat,
                        r.lon
                    ) <
                    450000
                );

            }
        );


    const selected =
        visible.slice(
            0,
            CONFIG.maxBlindRadars
        );


    const renderer =
        L.canvas({
            padding:0.5
        });


    /*
       Считаем последовательно,
       чтобы не положить Safari.
    */

    for(
        const radar of selected
    ){

        if(token !== renderToken)
            return;


        const sectors =
            await calculateBlindSectors(
                radar,
                token
            );


        if(token !== renderToken)
            return;


        const merged =
            mergeSectors(
                sectors
            );


        for(
            const sector of merged
        ){

            /*
               Не рисуем совсем мелкие
               сектора.
            */

            if(
                sector.width <
                2
            )
                continue;


            const start =
                Math.max(
                    CONFIG.minimumBlindDistance,
                    sector.start
                );


            const polygon =
                sectorPolygon(
                    radar,
                    start,
                    sector.bearing -
                    sector.width / 2,

                    sector.bearing +
                    sector.width / 2
                );


            L.polygon(
                polygon,
                {
                    renderer:renderer,

                    color:
                        CONFIG.colors.blindBorder,

                    weight:0.6,

                    opacity:0.65,

                    fillColor:
                        CONFIG.colors.blind,

                    fillOpacity:
                        CONFIG.opacity.blind,

                    interactive:false
                }
            ).addTo(
                blindLayer
            );

        }

    }

}


/* =========================================================
   REDRAW
   ========================================================= */

function redraw(){

    if(!enabled)
        return;

    if(!mapRef)
        return;


    /*
       Сначала мгновенно показываем
       все радары и круги.
    */

    drawCoverage();


    /*
       Потом отдельно считаем blind zones.
       Они не блокируют интерфейс.
    */

    drawBlindZones();

}


/* =========================================================
   TOGGLE
   ========================================================= */

function toggle(){

    mapRef =
        getMap();

    if(!mapRef)
        return;


    enabled =
        !enabled;


    const item =
        document.querySelector(
            '#lp .it[data-k="coverage"]'
        );


    if(item){

        item.classList.toggle(
            "off",
            !enabled
        );

    }


    if(!enabled){

        renderToken++;

        if(rootLayer)
            rootLayer.remove();

        rootLayer = null;

        coverageLayer = null;
        velocityLayer = null;
        rayLayer = null;
        radarLayer = null;
        blindLayer = null;

        return;

    }


    rootLayer =
        L.layerGroup()
         .addTo(mapRef);


    coverageLayer =
        L.layerGroup()
         .addTo(rootLayer);


    velocityLayer =
        L.layerGroup()
         .addTo(rootLayer);


    rayLayer =
        L.layerGroup()
         .addTo(rootLayer);


    blindLayer =
        L.layerGroup()
         .addTo(rootLayer);


    radarLayer =
        L.layerGroup()
         .addTo(rootLayer);


    redraw();

}


/* =========================================================
   BUTTON
   ========================================================= */

function bindButton(){

    /*
       БЫЛО:
       getEl("li")

       ПРАВИЛЬНО:
       #lp
    */

    const item =
        document.querySelector(
            '#lp .it[data-k="coverage"]'
        );


    if(!item)
        return false;


    /*
       Capture=true нужен,
       чтобы старый обработчик
       слоёв index.html не перехватывал
       кнопку раньше нас.
    */

    if(item.__qmRadarBound)
        return true;


    item.__qmRadarBound = true;


    item.addEventListener(
        "click",
        function(e){

            e.preventDefault();
            e.stopPropagation();

            toggle();

        },
        true
    );


    return true;
}


/* =========================================================
   MAP EVENTS
   ========================================================= */

function bindMap(){

    mapRef =
        getMap();

    if(!mapRef)
        return false;


    if(mapRef.__qmRadarEvents)
        return true;


    mapRef.__qmRadarEvents = true;


    mapRef.on(
        "zoomend",
        function(){

            if(!enabled)
                return;

            /*
               Круги перерисовываем
               мгновенно.
            */

            drawCoverage();


            /*
               Отменяем старый
               расчёт blind zones.
            */

            renderToken++;


            /*
               Даём Leaflet закончить zoom.
            */

            setTimeout(
                function(){

                    if(enabled)
                        drawBlindZones();

                },
                120
            );

        }
    );


    mapRef.on(
        "moveend",
        function(){

            if(!enabled)
                return;

            renderToken++;

            setTimeout(
                function(){

                    if(enabled)
                        drawBlindZones();

                },
                150
            );

        }
    );


    return true;
}


/* =========================================================
   INIT
   ========================================================= */

function init(){

    if(initialized)
        return;


    initialized = true;


    /*
       Иногда index.html создаёт карту
       после загрузки этого файла.
    */

    let tries = 0;


    const timer =
        setInterval(
            function(){

                tries++;


                mapRef =
                    getMap();


                if(mapRef){

                    clearInterval(timer);

                    bindButton();

                    bindMap();

                    return;

                }


                if(tries > 100){

                    clearInterval(timer);

                }

            },
            100
        );


    /*
       Кнопка может появиться чуть позже
       самой карты.
    */

    const buttonTimer =
        setInterval(
            function(){

                if(
                    bindButton() ||
                    tries > 100
                ){

                    clearInterval(
                        buttonTimer
                    );

                }

            },
            150
        );

}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.RadarPoints = {

    toggle:toggle,

    render:redraw,

    clear:function(){

        enabled = false;

        renderToken++;

        if(rootLayer)
            rootLayer.remove();

        rootLayer = null;

    },

    get enabled(){

        return enabled;

    },

    get radars(){

        return RADARS.slice();

    }

};


/* =========================================================
   START
   ========================================================= */

if(
    document.readyState ===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        init
    );

}else{

    init();

}


})();
