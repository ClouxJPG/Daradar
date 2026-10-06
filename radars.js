/* =========================================================
   Quantum Meteo — Radar Points
   РЛС + номинальное покрытие + лучи

   ОТДЕЛЬНЫЙ ФАЙЛ: radars.js

   Исправлено:
   - не зависит от порядка загрузки script
   - ждёт появления карты и состояния
   - использует уже загруженные РЛС из index.html
   - понимает массив и {radars:[...]}
   - если index ещё не загрузил РЛС — загружает сам
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
  200000,
  250000
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
   СОСТОЯНИЕ
   ========================================================= */

let layer = null;
let radars = [];
let enabled = false;
let objects = [];
let started = false;

/* =========================================================
   ПОЛУЧЕНИЕ MAP
   ========================================================= */

function getMap(){

  if(window.QM_MAP)
    return window.QM_MAP;

  try{
    if(typeof map !== "undefined")
      return map;
  }catch(e){}

  return null;
}

/* =========================================================
   ПОЛУЧЕНИЕ STATE
   ========================================================= */

function getState(){

  if(window.QM_STATE)
    return window.QM_STATE;

  try{
    if(typeof S !== "undefined")
      return S;
  }catch(e){}

  return null;
}

/* =========================================================
   HTML
   ========================================================= */

function getElement(id){
  return document.getElementById(id);
}

function escapeHtml(value){

  return String(value)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

/* =========================================================
   НАЗВАНИЕ РЛС
   ========================================================= */

function radarName(r){

  return (
    r.name ||
    r.title ||
    r.station ||
    r.id ||
    "РЛС"
  );
}

/* =========================================================
   КООРДИНАТЫ
   ========================================================= */

function radarLat(r){

  return Number(
    r.lat ??
    r.latitude
  );
}

function radarLon(r){

  return Number(
    r.lon ??
    r.lng ??
    r.longitude
  );
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
    let distance = 25000;
    distance <= RANGE;
    distance += 25000
  ){

    points.push(
      destination(
        lat,
        lon,
        distance,
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
      layer.clearLayers();
    }catch(e){}

    try{
      layer.remove();
    }catch(e){}

    layer = null;
  }

  objects = [];
}

/* =========================================================
   ПОДПИСИ
   ========================================================= */

function updateLabels(){

  const m = getMap();

  if(!m)
    return;

  const zoom =
    m.getZoom();

  objects.forEach(o=>{

    if(
      !o.marker ||
      !o.marker.getTooltip()
    )
      return;

    if(zoom >= 6){

      if(!o.marker.isTooltipOpen())
        o.marker.openTooltip();

    }else{

      if(o.marker.isTooltipOpen())
        o.marker.closeTooltip();

    }

  });

}

/* =========================================================
   РИСОВАНИЕ
   ========================================================= */

function render(){

  clear();

  if(!enabled)
    return;

  const m = getMap();

  if(!m)
    return;

  if(!Array.isArray(radars))
    return;

  if(!radars.length)
    return;

  layer =
    L.layerGroup().addTo(m);

  radars.forEach(r=>{

    const lat = radarLat(r);
    const lon = radarLon(r);

    if(
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    )
      return;

    const name =
      radarName(r);

    /* =====================================================
       ОСНОВНОЕ КОЛЬЦО 250 КМ
       ===================================================== */

    const main =
      L.circle(
        [lat,lon],
        {
          radius:RANGE,

          color:"#2674b8",

          weight:1.2,

          opacity:.42,

          fillColor:"#4c9bd4",

          fillOpacity:.025,

          interactive:false
        }
      ).addTo(layer);

    /* =====================================================
       ДОПОЛНИТЕЛЬНЫЕ КОЛЬЦА
       ===================================================== */

    RINGS.forEach(distance=>{

      if(distance === RANGE)
        return;

      L.circle(
        [lat,lon],
        {
          radius:distance,

          color:"#2674b8",

          weight:1,

          opacity:.22,

          dashArray:"4 5",

          fill:false,

          interactive:false
        }
      ).addTo(layer);

    });

    /* =====================================================
       РАДАРНЫЕ ЛУЧИ
       ===================================================== */

    BEAMS.forEach(angle=>{

      L.polyline(
        beamPoints(
          lat,
          lon,
          angle
        ),
        {
          color:"#2674b8",

          weight:1,

          opacity:.25,

          dashArray:"3 6",

          interactive:false,

          smoothFactor:1
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

        <b>${escapeHtml(name)}</b>

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

        <div style="
          margin-top:5px;
          color:#777;
          font-size:10px;
          line-height:12px;
        ">
          Круг и лучи показывают
          номинальную область обзора.
        </div>

      </div>
    `);

    /* =====================================================
       ПОДПИСЬ
       ===================================================== */

    marker.bindTooltip(
      escapeHtml(name),
      {
        permanent:false,
        direction:"right",
        offset:[7,0],
        className:"qm-radar-label"
      }
    );

    objects.push({
      marker,
      main
    });

  });

  updateLabels();
}

/* =========================================================
   ЗАГРУЗКА РЛС
   ========================================================= */

async function load(){

  const state = getState();

  /*
     Сначала проверяем, не загрузил ли
     список уже сам index.html.
  */

  if(
    Array.isArray(window.QM_RADARS) &&
    window.QM_RADARS.length
  ){

    radars =
      window.QM_RADARS;

    if(enabled)
      render();

    return true;
  }

  /*
     Получаем API после появления S.
  */

  const api =
    state?.api ||
    "";

  /*
     Если API пустой, пробуем
     относительный /api/radars.
  */

  const url =
    api
      ? api + "/api/radars"
      : "/api/radars";

  try{

    const response =
      await fetch(
        url,
        {
          cache:"no-store"
        }
      );

    if(!response.ok)
      throw new Error(
        "HTTP " + response.status
      );

    const data =
      await response.json();

    /*
       Поддерживаем разные варианты
       ответа API.
    */

    if(Array.isArray(data)){

      radars = data;

    }else if(
      Array.isArray(data.radars)
    ){

      radars = data.radars;

    }else if(
      Array.isArray(data.data)
    ){

      radars = data.data;

    }else{

      throw new Error(
        "Не найден массив РЛС"
      );
    }

    window.QM_RADARS =
      radars;

    if(enabled)
      render();

    return true;

  }catch(error){

    console.error(
      "Quantum Meteo radars.js:",
      error
    );

    return false;
  }
}

/* =========================================================
   ОЖИДАНИЕ ОСНОВНОГО ПРИЛОЖЕНИЯ
   ========================================================= */

function waitForApp(){

  const m = getMap();
  const s = getState();

  if(m){

    window.QM_MAP = m;
  }

  if(s){

    window.QM_STATE = s;
  }

  /*
     Когда map и S уже существуют,
     запускаем основной код.
  */

  if(
    getMap() &&
    getState()
  ){

    if(!started){

      started = true;

      bind();
      load();

      const mapObject =
        getMap();

      mapObject.on(
        "zoomend",
        updateLabels
      );

      mapObject.on(
        "moveend",
        updateLabels
      );

    }

    return;
  }

  /*
     Главное исправление:
     не выходим навсегда,
     а ждём index.html.
  */

  setTimeout(
    waitForApp,
    50
  );
}

/* =========================================================
   ПЕРЕКЛЮЧАТЕЛЬ
   ========================================================= */

function toggle(){

  enabled =
    !enabled;

  const item =
    getElement("li")
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

    if(!radars.length)
      load();

    render();

  }else{

    clear();
  }
}

/* =========================================================
   КЛИК
   ========================================================= */

function bind(){

  const list =
    getElement("li");

  if(!list)
    return;

  const item =
    list.querySelector(
      '[data-k="coverage"]'
    );

  if(!item)
    return;

  /*
     Не используем onclick,
     чтобы не конфликтовать
     с основным index.html.
  */

  item.addEventListener(
    "click",
    function(e){

      e.stopPropagation();

      toggle();

    }
  );

}

/* =========================================================
   PUBLIC API
   ========================================================= */

window.RadarPoints = {

  setRadars(data){

    if(
      Array.isArray(data)
    ){

      radars = data;

      window.QM_RADARS =
        radars;

      if(enabled)
        render();
    }

  },

  update:updateLabels,

  toggle,

  render,

  clear,

  get enabled(){
    return enabled;
  },

  get radars(){
    return radars;
  }

};

/* =========================================================
   START
   ========================================================= */

if(
  document.readyState === "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    waitForApp,
    {once:true}
  );

}else{

  waitForApp();
}

})();
