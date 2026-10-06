/* =========================================================
   Quantum Meteo — РЛС / зоны обзора

   ОТДЕЛЬНЫЙ ФАЙЛ
   index.html НЕ ЗАГРУЖАЕТ РАДАРНЫЕ ТОЧКИ В ОСНОВНОЙ КОД

   API:
   GET /api/radars

   Ожидается:
   [
     {
       id: "...",
       name: "...",
       lat: 55.75,
       lon: 37.61
     }
   ]

   ВАЖНО:
   250 км — НОМИНАЛЬНЫЙ радиус обзора.
   Это НЕ карта реальной радиолокационной видимости.
   Реальные слепые сектора требуют данных рельефа/блокировки луча.
   ========================================================= */

(() => {

'use strict';

/* =========================================================
   НАСТРОЙКИ
   ========================================================= */

const RADAR_API =
  (window.S && S.api)
    ? S.api
    : (localStorage.api || '');

const MAX_RANGE_KM = 250;

/* Показывать ли названия радаров */
const LABEL_ZOOM = 6;

/* Сколько радиальных лучей */
const RAY_COUNT = 12;

/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let radarData = [];

let radarLayer =
  L.layerGroup();

let radarVisible = false;

let radarObjects = [];

let radarSelected = null;

/* =========================================================
   СТИЛИ
   ========================================================= */

const style = document.createElement('style');

style.textContent = `
/* ---------------------------------------------------------
   Компактный пункт РЛС
   --------------------------------------------------------- */

#qm-radar-toggle{
 height:22px !important;
 line-height:21px !important;
 font-size:13px !important;
 padding-left:2px !important;
 white-space:nowrap;
 overflow:hidden;
}

#qm-radar-toggle i{
 width:15px !important;
 margin-right:2px !important;
 font-size:15px !important;
 line-height:15px !important;
}

#qm-radar-toggle.off{
 opacity:.38;
}

/* ---------------------------------------------------------
   Подписи радаров
   --------------------------------------------------------- */

.qm-radar-label{
 background:rgba(255,255,255,.82);
 border:1px solid #777;
 border-radius:3px;
 padding:1px 3px;
 box-shadow:0 1px 2px #0003;
 color:#222;
 font:bold 11px Arial;
 white-space:nowrap;
 pointer-events:none;
}

/* ---------------------------------------------------------
   Точка радара
   --------------------------------------------------------- */

.qm-radar-dot{
 width:10px;
 height:10px;
 border-radius:50%;
 background:#1769aa;
 border:2px solid #fff;
 box-shadow:
   0 0 0 1px #174f87,
   0 1px 3px #0006;
}

/* ---------------------------------------------------------
   Центральная антенна
   --------------------------------------------------------- */

.qm-radar-center{
 width:4px;
 height:4px;
 border-radius:50%;
 background:#ff8c18;
 border:1px solid #fff;
 box-shadow:0 0 2px #0008;
}

/* ---------------------------------------------------------
   Маленький popup
   --------------------------------------------------------- */

.qm-radar-popup{
 font:12px Arial;
 line-height:15px;
}

.qm-radar-popup b{
 font-size:13px;
}
`;

document.head.appendChild(style);

/* =========================================================
   ДОБАВЛЯЕМ ПУНКТ В СУЩЕСТВУЮЩУЮ ПАНЕЛЬ
   ========================================================= */

function addPanelItem(){

 const list =
  document.getElementById('li');

 if(!list)
  return;

 if(document.getElementById('qm-radar-toggle'))
  return;

 const item =
  document.createElement('div');

 item.id =
  'qm-radar-toggle';

 item.className =
  'it off';

 item.innerHTML =
  `<i style="
      color:#1769aa;
      font-style:normal;
      font-weight:bold;
    ">◉</i>РЛС`;

 list.appendChild(item);

 item.onclick = () => {

  radarVisible =
   !radarVisible;

  item.classList.toggle(
   'off',
   !radarVisible
  );

  if(radarVisible){

   radarLayer.addTo(map);

   renderRadars();

  }else{

   radarLayer.remove();

   radarSelected = null;
  }
 };
}

/* =========================================================
   ЗАГРУЗКА РАДАРОВ
   ========================================================= */

async function loadRadars(){

 if(!RADAR_API)
  return;

 try{

  const r =
   await fetch(
    `${RADAR_API}/api/radars`
   );

  if(!r.ok)
   throw new Error('radars');

  const j =
   await r.json();

  if(!Array.isArray(j))
   throw new Error('bad data');

  radarData =
   j.filter(r =>
    Number.isFinite(
     Number(r.lat)
    ) &&
    Number.isFinite(
     Number(r.lon)
    )
   );

  if(radarVisible)
   renderRadars();

 }catch(e){

  console.warn(
   'Quantum Meteo: не удалось загрузить РЛС',
   e
  );
 }
}

/* =========================================================
   РАСЧЁТ ТОЧЕК ЛУЧЕЙ
   ========================================================= */

function destination(
 lat,
 lon,
 bearing,
 distanceKm
){

 const R = 6371;

 const d =
  distanceKm / R;

 const br =
  bearing * Math.PI / 180;

 const p1 =
  lat * Math.PI / 180;

 const l1 =
  lon * Math.PI / 180;

 const p2 =
  Math.asin(
   Math.sin(p1) *
   Math.cos(d) +
   Math.cos(p1) *
   Math.sin(d) *
   Math.cos(br)
  );

 const l2 =
  l1 +
  Math.atan2(
   Math.sin(br) *
   Math.sin(d) *
   Math.cos(p1),
   Math.cos(d) -
   Math.sin(p1) *
   Math.sin(p2)
  );

 return [
  p2 * 180 / Math.PI,
  l2 * 180 / Math.PI
 ];
}

/* =========================================================
   СОЗДАНИЕ ЛУЧЕЙ
   ========================================================= */

function makeRays(r){

 const group =
  L.layerGroup();

 for(
  let i=0;
  i<RAY_COUNT;
  i++
 ){

  const angle =
   i *
   (360 / RAY_COUNT);

  const p =
   destination(
    Number(r.lat),
    Number(r.lon),
    angle,
    MAX_RANGE_KM
   );

  L.polyline(
   [
    [
     Number(r.lat),
     Number(r.lon)
    ],
    p
   ],
   {
    color:'#1769aa',
    weight:1,
    opacity:.16,
    dashArray:'3 6',
    interactive:false
   }
  ).addTo(group);
 }

 return group;
}

/* =========================================================
   КОЛЬЦА ДАЛЬНОСТИ
   ========================================================= */

function makeCoverage(r){

 const group =
  L.layerGroup();

 const ranges =
  [
   50,
   100,
   150,
   200,
   250
  ];

 ranges.forEach(km => {

  L.circle(
   [
    Number(r.lat),
    Number(r.lon)
   ],
   {
    radius:
     km * 1000,

    color:'#1769aa',

    weight:
     km === MAX_RANGE_KM
      ? 1.5
      : 1,

    opacity:
     km === MAX_RANGE_KM
      ? .30
      : .13,

    fill:false,

    dashArray:
     km === MAX_RANGE_KM
      ? '5 5'
      : '2 6',

    interactive:false
   }
  ).addTo(group);

 });

 return group;
}

/* =========================================================
   ЦЕНТРАЛЬНАЯ ТОЧКА
   ========================================================= */

function makeMarker(r){

 const marker =
  L.marker(
   [
    Number(r.lat),
    Number(r.lon)
   ],
   {
    icon:
     L.divIcon({
      className:'',
      html:
       `<div class="qm-radar-dot"></div>`,
      iconSize:[10,10],
      iconAnchor:[5,5]
     }),

    zIndexOffset:500
   }
  );

 marker.bindPopup(
  `<div class="qm-radar-popup">
    <b>${escapeHtml(
      r.name || 'Радиолокатор'
    )}</b><br>
    Радиус: ${MAX_RANGE_KM} км<br>
    Координаты:
    ${Number(r.lat).toFixed(3)},
    ${Number(r.lon).toFixed(3)}
   </div>`
 );

 marker.on(
  'click',
  () => {

   radarSelected =
    r.id;

   highlightRadar(r.id);
  }
 );

 return marker;
}

/* =========================================================
   ЭКРАНИРОВАНИЕ HTML
   ========================================================= */

function escapeHtml(v){

 return String(v)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'","&#039;");
}

/* =========================================================
   ПОДПИСЬ РАДАРА
   ========================================================= */

function makeLabel(r){

 return L.marker(
  [
   Number(r.lat),
   Number(r.lon)
  ],
  {
   icon:
    L.divIcon({
     className:
      'qm-radar-label',
     html:
      escapeHtml(
       r.name ||
       'РЛС'
      ),
     iconSize:null,
     iconAnchor:[
      -8,
      7
     ]
    }),

   interactive:false
  }
 );
}

/* =========================================================
   ОТРИСОВКА ВСЕХ РАДАРОВ
   ========================================================= */

function renderRadars(){

 if(!radarVisible)
  return;

 radarObjects.forEach(
  x=>x.remove()
 );

 radarObjects=[];

 radarData.forEach(r => {

  const coverage =
   makeCoverage(r);

  const rays =
   makeRays(r);

  const marker =
   makeMarker(r);

  radarLayer.addLayer(
   coverage
  );

  radarLayer.addLayer(
   rays
  );

  radarLayer.addLayer(
   marker
  );

  radarObjects.push(
   coverage,
   rays,
   marker
  );

  if(map.getZoom()>=LABEL_ZOOM){

   const label =
    makeLabel(r);

   radarLayer.addLayer(
    label
   );

   radarObjects.push(
    label
   );
  }

 });

 updateRadarAppearance();
}

/* =========================================================
   ВЫДЕЛЕНИЕ РАДАРА
   ========================================================= */

function highlightRadar(id){

 radarData.forEach(r => {

  const selected =
   r.id == id;

  /*
   Здесь намеренно не меняем
   основную карту.
   Выбранный радар просто
   получает более заметную
   границу.
   */

  radarObjects.forEach(obj => {

   if(
    obj instanceof L.Circle
   ){

    if(
     obj.getLatLng &&
     obj.getLatLng().lat ===
      Number(r.lat) &&
     obj.getLatLng().lng ===
      Number(r.lon)
    ){

     obj.setStyle({
      opacity:
       selected ? .55 : .13,

      weight:
       selected ? 2 : 1
     });
    }
   }

  });

 });
}

/* =========================================================
   АДАПТАЦИЯ ПРИ ZOOM
   ========================================================= */

function updateRadarAppearance(){

 if(!radarVisible)
  return;

 const z =
  map.getZoom();

 radarObjects.forEach(
  obj => {

   if(
    obj.getElement &&
    obj.getElement()
   ){

    const el =
     obj.getElement();

    if(
     el.classList &&
     el.classList.contains(
      'qm-radar-label'
     )
    ){

     el.style.display =
      z >= LABEL_ZOOM
       ? ''
       : 'none';
    }
   }

  }
 );
}

/* =========================================================
   MAP EVENTS
   ========================================================= */

if(typeof map !== 'undefined'){

 map.on(
  'zoomend',
  () => {

   if(
    radarVisible
   )
    renderRadars();

  }
 );

 map.on(
  'moveend',
  () => {

   if(
    radarVisible
   )
    updateRadarAppearance();

  }
 );
}

/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */

function initQuantumRadars(){

 addPanelItem();

 loadRadars();
}

/*
   Ждём создания карты и #li.
*/

if(
 document.readyState ===
 'loading'
){

 document.addEventListener(
  'DOMContentLoaded',
  initQuantumRadars
 );

}else{

 initQuantumRadars();

}

})();
