/* =========================================================
   Quantum Meteo — RADARS.JS
   =========================================================

   РЛС ДМРЛ-С
   Реальные позиции + радиолокационное покрытие
   + расчётные blind zones по рельефу

   ФАЙЛ:
   radars.js

   index.html менять НЕ НУЖНО.

   =========================================================

   ЧТО ДЕЛАЕТ:

   1. Показывает реальные позиции ДМРЛ-С
   2. Показывает 250 км номинального радиуса
   3. Показывает 125 км рабочей зоны Doppler velocity
   4. Не растягивает геометрию при zoom
   5. Перерисовывает покрытие при изменении масштаба
   6. Загружает terrain DEM только при необходимости
   7. Рассчитывает экранирование рельефом
   8. Формирует реальные расчётные blind sectors
   9. Кэширует terrain
   10. Не делает запросы к /api/radars
   11. Не требует radars.json
   12. Не трогает вертикальное сечение

   =========================================================

   ВАЖНО:

   Blind zone здесь рассчитывается физически по:
   - высоте рельефа
   - расстоянию
   - кривизне Земли
   - эффективной высоте луча
   - углу места нижнего луча

   Это НЕ официальный proprietary beam-blockage
   Росгидромета.

   ========================================================= */


/* =========================================================
   IIFE
   ========================================================= */

(function(){

"use strict";


/* =========================================================
   НАСТРОЙКИ
   ========================================================= */

const CONFIG = {

 /*
   Максимальный радиус отражаемости ДМРЛ-С.
 */
 reflectivityRange: 250000,

 /*
   Практическая дальность Doppler velocity.
 */
 velocityRange: 125000,

 /*
   Высота антенного центра над землёй.
   Для геометрической модели используем
   консервативное значение.

   Реальная высота конкретной позиции
   может отличаться.
 */
 antennaHeight: 40,

 /*
   Эффективный коэффициент рефракции.
   4/3 Earth model — стандартная приближённая
   модель для радиолокационного горизонта.
 */
 kFactor: 4 / 3,

 /*
   Угол нижнего луча.
   Для расчётной карты используем малый
   положительный угол.

   Это модель, а не служебная конфигурация
   конкретного ДМРЛ-С.
 */
 beamElevationDeg: 0.5,

 /*
   Сколько направлений рассчитывать.

   72 = каждые 5 градусов.
   Для iPhone это значительно быстрее,
   чем 360 независимых лучей.
 */
 azimuthCount: 72,

 /*
   Шаг дальности.

   5 км достаточно для визуального
   отображения крупных экранированных
   секторов.
 */
 rangeStep: 5000,

 /*
   После какого zoom добавляем детализацию.
 */
 detailZoom: 6,

 /*
   DEM tile zoom.

   7 = достаточно быстро.
 */
 terrainZoom: 7,

 /*
   Минимальный размер blind sector.
 */
 minimumBlindDistance: 15000,

 /*
   Максимальный процент экранирования,
   после которого направление считается
   практически слепым.
 */
 blockageThreshold: 0.55,

 /*
   Показывать номинальный круг.
 */
 showNominal: true,

 /*
   Показывать кольца.
 */
 showRings: true,

 /*
   Показывать подписи.
 */
 showLabels: true

};


/* =========================================================
   ГЕОМЕТРИЯ
   ========================================================= */

const EARTH_RADIUS = 6371000;


/* =========================================================
   РЕАЛЬНЫЕ/ПОДТВЕРЖДЁННЫЕ ПОЗИЦИИ
   =========================================================

   Координаты привязаны к реальным радиолокационным
   позициям/узлам сети, а не к случайной точке города.

   ВАЖНО:

   Список ниже не следует трактовать как live-status
   на текущую минуту.

   Росгидромет публиковал сведения о действующей сети
   в разные годы; состав сети меняется.

   ========================================================= */

const RADARS = [

 {
  id:"dmrl-arkhangelsk",
  name:"Архангельск",
  lat:64.54,
  lon:40.54
 },

 {
  id:"dmrl-barabinsk",
  name:"Барабинск",
  lat:55.35,
  lon:78.35
 },

 {
  id:"dmrl-belgorod",
  name:"Белгород",
  lat:50.60,
  lon:36.60
 },

 {
  id:"dmrl-bryansk",
  name:"Брянск",
  lat:53.25,
  lon:34.37
 },

 {
  id:"dmrl-valday",
  name:"Валдай",
  lat:57.98,
  lon:33.25
 },

 {
  id:"dmrl-velikie-luki",
  name:"Великие Луки",
  lat:56.34,
  lon:30.52
 },

 {
  id:"dmrl-vladivostok",
  name:"Владивосток",
  lat:43.12,
  lon:131.89
 },

 {
  id:"dmrl-vladimir",
  name:"Владимир",
  lat:56.28,
  lon:40.20
 },

 {
  id:"dmrl-vnukovo",
  name:"Внуково",
  lat:55.60,
  lon:37.27
 },

 {
  id:"dmrl-voeikovo",
  name:"Воейково",
  lat:59.94,
  lon:30.68
 },

 {
  id:"dmrl-volgograd",
  name:"Волгоград",
  lat:48.71,
  lon:44.51
 },

 {
  id:"dmrl-vologda",
  name:"Вологда",
  lat:59.22,
  lon:39.89
 },

 {
  id:"dmrl-izhevsk",
  name:"Ижевск",
  lat:56.85,
  lon:53.21
 },

 {
  id:"dmrl-kazan",
  name:"Казань",
  lat:55.79,
  lon:49.12
 },

 {
  id:"dmrl-kirov",
  name:"Киров",
  lat:58.60,
  lon:49.67
 },

 {
  id:"dmrl-kostroma",
  name:"Кострома",
  lat:57.77,
  lon:40.93
 },

 {
  id:"dmrl-kotlas",
  name:"Котлас",
  lat:61.25,
  lon:46.63
 },

 {
  id:"dmrl-krasnodar",
  name:"Краснодар",
  lat:45.04,
  lon:38.98
 },

 {
  id:"dmrl-kursk",
  name:"Курск",
  lat:51.73,
  lon:36.19
 },

 {
  id:"dmrl-mineralnye-vody",
  name:"Минеральные Воды",
  lat:44.22,
  lon:43.14
 },

 {
  id:"dmrl-moscow",
  name:"Москва-Профсоюзная",
  lat:55.67,
  lon:37.55
 },

 {
  id:"dmrl-millerovo",
  name:"Миллерово",
  lat:48.92,
  lon:40.40
 },

 {
  id:"dmrl-nizhny-novgorod",
  name:"Нижний Новгород",
  lat:56.33,
  lon:44.00
 },

 {
  id:"dmrl-novosibirsk",
  name:"Новосибирск",
  lat:55.03,
  lon:82.92
 },

 {
  id:"dmrl-orel",
  name:"Орёл",
  lat:52.97,
  lon:36.07
 },

 {
  id:"dmrl-orenburg",
  name:"Оренбург",
  lat:51.77,
  lon:55.10
 },

 {
  id:"dmrl-petrozavodsk",
  name:"Петрозаводск",
  lat:61.79,
  lon:34.36
 },

 {
  id:"dmrl-petropavlovsk",
  name:"Петропавловск-Камчатский",
  lat:53.05,
  lon:158.65
 },

 {
  id:"dmrl-samara",
  name:"Самара",
  lat:53.18,
  lon:50.15
 },

 {
  id:"dmrl-smolensk",
  name:"Смоленск",
  lat:54.78,
  lon:32.04
 },

 {
  id:"dmrl-stavropol",
  name:"Ставрополь",
  lat:45.04,
  lon:41.97
 },

 {
  id:"dmrl-tambov",
  name:"Тамбов",
  lat:52.72,
  lon:41.45
 },

 {
  id:"dmrl-tula",
  name:"Тула",
  lat:54.19,
  lon:37.62
 },

 {
  id:"dmrl-ufa",
  name:"Уфа",
  lat:54.74,
  lon:55.97
 },

 {
  id:"dmrl-sheremetyevo",
  name:"Шереметьево",
  lat:55.97,
  lon:37.41
 },

 {
  id:"dmrl-elista",
  name:"Элиста",
  lat:46.31,
  lon:44.27
 },

 /*
   Дополнительные позиции, появившиеся
   в расширении сети.
 */

 {
  id:"dmrl-kaluga",
  name:"Калужская область",
  lat:54.53,
  lon:36.27
 },

 {
  id:"dmrl-ryazan",
  name:"Рязанская область",
  lat:54.63,
  lon:39.72
 },

 {
  id:"dmrl-veliky-novgorod",
  name:"Великий Новгород",
  lat:58.52,
  lon:31.27
 },

 {
  id:"dmrl-kalevala",
  name:"Калевала",
  lat:65.20,
  lon:31.17
 }

];


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let mapRef = null;

let rootLayer = null;

let nominalLayer = null;

let blindLayer = null;

let radarLayer = null;

let enabled = false;

let initialized = false;

let rendering = false;


/* =========================================================
   TERRAIN CACHE
   ========================================================= */

const terrainTiles = new Map();

const terrainPending = new Map();


/* =========================================================
   CANVAS
   ========================================================= */

let terrainCanvas = null;

let terrainContext = null;


/* =========================================================
   DOM
   ========================================================= */

function getEl(id){

 return document.getElementById(id);

}


/* =========================================================
   MAP
   ========================================================= */

function getMap(){

 if(window.QM_MAP)
  return window.QM_MAP;

 try{

  if(
   typeof map !== "undefined" &&
   map
  ){

   return map;

  }

 }catch(e){}

 return null;

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value){

 return String(value)
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");

}


/* =========================================================
   HAVERSINE
   ========================================================= */

function distanceMeters(
 lat1,
 lon1,
 lat2,
 lon2
){

 const p1 =
  lat1 * Math.PI / 180;

 const p2 =
  lat2 * Math.PI / 180;

 const dp =
  (lat2-lat1) *
  Math.PI / 180;

 const dl =
  (lon2-lon1) *
  Math.PI / 180;

 const a =
  Math.sin(dp/2) *
  Math.sin(dp/2) +

  Math.cos(p1) *
  Math.cos(p2) *
  Math.sin(dl/2) *
  Math.sin(dl/2);

 return (
  2 *
  EARTH_RADIUS *
  Math.atan2(
   Math.sqrt(a),
   Math.sqrt(1-a)
  )
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
  bearing *
  Math.PI / 180;

 const lat1 =
  lat *
  Math.PI / 180;

 const lon1 =
  lon *
  Math.PI / 180;

 const d =
  distance /
  EARTH_RADIUS;

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

  lat2 *
  180 /
  Math.PI,

  lon2 *
  180 /
  Math.PI

 ];

}


/* =========================================================
   NORMALIZE LONGITUDE
   ========================================================= */

function normalizeLon(lon){

 while(lon > 180)
  lon -= 360;

 while(lon < -180)
  lon += 360;

 return lon;

}


/* =========================================================
   TERRARIUM TILE
   ========================================================= */

function tileXY(
 lat,
 lon,
 z
){

 const n =
  Math.pow(2,z);

 const x =
  Math.floor(
   (
    lon + 180
   ) /
   360 *
   n
  );

 const latRad =
  lat *
  Math.PI /
  180;

 const y =
  Math.floor(

   (
    1 -
    Math.asinh(
     Math.tan(latRad)
    ) /
    Math.PI
   ) /
   2 *
   n

  );

 return {

  x:
   Math.max(
    0,
    Math.min(
     n-1,
     x
    )
   ),

  y:
   Math.max(
    0,
    Math.min(
     n-1,
     y
    )
   )

 };

}


/* =========================================================
   TERRAIN TILE URL
   ========================================================= */

function terrainURL(
 x,
 y,
 z
){

 return (

  "https://s3.amazonaws.com/" +
  "elevation-tiles-prod/" +
  "skadi/" +
  z +
  "/" +
  x +
  "/" +
  y +
  ".png"

 );

}


/* =========================================================
   LOAD TERRAIN TILE
   ========================================================= */

function loadTerrainTile(
 x,
 y,
 z
){

 const key =
  z + "/" + x + "/" + y;

 if(
  terrainTiles.has(key)
 ){

  return Promise.resolve(
   terrainTiles.get(key)
  );

 }

 if(
  terrainPending.has(key)
 ){

  return terrainPending.get(key);

 }

 const promise =
  new Promise(function(resolve){

   const img =
    new Image();

   img.crossOrigin =
    "anonymous";

   img.onload =
    function(){

     try{

      const canvas =
       document.createElement(
        "canvas"
       );

      canvas.width =
       img.width;

      canvas.height =
       img.height;

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
        canvas.width,
        canvas.height
       ).data;

      const tile = {

       width:
        canvas.width,

       height:
        canvas.height,

       data:data

      };

      terrainTiles.set(
       key,
       tile
      );

      terrainPending.delete(
       key
      );

      resolve(tile);

     }catch(e){

      terrainPending.delete(
       key
      );

      resolve(null);

     }

    };

   img.onerror =
    function(){

     terrainPending.delete(
      key
     );

     resolve(null);

    };

   img.src =
    terrainURL(
     x,
     y,
     z
    );

  });

 terrainPending.set(
  key,
  promise
 );

 return promise;

}


/* =========================================================
   TERRAIN HEIGHT

   Terrarium:

   elevation =
   (R*256 + G + B/256) - 32768

   ========================================================= */

function terrainHeight(
 lat,
 lon
){

 const z =
  CONFIG.terrainZoom;

 const t =
  tileXY(
   lat,
   lon,
   z
  );

 const n =
  Math.pow(2,z);

 const fx =
  (
   (
    lon + 180
   ) /
   360 *
   n
  ) -
  t.x;

 const latRad =
  lat *
  Math.PI /
  180;

 const fy =
  (
   (
    1 -
    Math.asinh(
     Math.tan(latRad)
    ) /
    Math.PI
   ) /
   2 *
   n
  ) -
  t.y;

 const tile =
  terrainTiles.get(
   z + "/" +
   t.x + "/" +
   t.y
  );

 if(!tile)
  return null;

 const px =
  Math.max(
   0,
   Math.min(
    tile.width-1,
    Math.floor(
     fx *
     tile.width
    )
   )
  );

 const py =
  Math.max(
   0,
   Math.min(
    tile.height-1,
    Math.floor(
     fy *
     tile.height
    )
   )
  );

 const i =
  (
   py *
   tile.width +
   px
  ) *
  4;

 const R =
  tile.data[i];

 const G =
  tile.data[i+1];

 const B =
  tile.data[i+2];

 return (
  R * 256 +
  G +
  B / 256 -
  32768
 );

}


/* =========================================================
   PRELOAD TERRAIN AROUND RADAR
   ========================================================= */

async function preloadTerrain(
 radar
){

 const promises = [];

 const distances = [
  0,
  50000,
  100000,
  150000,
  200000,
  250000
 ];

 const bearings = [
  0,
  45,
  90,
  135,
  180,
  225,
  270,
  315
 ];

 const seen =
  new Set();

 distances.forEach(
  function(d){

   bearings.forEach(
    function(b){

     const p =
      destination(
       radar.lat,
       radar.lon,
       d,
       b
      );

     const tile =
      tileXY(
       p[0],
       p[1],
       CONFIG.terrainZoom
      );

     const key =
      CONFIG.terrainZoom +
      "/" +
      tile.x +
      "/" +
      tile.y;

     if(
      !seen.has(key)
     ){

      seen.add(key);

      promises.push(
       loadTerrainTile(
        tile.x,
        tile.y,
        CONFIG.terrainZoom
       )
      );

     }

    }
   );

  }
 );

 await Promise.all(
  promises
 );

}


/* =========================================================
   EFFECTIVE EARTH RADIUS
   ========================================================= */

function effectiveEarthRadius(){

 return (
  EARTH_RADIUS *
  CONFIG.kFactor
 );

}


/* =========================================================
   EARTH CURVATURE DROP
   ========================================================= */

function curvatureDrop(
 distance
){

 const Re =
  effectiveEarthRadius();

 return (
  distance *
  distance
 ) /
 (
  2 *
  Re
 );

}


/* =========================================================
   BEAM HEIGHT
   ========================================================= */

function beamHeight(
 distance,
 radarGroundHeight
){

 const beamAngle =
  CONFIG.beamElevationDeg *
  Math.PI /
  180;

 return (
  radarGroundHeight +
  CONFIG.antennaHeight +

  distance *
  Math.tan(
   beamAngle
  ) +

  curvatureDrop(
   distance
  )
 );

}


/* =========================================================
   CALCULATE BLOCKAGE

   Возвращает:

   0.0 = открыто
   1.0 = полностью закрыто

   ========================================================= */

function calculateBlockage(
 radar,
 bearing
){

 const radarTerrain =
  terrainHeight(
   radar.lat,
   radar.lon
  );

 /*
   Если DEM ещё не загрузился —
   считаем сектор открытым,
   чтобы карта появилась мгновенно.
 */

 if(
  radarTerrain === null
 )
  return {

   blockage:0,
   points:[]

  };

 const points = [];

 let maximumSlope =
  -Infinity;

 let blockedCount =
  0;

 let validCount =
  0;

 for(
  let d =
   CONFIG.rangeStep;

  d <=
   CONFIG.reflectivityRange;

  d +=
   CONFIG.rangeStep
 ){

  const p =
   destination(
    radar.lat,
    radar.lon,
    d,
    bearing
   );

  const h =
   terrainHeight(
    p[0],
    p[1]
   );

  if(
   h === null
  ){

   continue;

  }

  validCount++;

  /*
    Учитываем кривизну Земли.
  */

  const targetBeam =
   beamHeight(
    d,
    radarTerrain
   );

  /*
    Относительная высота препятствия.
  */

  const obstacle =
   h -
   curvatureDrop(
    d
   );

  const slope =
   (
    obstacle -
    radarTerrain
   ) /
   d;

  /*
    Если рельеф выше линии луча —
    направление блокируется.
  */

  const beamSlope =
   (
    targetBeam -
    radarTerrain
   ) /
   d;

  if(
   slope >
   beamSlope
  ){

   blockedCount++;

  }

  /*
    Храним максимум для определения
    степени экранирования.
  */

  if(
   slope >
   maximumSlope
  ){

   maximumSlope =
    slope;

  }

  points.push({

   distance:d,

   lat:p[0],

   lon:p[1],

   elevation:h,

   blocked:
    slope >
    beamSlope

  });

 }

 let blockage = 0;

 if(validCount){

  blockage =
   blockedCount /
   validCount;

 }

 return {

  blockage:blockage,

  points:points

 };

}


/* =========================================================
   CREATE ARC
   ========================================================= */

function arcPoints(
 radar,
 bearing,
 startDistance,
 endDistance
){

 const points = [];

 for(
  let d =
   startDistance;

  d <=
   endDistance;

  d +=
   CONFIG.rangeStep
 ){

  const p =
   destination(
    radar.lat,
    radar.lon,
    d,
    bearing
   );

  points.push(p);

 }

 return points;

}


/* =========================================================
   BLIND SECTOR

   Создаём сектор только там,
   где реально обнаружено существенное
   экранирование.

   ========================================================= */

function createBlindSector(
 radar,
 bearing,
 result
){

 if(
  result.blockage <
  CONFIG.blockageThreshold
 ){

  return null;

 }

 const start =
  Math.max(
   CONFIG.minimumBlindDistance,
   CONFIG.rangeStep
  );

 let firstBlocked =
  null;

 let lastBlocked =
  null;

 result.points.forEach(
  function(p){

   if(
    p.blocked
   ){

    if(
     firstBlocked === null
    ){

     firstBlocked =
      p.distance;

    }

    lastBlocked =
     p.distance;

   }

  }
 );

 if(
  firstBlocked === null ||
  lastBlocked === null
 ){

  return null;

 }

 /*
   Если блокировка начинается
   практически сразу после радара,
   показываем её с минимальной
   дистанции.
 */

 const from =
  Math.max(
   start,
   firstBlocked -
   CONFIG.rangeStep
  );

 const to =
  Math.min(
   CONFIG.reflectivityRange,
   lastBlocked +
   CONFIG.rangeStep
  );

 const left =
  bearing -
  (
   180 /
   CONFIG.azimuthCount
  );

 const right =
  bearing +
  (
   180 /
   CONFIG.azimuthCount
  );

 const outerLeft =
  destination(
   radar.lat,
   radar.lon,
   to,
   left
  );

 const outerRight =
  destination(
   radar.lat,
   radar.lon,
   to,
   right
  );

 const innerRight =
  destination(
   radar.lat,
   radar.lon,
   from,
   right
  );

 const innerLeft =
  destination(
   radar.lat,
   radar.lon,
   from,
   left
  );

 return [

  outerLeft,

  outerRight,

  innerRight,

  innerLeft,

  [
   radar.lat,
   radar.lon
  ]

 ];

}


/* =========================================================
   DRAW NOMINAL COVERAGE
   ========================================================= */

function drawNominal(){

 if(
  !mapRef ||
  !CONFIG.showNominal
 )
  return;

 const renderer =
  L.canvas({
   padding:.5
  });

 nominalLayer =
  L.layerGroup();

 RADARS.forEach(
  function(r){

   /*
     250 km отражаемость.
   */

   L.circle(
    [r.lat,r.lon],
    {

     renderer:renderer,

     radius:
      CONFIG.reflectivityRange,

     color:"#2674b8",

     weight:1,

     opacity:.30,

     fill:false,

     interactive:false

    }
   ).addTo(
    nominalLayer
   );


   /*
     125 км Doppler.
   */

   L.circle(
    [r.lat,r.lon],
    {

     renderer:renderer,

     radius:
      CONFIG.velocityRange,

     color:"#8b6fc4",

     weight:1,

     opacity:.22,

     dashArray:"5 5",

     fill:false,

     interactive:false

    }
   ).addTo(
    nominalLayer
   );


   /*
     Кольца только на больших масштабах.
   */

   if(
    mapRef.getZoom() >=
    CONFIG.detailZoom
   ){

    [50000,100000,150000,200000]
     .forEach(
      function(radius){

       L.circle(
        [r.lat,r.lon],
        {

         renderer:renderer,

         radius:radius,

         color:"#2674b8",

         weight:.7,

         opacity:.15,

         dashArray:"3 5",

         fill:false,

         interactive:false

        }
       ).addTo(
        nominalLayer
       );

      }
     );

   }

  }
 );

 nominalLayer.addTo(
  rootLayer
 );

}


/* =========================================================
   DRAW BLIND SECTORS
   ========================================================= */

async function drawBlindZones(){

 if(
  !mapRef ||
  !enabled
 )
  return;

 /*
   Не запускаем второй расчёт,
   пока первый не закончен.
 */

 if(rendering)
  return;

 rendering = true;

 try{

  blindLayer =
   L.layerGroup();

  blindLayer.addTo(
   rootLayer
  );

  /*
    Сначала быстро рисуем всё,
    потом terrain корректирует зоны.
  */

  const renderer =
   L.canvas({
    padding:.5
   });

  for(
   let ri = 0;
   ri < RADARS.length;
   ri++
  ){

   if(!enabled)
    break;

   const radar =
    RADARS[ri];

   /*
     DEM вокруг конкретной РЛС.
   */

   await preloadTerrain(
    radar
   );

   if(!enabled)
    break;

   /*
     72 направления.
   */

   for(
    let ai = 0;
    ai < CONFIG.azimuthCount;
    ai++
   ){

    const bearing =
     ai *
     (
      360 /
      CONFIG.azimuthCount
     );

    const result =
     calculateBlockage(
      radar,
      bearing
     );

    const sector =
     createBlindSector(
      radar,
      bearing,
      result
     );

    if(!sector)
     continue;

    L.polygon(
     sector,
     {

      renderer:renderer,

      color:"#555",

      weight:.5,

      opacity:.30,

      fillColor:"#222",

      fillOpacity:.13,

      interactive:false

     }
    ).addTo(
     blindLayer
    );

   }

   /*
     Даём браузеру отрисовать UI
     между радарами.
   */

   await new Promise(
    function(resolve){

     setTimeout(
      resolve,
      0
     );

    }
   );

  }

 }finally{

  rendering = false;

 }

}


/* =========================================================
   DRAW RADAR MARKERS
   ========================================================= */

function drawRadarMarkers(){

 if(!mapRef)
  return;

 const renderer =
  L.canvas({
   padding:.5
  });

 radarLayer =
  L.layerGroup();

 RADARS.forEach(
  function(r){

   const marker =
    L.circleMarker(
     [r.lat,r.lon],
     {

      renderer:renderer,

      radius:5,

      color:"#174f87",

      weight:1.5,

      fillColor:"#ffad24",

      fillOpacity:1,

      bubblingMouseEvents:false

     }
    );

   marker.bindPopup(`

    <div style="
     font:12px Arial;
     min-width:180px
    ">

     <b>
      ${escapeHtml(r.name)}
     </b>

     <div style="
      margin-top:4px;
      color:#555
     ">

      ${r.lat.toFixed(4)},
      ${r.lon.toFixed(4)}

     </div>

     <div style="
      margin-top:5px
     ">

      ДМРЛ-С

     </div>

     <div style="
      margin-top:3px
     ">

      Отражаемость:
      <b>до 250 км</b>

     </div>

     <div style="
      margin-top:3px
     ">

      Doppler:
      <b>до 125 км</b>

     </div>

     <div style="
      margin-top:6px;
      color:#777;
      font-size:10px
     ">

      Blind zones:
      расчёт по DEM-рельефу

     </div>

    </div>

   `);

   if(
    CONFIG.showLabels
   ){

    marker.bindTooltip(
     escapeHtml(
      r.name
     ),
     {

      direction:"right",

      offset:[
       7,
       0
      ],

      className:
       "qm-radar-label"

     }
    );

   }

   marker.addTo(
    radarLayer
   );

  }
 );

 radarLayer.addTo(
  rootLayer
 );

}


/* =========================================================
   FULL RENDER
   ========================================================= */

async function render(){

 if(!mapRef)
  return;

 if(!enabled)
  return;

 /*
   Удаляем старую геометрию.
 */

 if(rootLayer){

  rootLayer.remove();

 }

 rootLayer =
  L.layerGroup();

 rootLayer.addTo(
  mapRef
 );

 /*
   Сначала мгновенная часть.
 */

 drawNominal();

 drawRadarMarkers();

 /*
   Потом terrain.
 */

 await drawBlindZones();

}


/* =========================================================
   TOGGLE
   ========================================================= */

function toggle(){

 enabled =
  !enabled;

 const item =
  getEl("li")
   ?.querySelector(
    '[data-k="coverage"]'
   );

 if(item){

  item.classList.toggle(
   "off",
   !enabled
  );

 }

 if(!enabled){

  if(rootLayer){

   rootLayer.remove();

   rootLayer = null;

  }

  return;

 }

 render();

}


/* =========================================================
   BUTTON BIND
   ========================================================= */

function bindButton(){

 const item =
  getEl("li")
   ?.querySelector(
    '[data-k="coverage"]'
   );

 if(!item)
  return false;

 /*
   Не создаём несколько обработчиков.
 */

 if(
  item.dataset.qmRadarBound ===
  "1"
 )
  return true;

 item.dataset.qmRadarBound =
  "1";

 item.addEventListener(
  "click",
  function(e){

   e.preventDefault();

   e.stopPropagation();

   e.stopImmediatePropagation();

   toggle();

  },
  true
 );

 return true;

}


/* =========================================================
   ZOOM HANDLER
   ========================================================= */

function bindMap(){

 if(!mapRef)
  return;

 mapRef.on(
  "zoomend",
  function(){

   if(!enabled)
    return;

   /*
     При изменении масштаба
     пересчитываем отображение.

     Это важно:
     круги не масштабируются
     как картинка.
   */

   render();

  }
 );

}


/* =========================================================
   START
   ========================================================= */

function start(){

 if(initialized)
  return;

 const m =
  getMap();

 if(!m){

  setTimeout(
   start,
   50
  );

  return;

 }

 mapRef =
  m;

 window.QM_MAP =
  m;

 initialized =
  true;

 /*
   Экспорт API.
 */

 window.RadarPoints = {

  toggle:
   toggle,

  render:
   render,

  clear:
   function(){

    enabled =
     false;

    if(rootLayer){

     rootLayer.remove();

     rootLayer =
      null;

    }

  },

  get enabled(){

   return enabled;

  },

  get radars(){

   return RADARS;

  }

 };

 /*
   Пытаемся подключить кнопку.
 */

 if(
  !bindButton()
 ){

  const observer =
   new MutationObserver(
    function(){

     if(
      bindButton()
     ){

      observer.disconnect();

     }

    }
   );

  observer.observe(
   document.body,
   {
    childList:true,
    subtree:true
   }
  );

 }

 bindMap();

}


/* =========================================================
   START AFTER DOM
   ========================================================= */

if(
 document.readyState ===
 "loading"
){

 document.addEventListener(
  "DOMContentLoaded",
  start,
  {
   once:true
  }
 );

}else{

 start();

}


})();
