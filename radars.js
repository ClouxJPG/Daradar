/* =========================================================
   Quantum Meteo — radar stations
   РЛС ДМРЛ-С

   ГЛАВНОЕ:
   - без лучей
   - без линий от РЛС
   - без секторов
   - одна белая точка с чёрной обводкой
   - точка сама является кликабельной
   - покрытие отображается отдельным кругом
   ========================================================= */

(function(){

"use strict";

/* =========================================================
   ДАННЫЕ РЛС

   Координаты здесь используются для отображения на карте.
   Идентификаторы и названия соответствуют сети ДМРЛ-С.
   ========================================================= */

const RADARS = [

 {id:"RUDO", name:"Оренбург", lat:54.5567, lon:55.8750, range:250},

 {id:"RUDP", name:"Петрозаводск", lat:61.7898, lon:34.3469, range:250},

 {id:"RUTD", name:"Тамбов", lat:52.7212, lon:41.4523, range:250},

 {id:"RUDX", name:"Архангельск", lat:64.5393, lon:40.5187, range:250},

 {id:"RAVO", name:"Воейково", lat:59.9440, lon:30.6560, range:250},

 {id:"RAKT", name:"Котлас", lat:61.2529, lon:46.6333, range:250},

 {id:"RUDB", name:"Брянск", lat:53.2434, lon:34.3642, range:250},

 {id:"RUDV", name:"Вологда", lat:59.2205, lon:39.8915, range:250},

 {id:"RUDG", name:"Волгоград", lat:48.7080, lon:44.5133, range:250},

 {id:"RATL", name:"Тула", lat:54.1961, lon:37.6182, range:250},

 {id:"RAKD", name:"Краснодар", lat:45.0355, lon:38.9753, range:250},

 {id:"RUDT", name:"Ставрополь", lat:45.0445, lon:41.9691, range:250},

 {id:"RUWJ", name:"Валдай", lat:57.9826, lon:33.2514, range:250},

 {id:"RAMI", name:"Миллерово", lat:48.9258, lon:40.3983, range:250},

 {id:"RAVN", name:"Внуково", lat:55.5960, lon:37.2670, range:250},

 {id:"RAKU", name:"Курск", lat:51.7304, lon:36.1926, range:250},

 {id:"RUDI", name:"Ижевск", lat:56.8527, lon:53.2115, range:250},

 {id:"RAYL", name:"Элиста", lat:46.3078, lon:44.2558, range:250},

 {id:"RUDL", name:"Смоленск", lat:54.7826, lon:32.0453, range:250},

 {id:"RASM", name:"Самара", lat:53.1959, lon:50.1002, range:250},

 {id:"RABG", name:"Белгород", lat:50.5956, lon:36.5873, range:250},

 {id:"RUDM", name:"Минеральные Воды", lat:44.2103, lon:43.1353, range:250},

 {id:"RUDK", name:"Кострома", lat:57.7679, lon:40.9269, range:250},

 {id:"RUDZ", name:"Казань", lat:55.7879, lon:49.1233, range:250},

 {id:"RAVL", name:"Великие Луки", lat:56.3428, lon:30.5150, range:250},

 {id:"RUDU", name:"Уфа", lat:54.5567, lon:55.8750, range:250},

 {id:"RUDN", name:"Нижний Новгород", lat:56.2965, lon:43.9361, range:250},

 {id:"RAKW", name:"Киров", lat:58.6036, lon:49.6680, range:250}

];


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let radarData = RADARS.slice();

let visible = false;

let stationLayer = null;
let coverageLayer = null;


/* =========================================================
   СОЗДАНИЕ СЛОЁВ
   ========================================================= */

function ensureLayers(){

 if(typeof window.map==="undefined" || !window.map){
  return false;
 }

 if(!stationLayer){
  stationLayer = L.layerGroup();
 }

 if(!coverageLayer){
  coverageLayer = L.layerGroup();
 }

 return true;
}


/* =========================================================
   РАСЧЁТ РАДИУСА
   ========================================================= */

function getRange(r){

 const n = Number(r.range);

 if(!Number.isFinite(n) || n<=0){
  return 250;
 }

 return n;
}


/* =========================================================
   POPUP
   ========================================================= */

function popupHTML(r){

 const lat =
  Number(r.lat).toFixed(5);

 const lon =
  Number(r.lon).toFixed(5);

 const range =
  getRange(r);

 return `
  <div style="
   min-width:175px;
   font:12px Arial;
   line-height:17px;
  ">

   <div style="
    font:bold 14px Arial;
    margin-bottom:4px;
   ">
    ${escapeHTML(r.name)}
   </div>

   <div>
    <b>РЛС:</b> ${escapeHTML(r.id)}
   </div>

   <div>
    <b>Координаты:</b><br>
    ${lat}°, ${lon}°
   </div>

   <div>
    <b>Дальность:</b> ${range} км
   </div>

  </div>
 `;
}


/* =========================================================
   БЕЗОПАСНЫЙ ТЕКСТ
   ========================================================= */

function escapeHTML(value){

 return String(value ?? "")
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#039;");

}


/* =========================================================
   СОЗДАНИЕ РЛС
   ========================================================= */

function createRadar(r){

 if(!ensureLayers()){
  return;
 }


 /* ---------------------------------------------------------
    КРУГ ПОКРЫТИЯ

    Никаких лучей.
    Никаких полигонов.
    Никаких секторов.
    --------------------------------------------------------- */

 const coverage =
  L.circle(
   [r.lat,r.lon],
   {
    radius:getRange(r)*1000,

    color:"#222",

    weight:1,

    opacity:0.45,

    fillColor:"#ffffff",

    fillOpacity:0.04,

    interactive:false
   }
  );


 coverageLayer.addLayer(coverage);


 /* ---------------------------------------------------------
    ОСНОВНАЯ ТОЧКА РЛС

    Именно эта точка кликабельна.
    --------------------------------------------------------- */

 const point =
  L.circleMarker(
   [r.lat,r.lon],
   {
    radius:11,

    color:"#000",

    weight:3,

    opacity:1,

    fillColor:"#fff",

    fillOpacity:1,

    interactive:true,

    bubblingMouseEvents:false
   }
  );


 point.bindPopup(
  popupHTML(r),
  {
   closeButton:true,

   autoPan:true,

   autoPanPadding:[20,20]
  }
 );


 point.on(
  "click",
  function(e){

   if(
    e &&
    e.originalEvent
   ){

    L.DomEvent.stopPropagation(
     e.originalEvent
    );

   }

   this.openPopup();

  }
 );


 stationLayer.addLayer(point);

}


/* =========================================================
   ОЧИСТКА
   ========================================================= */

function clearLayers(){

 if(stationLayer){

  stationLayer.clearLayers();

 }

 if(coverageLayer){

  coverageLayer.clearLayers();

 }

}


/* =========================================================
   ОТРИСОВКА
   ========================================================= */

function update(){

 if(!ensureLayers()){
  return;
 }

 clearLayers();

 if(!visible){

  if(window.map.hasLayer(stationLayer)){
   window.map.removeLayer(stationLayer);
  }

  if(window.map.hasLayer(coverageLayer)){
   window.map.removeLayer(coverageLayer);
  }

  return;
 }


 for(
  let i=0;
  i<radarData.length;
  i++
 ){

  createRadar(
   radarData[i]
  );

 }


 if(!window.map.hasLayer(coverageLayer)){

  coverageLayer.addTo(
   window.map
  );

 }


 if(!window.map.hasLayer(stationLayer)){

  stationLayer.addTo(
   window.map
  );

 }

}


/* =========================================================
   VISIBILITY
   ========================================================= */

function setVisible(state){

 visible =
  Boolean(state);

 update();

}


function toggle(){

 visible =
  !visible;

 update();

 return visible;

}


/* =========================================================
   УСТАНОВКА ДАННЫХ С СЕРВЕРА
   ========================================================= */

function setRadars(data){

 if(!Array.isArray(data)){
  return;
 }


 radarData =
  data
   .filter(function(r){

    return r &&
      Number.isFinite(
       Number(r.lat)
      ) &&
      Number.isFinite(
       Number(r.lon)
      );

   })
   .map(function(r){

    return {

     id:
      r.id ||
      "RADAR",

     name:
      r.name ||
      r.id ||
      "РЛС",

     lat:
      Number(r.lat),

     lon:
      Number(r.lon),

     range:
      Number(r.range_km) ||
      Number(r.range) ||
      250

    };

   });


 update();

}


/* =========================================================
   ПУБЛИЧНЫЙ API
   ========================================================= */

window.RadarPoints = {

 RADARS:radarData,

 setRadars:setRadars,

 setVisible:setVisible,

 toggle:toggle,

 update:update,

 getVisible:function(){

  return visible;

 }

};


/* =========================================================
   АВТОЗАПУСК
   ========================================================= */

function boot(){

 if(
  typeof window.map==="undefined" ||
  !window.map
 ){

  setTimeout(
   boot,
   100
  );

  return;

 }

 update();

}


if(
 document.readyState===
 "loading"
){

 document.addEventListener(
  "DOMContentLoaded",
  boot
 );

}else{

 boot();

}


})();
