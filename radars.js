/* =========================================================
   Quantum Meteo — точки РЛС МЕТЕОРАД

   ВАЖНО:
   - точки получены непосредственно из кадра МЕТЕОРАД
   - НЕ используются координаты городов
   - НЕ используются старые 28 РЛС
   - НЕ используется Nowcast
   - НЕ используется fetch
   - НЕ используется WMS
   - НЕ создаются искусственные круги покрытия
   - НЕ создаются лучи
   - НЕ создаются сектора

   Сейчас отображаются ТОЛЬКО точки РЛС.
   ========================================================= */


/* =========================================================
   ТОЧКИ ИЗ КАДРА МЕТЕОРАД
   ========================================================= */

const RADARS = [

  {
    id:"DMRL-01",
    name:"ДМРЛ-С",
    lat:55.45,
    lon:37.73
  },

  {
    id:"DMRL-02",
    name:"ДМРЛ-С",
    lat:60.68,
    lon:36.95
  },

  {
    id:"DMRL-03",
    name:"ДМРЛ-С",
    lat:51.89,
    lon:56.11
  },

  {
    id:"DMRL-04",
    name:"ДМРЛ-С",
    lat:63.10,
    lon:38.76
  },

  {
    id:"DMRL-05",
    name:"ДМРЛ-С",
    lat:45.73,
    lon:31.92
  },

  {
    id:"DMRL-06",
    name:"ДМРЛ-С",
    lat:47.85,
    lon:34.69
  },

  {
    id:"DMRL-07",
    name:"ДМРЛ-С",
    lat:46.53,
    lon:49.30
  },

  {
    id:"DMRL-08",
    name:"ДМРЛ-С",
    lat:42.14,
    lon:46.23
  },

  {
    id:"DMRL-09",
    name:"ДМРЛ-С",
    lat:57.45,
    lon:61.28
  },

  {
    id:"DMRL-10",
    name:"ДМРЛ-С",
    lat:57.86,
    lon:38.78
  },

  {
    id:"DMRL-11",
    name:"ДМРЛ-С",
    lat:51.22,
    lon:29.54
  },

  {
    id:"DMRL-12",
    name:"ДМРЛ-С",
    lat:61.12,
    lon:36.37
  },

  {
    id:"DMRL-13",
    name:"ДМРЛ-С",
    lat:46.38,
    lon:34.81
  },

  {
    id:"DMRL-14",
    name:"ДМРЛ-С",
    lat:46.46,
    lon:45.24
  },

  {
    id:"DMRL-15",
    name:"ДМРЛ-С",
    lat:60.75,
    lon:50.20
  },

  {
    id:"DMRL-16",
    name:"ДМРЛ-С",
    lat:46.38,
    lon:28.82
  },

  {
    id:"DMRL-17",
    name:"ДМРЛ-С",
    lat:40.85,
    lon:46.38
  },

  {
    id:"DMRL-18",
    name:"ДМРЛ-С",
    lat:66.55,
    lon:39.46
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

  return null;

}


/* =========================================================
   СЛОЙ
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
   ИНФОРМАЦИЯ О РЛС
   ========================================================= */

function radarPopup(r){

  return (

    '<div style="' +
    'font:13px Arial;' +
    'line-height:19px;' +
    'min-width:150px;' +
    '">' +

    '<b style="font-size:14px">' +
    'ДМРЛ-С' +
    '</b>' +

    '<br>' +

    'ID: ' +
    r.id +

    '<br>' +

    'Широта: ' +
    r.lat.toFixed(2) +
    '°' +

    '<br>' +

    'Долгота: ' +
    r.lon.toFixed(2) +
    '°' +

    '</div>'

  );

}


/* =========================================================
   ТОЧКА РЛС

   Именно такой вид:
   БЕЛЫЙ КРУГ
   ЧЁРНАЯ ОБВОДКА
   БЕЗ ЧЁРНОЙ ТОЧКИ ВНУТРИ
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

        radius:8,

        color:"#000",

        weight:2,

        opacity:1,

        fillColor:"#fff",

        fillOpacity:1,

        interactive:true

      }

    );


  /* =======================================================
     КЛИК ПО ТОЧКЕ
     ======================================================= */

  point.bindPopup(

    radarPopup(r),

    {

      closeButton:true,

      autoPan:true,

      maxWidth:240

    }

  );


  point.addTo(group);


  return point;

}


/* =========================================================
   ОТРИСОВКА ВСЕХ ТОЧЕК
   ========================================================= */

function drawRadarPoints(){

  const currentMap =
    getRadarMap();

  const group =
    ensureRadarLayer();


  if(
    !currentMap ||
    !group
  ){

    return;

  }


  group.clearLayers();


  RADARS.forEach(

    function(r){

      createRadarPoint(r);

    }

  );


  if(
    !currentMap.hasLayer(group)
  ){

    group.addTo(
      currentMap
    );

  }

}


/* =========================================================
   ВКЛ / ВЫКЛ
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

    drawRadarPoints();

  }else{

    if(
      currentMap.hasLayer(group)
    ){

      currentMap.removeLayer(
        group
      );

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

    drawRadarPoints();

  }

}


/* =========================================================
   API ДЛЯ index.html
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

      function(r,i){

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
            ("DMRL-" + (i+1)),

          name:
            r.name ||
            "ДМРЛ-С",

          lat:lat,

          lon:lon

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

function initRadarPoints(){

  ensureRadarLayer();

}


if(
  document.readyState ===
  "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    initRadarPoints
  );

}else{

  initRadarPoints();

}
