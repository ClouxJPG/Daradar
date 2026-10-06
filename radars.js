/* =========================================================
   Quantum Meteo — Radar Points
   РЛС + номинальное покрытие + лучи

   ОТДЕЛЬНЫЙ ФАЙЛ

   Не содержит:
   - radar image renderer
   - timeline
   - Lightning
   - Vertical Section

   Работает через:
   /api/radars

   ВАЖНО:
   250 км — НОМИНАЛЬНЫЙ радиус.
   Это не карта реального terrain beam blockage.

   Реальные слепые зоны требуют:
   - высоты РЛС
   - параметров луча
   - рельефа / DEM
   - азимутальных данных блокировки
   ========================================================= */

(function(){

'use strict';

/* =========================================================
   НАСТРОЙКИ
   ========================================================= */

const RANGE=250000;

const RINGS=[
 50000,
 100000,
 150000,
 200000,
 250000
];

const BEAMS=[
 0,
 45,
 90,
 135,
 180,
 225,
 270,
 315
];

/*
   Главный слой всего покрытия
 */

let layer=null;

/*
   Список радаров
 */

let radars=[];

/*
   Состояние слоя
 */

let enabled=false;

/*
   Кэш точек
 */

let objects=[];

/* =========================================================
   ДОСТУП К ГЛОБАЛЬНЫМ ОБЪЕКТАМ
   ========================================================= */

function getMap(){

 return typeof map!=='undefined'
  ? map
  : null;
}

function getState(){

 return typeof S!=='undefined'
  ? S
  : null;
}

function getElement(id){

 return document.getElementById(id);
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

 const R=6371000;

 const br=
  bearing*Math.PI/180;

 const lat1=
  lat*Math.PI/180;

 const lon1=
  lon*Math.PI/180;

 const d=
  distance/R;

 const lat2=
  Math.asin(
   Math.sin(lat1)*Math.cos(d)+
   Math.cos(lat1)*Math.sin(d)*Math.cos(br)
  );

 const lon2=
  lon1+
  Math.atan2(
   Math.sin(br)*Math.sin(d)*Math.cos(lat1),
   Math.cos(d)-
   Math.sin(lat1)*Math.sin(lat2)
  );

 return [
  lat2*180/Math.PI,
  lon2*180/Math.PI
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

 const pts=[
  [lat,lon]
 ];

 /*
    Луч состоит из нескольких точек,
    поэтому на карте он выглядит естественно.
 */

 for(
  let d=25000;
  d<=RANGE;
  d+=25000
 ){

  pts.push(
   destination(
    lat,
    lon,
    d,
    bearing
   )
  );
 }

 return pts;
}

/* =========================================================
   ОЧИСТКА
   ========================================================= */

function clear(){

 if(layer){

  layer.clearLayers();
  layer.remove();

  layer=null;
 }

 objects=[];
}

/* =========================================================
   НАЗВАНИЕ РЛС
   ========================================================= */

function radarName(r){

 return (
  r.name||
  r.title||
  r.station||
  r.id||
  'РЛС'
 );
}

/* =========================================================
   ПОКАЗ ПОДПИСИ
   ========================================================= */

function updateLabels(){

 const m=getMap();

 if(!m)
  return;

 const z=m.getZoom();

 objects.forEach(o=>{

  if(
   !o.marker||
   !o.marker.getTooltip()
  )
   return;

  if(z>=6){

   if(
    !o.marker.isTooltipOpen()
   )
    o.marker.openTooltip();

  }else{

   if(
    o.marker.isTooltipOpen()
   )
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

 const m=getMap();

 if(!m||!radars.length)
  return;

 layer=
  L.layerGroup()
   .addTo(m);

 radars.forEach(r=>{

  const lat=
   Number(r.lat);

  const lon=
   Number(
    r.lon!=null?
    r.lon:
    r.lng
   );

  if(
   !Number.isFinite(lat)||
   !Number.isFinite(lon)
  )
   return;

  const name=
   radarName(r);

  /* =====================================================
     250 КМ — ОСНОВНАЯ ОБЛАСТЬ
     ===================================================== */

  const main=
   L.circle(
    [lat,lon],
    {
     radius:RANGE,

     color:'#2674b8',

     weight:1.2,

     opacity:.38,

     fillColor:'#4c9bd4',

     fillOpacity:.025,

     interactive:false
    }
   ).addTo(layer);

  /* =====================================================
     КОЛЬЦА
     ===================================================== */

  RINGS.forEach(dist=>{

   if(dist===RANGE)
    return;

   L.circle(
    [lat,lon],
    {
     radius:dist,

     color:'#2674b8',

     weight:1,

     opacity:.18,

     dashArray:'4 5',

     fill:false,

     interactive:false
    }
   ).addTo(layer);

  });

  /* =====================================================
     ЛУЧИ
     ===================================================== */

  BEAMS.forEach(angle=>{

   const line=
    L.polyline(
     beamPoints(
      lat,
      lon,
      angle
     ),
     {
      color:'#2674b8',

      weight:1,

      opacity:.20,

      dashArray:'3 6',

      interactive:false,

      smoothFactor:1
     }
    ).addTo(layer);

  });

  /* =====================================================
     ЦЕНТР РЛС
     ===================================================== */

  const marker=
   L.circleMarker(
    [lat,lon],
    {
     radius:5,

     color:'#174f87',

     weight:1.5,

     fillColor:'#ffad24',

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
     TOOLTIP
     ===================================================== */

  marker.bindTooltip(
   escapeHtml(name),
   {
    permanent:false,

    direction:'right',

    offset:[7,0],

    className:'qm-radar-label'
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
   HTML-БЕЗОПАСНОСТЬ
   ========================================================= */

function escapeHtml(value){

 return String(value)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#039;');
}

/* =========================================================
   ЗАГРУЗКА РЛС
   ========================================================= */

async function load(){

 const state=getState();

 if(!state||!state.api)
  return;

 try{

  const response=
   await fetch(
    state.api+'/api/radars'
   );

  if(!response.ok)
   throw new Error('radars');

  const data=
   await response.json();

  if(!Array.isArray(data))
   throw new Error('bad data');

  radars=data;

  /*
     Если слой уже включен —
     сразу обновляем.
   */

  if(enabled)
   render();

 }catch(e){

  /*
     Ошибка специально не выводится
     поверх карты.
   */

 }
}

/* =========================================================
   ПЕРЕКЛЮЧАТЕЛЬ
   ========================================================= */

function toggle(){

 enabled=!enabled;

 const item=
  getElement('li')
   ?.querySelector(
    '[data-k="coverage"]'
   );

 if(item){

  item.classList.toggle(
   'off',
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
   КЛИК ПО ПУНКТУ
   ========================================================= */

function bind(){

 const list=
  getElement('li');

 if(!list)
  return;

 list.addEventListener(
  'click',
  e=>{

   const item=
    e.target.closest(
     '[data-k="coverage"]'
    );

   if(!item)
    return;

   e.stopPropagation();

   toggle();
  }
 );
}

/* =========================================================
   ОБНОВЛЕНИЕ
   ========================================================= */

function update(){

 if(!enabled)
  return;

 /*
    При движении карты сами РЛС
    никуда не исчезают.

    Здесь обновляем только подписи.
 */

 updateLabels();
}

/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */

function start(){

 bind();

 load();
}

/* =========================================================
   PUBLIC API
   ========================================================= */

window.RadarPoints={

 setRadars(data){

  if(Array.isArray(data))
   radars=data;

  if(enabled)
   render();
 },

 update,

 toggle,

 render,

 clear,

 get enabled(){

  return enabled;
 }

};

/* =========================================================
   СТАРТ
   ========================================================= */

if(
 document.readyState==='loading'
){

 document.addEventListener(
  'DOMContentLoaded',
  start,
  {once:true}
 );

}else{

 start();
}

})();
