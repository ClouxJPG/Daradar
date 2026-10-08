/* =========================================================
   Quantum Meteo — ДМРЛ-С / РЛС и покрытие

   ТОЛЬКО ПОДТВЕРЖДЁННЫЕ КООРДИНАТЫ

   - index.html НЕ ИЗМЕНЯЕТСЯ
   - линейка НЕ ИЗМЕНЯЕТСЯ
   - Nowcast НЕ ЗАПРАШИВАЕТСЯ
   - fetch НЕ ИСПОЛЬЗУЕТСЯ
   - XMLHttpRequest НЕ ИСПОЛЬЗУЕТСЯ
   - WMS НЕ ИСПОЛЬЗУЕТСЯ
   - лучей НЕТ
   - колец НЕТ
   - секторов НЕТ
   ========================================================= */

const RADARS = [

  {
    id:"MSK",
    name:"Москва-Профсоюзная",
    lat:55.67,
    lon:37.55,
    range:250
  },

  {
    id:"VLA",
    name:"Владимир",
    lat:56.28,
    lon:40.20,
    range:250
  },

  {
    id:"KOS",
    name:"Кострома",
    lat:54.81,
    lon:41.02,
    range:250
  },

  {
    id:"SML",
    name:"Смоленск",
    lat:54.85,
    lon:32.00,
    range:250
  },

  {
    id:"TVE",
    name:"Тверь",
    lat:56.90,
    lon:35.92,
    range:250
  }

];


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let radarVisible = false;
let radarLayer = null;


/* =========================================================
   ПОЛУЧЕНИЕ КАРТЫ
   ========================================================= */

function getRadarMap(){

  try{

    if(
      typeof map !== "undefined" &&
      map
    ){

      return map;

    }

  }catch(e){}

  if(window.map){
    return window.map;
  }

  if(window._map){
    return window._map;
  }

  if(window.quantumMap){
    return window.quantumMap;
  }

  return null;
}


/* =========================================================
   ГРУППА
   ========================================================= */

function ensureRadarLayer(){

  const currentMap =
    getRadarMap();

  if(
    typeof L === "undefined" ||
    !currentMap
  ){

    return null;

  }

  if(!radarLayer){

    radarLayer =
      L.layerGroup();

  }

  return radarLayer;
}


/* =========================================================
   ИНФОРМАЦИЯ РЛС
   ========================================================= */

function radarPopup(r){

  return (

    "<div style=\""+
    "font:12px Arial;"+
    "line-height:18px;"+
    "min-width:160px"+
    "\">"+

    "<b style=\"font-size:14px\">"+
    "ДМРЛ-С"+
    "</b><br>"+

    "<b>"+
    r.name+
    "</b><br>"+

    "ID: "+
    r.id+
    "<br>"+

    "Широта: "+
    r.lat.toFixed(4)+
    "°"+
    "<br>"+

    "Долгота: "+
    r.lon.toFixed(4)+
    "°"+
    "<br>"+

    "Дальность: "+
    r.range+
    " км"+

    "</div>"

  );

}


/* =========================================================
   БЕЛАЯ ТОЧКА РЛС
   ========================================================= */

function createRadarPoint(r){

  const group =
    ensureRadarLayer();

  if(!group){
    return null;
  }


  const point =
    L.circleMarker(

      [
        r.lat,
        r.lon
      ],

      {

        radius:11,

        color:"#111",

        weight:3,

        opacity:1,

        fillColor:"#fff",

        fillOpacity:1,

        interactive:true

      }

    );


  point.bindPopup(

    radarPopup(r),

    {

      closeButton:true,

      autoPan:true,

      maxWidth:240

    }

  );


  point.bindTooltip(

    r.name,

    {

      direction:"top",

      offset:[
        0,
        -10
      ],

      opacity:.95

    }

  );


  point.addTo(group);


  return point;

}


/* =========================================================
   КРУГ ПОКРЫТИЯ
   ========================================================= */

function createCoverage(r){

  const group =
    ensureRadarLayer();

  if(!group){
    return null;
  }


  const circle =
    L.circle(

      [
        r.lat,
        r.lon
      ],

      {

        radius:
          r.range *
          1000,

        color:"#555",

        weight:1,

        opacity:.30,

        fillColor:"#777",

        fillOpacity:.018,

        interactive:false

      }

    );


  circle.addTo(group);


  return circle;

}


/* =========================================================
   РЛС
   ========================================================= */

function createRadar(r){

  /*
   * Только две вещи:
   *
   * 1. серое покрытие
   * 2. белая точка с чёрной обводкой
   */

  createCoverage(r);

  createRadarPoint(r);

}


/* =========================================================
   ОЧИСТКА
   ========================================================= */

function clearRadar(){

  if(radarLayer){

    radarLayer.clearLayers();

  }

}


/* =========================================================
   ОТРИСОВКА
   ========================================================= */

function drawRadar(){

  const currentMap =
    getRadarMap();

  const group =
    ensureRadarLayer();

  if(
    !currentMap ||
    !group
  ){

    return false;

  }


  clearRadar();


  RADARS.forEach(

    function(r){

      createRadar(r);

    }

  );


  if(
    !currentMap.hasLayer(group)
  ){

    group.addTo(currentMap);

  }


  return true;

}


/* =========================================================
   ВИДИМОСТЬ
   ========================================================= */

function setRadarVisible(enabled){

  radarVisible =
    !!enabled;


  const currentMap =
    getRadarMap();

  if(!currentMap){
    return;
  }


  const group =
    ensureRadarLayer();

  if(!group){
    return;
  }


  if(radarVisible){

    drawRadar();

  }else{

    if(
      currentMap.hasLayer(group)
    ){

      currentMap.removeLayer(group);

    }

  }

}


/* =========================================================
   TOGGLE
   ========================================================= */

function toggleRadar(){

  setRadarVisible(
    !radarVisible
  );

}


/* =========================================================
   UPDATE
   ========================================================= */

function updateRadar(){

  if(radarVisible){

    drawRadar();

  }

}


/* =========================================================
   API
   ========================================================= */

window.RadarPoints = {

  setRadars:function(data){

    if(
      !Array.isArray(data)
    ){

      return;

    }


    RADARS.length = 0;


    data.forEach(

      function(r){

        const lat =
          Number(r.lat);

        const lon =
          Number(r.lon);


        if(
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ){

          return;

        }


        RADARS.push({

          id:
            r.id ||
            "DMRL",

          name:
            r.name ||
            "ДМРЛ-С",

          lat:lat,

          lon:lon,

          range:
            Number(
              r.range_km ||
              r.range ||
              250
            )

        });

      }

    );


    updateRadar();

  },


  setVisible:
    setRadarVisible,


  toggle:
    toggleRadar,


  update:
    updateRadar,


  getRadars:function(){

    return RADARS.slice();

  },


  isVisible:function(){

    return radarVisible;

  }

};


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */

function initRadarLayer(){

  ensureRadarLayer();

}


if(
  document.readyState ===
  "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    initRadarLayer
  );

}else{

  initRadarLayer();

}
