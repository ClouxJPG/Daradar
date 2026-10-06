/* =========================================================
   Quantum Meteo — Radar Points
   РЛС + номинальное покрытие + лучи

   ОТДЕЛЬНЫЙ ФАЙЛ: radars.js

   Главное:
   - не зависит от /api/radars
   - работает даже без radars.json
   - список РЛС уже есть в памяти
   - повторное включение мгновенное
   - слой создаётся один раз за включение
   - используется Canvas renderer для скорости
   ========================================================= */

(function(){

"use strict";

/* =========================================================
   НАСТРОЙКИ
   ========================================================= */

const RANGE = 250000;

const RINGS = [
  50000,
  100000,
  150000,
  200000
];

const BEAMS = [
  0,
  45,
  90,
  135,
  180,
  225,
  270,
  315
];


/* =========================================================
   БАЗОВЫЙ СПИСОК РЛС
   ========================================================= */

const FALLBACK_RADARS = [

 ["Архангельск",64.54,40.54],
 ["Барабинск",55.35,78.35],
 ["Белгород",50.60,36.60],
 ["Брянск",53.25,34.37],
 ["Валдай",57.98,33.25],
 ["Великие Луки",56.34,30.52],
 ["Владивосток",43.12,131.89],
 ["Владимир",56.13,40.41],
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
 ["Москва",55.68,37.56],
 ["Миллерово",48.92,40.40],
 ["Нижний Новгород",56.33,44.00],
 ["Новосибирск",55.03,82.92],
 ["Орёл",52.97,36.07],
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

].map(function(r,i){

 return {
  id:"dmrl-"+(i+1),
  name:r[0],
  lat:r[1],
  lon:r[2]
 };

});


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let mapRef = null;

let layer = null;

let enabled = false;

let radars = [];

let bound = false;


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
   DOM
   ========================================================= */

function el(id){

 return document.getElementById(id);

}


/* =========================================================
   HTML ESCAPE
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
   ГЕОГРАФИЯ
   ========================================================= */

function destination(
 lat,
 lon,
 distance,
 bearing
){

 const R = 6371000;

 const br =
  bearing * Math.PI / 180;

 const lat1 =
  lat * Math.PI / 180;

 const lon1 =
  lon * Math.PI / 180;

 const d =
  distance / R;

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

  lon2 * 180 / Math.PI

 ];

}


/* =========================================================
   ЛУЧ
   ========================================================= */

function beamPoints(
 lat,
 lon,
 bearing
){

 const points = [
  [lat,lon]
 ];

 for(
  let d = 50000;
  d <= RANGE;
  d += 50000
 ){

  points.push(
   destination(
    lat,
    lon,
    d,
    bearing
   )
  );

 }

 return points;

}


/* =========================================================
   ОЧИСТКА
   ========================================================= */

function clear(){

 if(layer){

  try{
   layer.remove();
  }catch(e){}

 }

 layer = null;

}


/* =========================================================
   РЕНДЕР
   ========================================================= */

function render(){

 if(!mapRef)
  return;

 if(!enabled)
  return;

 clear();

 /*
   Canvas значительно легче
   для большого количества
   кругов и линий на iPhone.
 */
 const renderer =
  L.canvas({
   padding:.5
  });

 layer =
  L.layerGroup().addTo(mapRef);


 radars.forEach(function(r){

  const lat =
   Number(
    r.lat ??
    r.latitude
   );

  const lon =
   Number(
    r.lon ??
    r.lng ??
    r.longitude
   );

  if(
   !Number.isFinite(lat) ||
   !Number.isFinite(lon)
  )
   return;


  const name =
   r.name ||
   r.title ||
   r.station ||
   r.id ||
   "РЛС";


  /* =====================================================
     ОСНОВНОЕ ПОКРЫТИЕ 250 КМ
     ===================================================== */

  L.circle(
   [lat,lon],
   {
    renderer:renderer,

    radius:RANGE,

    color:"#2674b8",

    weight:1.2,

    opacity:.45,

    fillColor:"#4c9bd4",

    fillOpacity:.025,

    interactive:false
   }
  ).addTo(layer);


  /* =====================================================
     ДОПОЛНИТЕЛЬНЫЕ КОЛЬЦА
     ===================================================== */

  RINGS.forEach(function(distance){

   L.circle(
    [lat,lon],
    {
     renderer:renderer,

     radius:distance,

     color:"#2674b8",

     weight:1,

     opacity:.20,

     dashArray:"4 5",

     fill:false,

     interactive:false
    }
   ).addTo(layer);

  });


  /* =====================================================
     ЛУЧИ
     ===================================================== */

  BEAMS.forEach(function(angle){

   L.polyline(
    beamPoints(
     lat,
     lon,
     angle
    ),
    {
     renderer:renderer,

     color:"#2674b8",

     weight:1,

     opacity:.24,

     dashArray:"3 6",

     interactive:false
    }
   ).addTo(layer);

  });


  /* =====================================================
     ТОЧКА РЛС
     ===================================================== */

  const marker =
   L.circleMarker(
    [lat,lon],
    {
     renderer:renderer,

     radius:5,

     color:"#174f87",

     weight:1.5,

     fillColor:"#ffad24",

     fillOpacity:1,

     bubblingMouseEvents:false
    }
   ).addTo(layer);


  /* =====================================================
     POPUP
     ===================================================== */

  marker.bindPopup(`

   <div style="
    font:12px Arial;
    min-width:155px;
   ">

    <b>
     ${escapeHtml(name)}
    </b>

    <div style="
     margin-top:4px;
     color:#555;
    ">
     ${lat.toFixed(3)},
     ${lon.toFixed(3)}
    </div>

    <div style="
     margin-top:4px;
    ">
     Номинальный радиус:
     <b>250 км</b>
    </div>

   </div>

  `);


  /* =====================================================
     ПОДПИСЬ
     ===================================================== */

  marker.bindTooltip(
   escapeHtml(name),
   {
    direction:"right",

    offset:[7,0],

    className:
     "qm-radar-label"
   }
  );

 });

}


/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ
   ========================================================= */

function toggle(){

 enabled =
  !enabled;

 const item =
  el("li")
   ?.querySelector(
    '[data-k="coverage"]'
   );

 if(item){

  item.classList.toggle(
   "off",
   !enabled
  );

 }

 if(enabled){

  render();

 }else{

  clear();

 }

}


/* =========================================================
   ПОДКЛЮЧЕНИЕ КНОПКИ
   ========================================================= */

function bind(){

 if(bound)
  return true;

 const item =
  el("li")
   ?.querySelector(
    '[data-k="coverage"]'
   );

 if(!item)
  return false;

 bound = true;


 /*
   Capture=true + stopImmediatePropagation:

   если в старом index.html
   случайно остался старый
   обработчик coverage,
   он не сможет сломать новый.
 */

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
   START
   ========================================================= */

function start(){

 const m =
  getMap();

 if(!m){

  setTimeout(
   start,
   25
  );

  return;

 }

 mapRef =
  m;

 window.QM_MAP =
  m;


 /*
   Если index.html уже
   предоставил точный список —
   используем его.
   Иначе мгновенно используем
   встроенный список.
 */

 if(
  Array.isArray(
   window.QM_RADARS
  ) &&
  window.QM_RADARS.length
 ){

  radars =
   window.QM_RADARS;

 }else{

  radars =
   FALLBACK_RADARS;

 }


 window.RadarPoints = {

  toggle:

   toggle,

  render:

   render,

  clear:

   clear,

  setRadars:

   function(data){

    if(
     Array.isArray(data) &&
     data.length
    ){

     radars =
      data;

     window.QM_RADARS =
      data;

     if(enabled)
      render();

    }

   },

  get enabled(){

   return enabled;

  },

  get radars(){

   return radars;

  }

 };


 /*
   Пытаемся привязать кнопку.
   Если панель создаётся чуть позже,
   повторяем только сам bind.
 */

 if(!bind()){

  const observer =
   new MutationObserver(
    function(){

     if(bind())
      observer.disconnect();

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


 /*
   При изменении масштаба
   просто обновляем Canvas.
 */

 m.on(
  "zoomend",
  function(){

   if(enabled &&
      layer){

    layer.bringToFront();

   }

  }
 );

}


if(
 document.readyState ===
 "loading"
){

 document.addEventListener(
  "DOMContentLoaded",
  start,
  {once:true}
 );

}else{

 start();

}

})();
