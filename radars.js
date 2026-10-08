/* =========================================================
   Quantum Meteo — МЕТЕОРАД / ДМРЛ-С

   РЛС + зоны радиолокационного покрытия

   ГЛАВНОЕ:
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - линейка НЕ ИЗМЕНЯЕТСЯ
   - Nowcast НЕ ИСПОЛЬЗУЕТСЯ
   - fetch НЕ ИСПОЛЬЗУЕТСЯ
   - XMLHttpRequest НЕ ИСПОЛЬЗУЕТСЯ
   - WMS НЕ ИСПОЛЬЗУЕТСЯ
   - никаких лучей
   - никаких секторов
   - никаких внутренних колец
   - белая точка + чёрная обводка
   - серое покрытие
   - клик по РЛС показывает информацию

   Координаты:
   - часть подтверждена данными УГМС;
   - остальные геопривязаны по кадру МЕТЕОРАД,
     который предоставлен пользователем.
   ========================================================= */


/* =========================================================
   РЛС
   ========================================================= */

const RADARS = [

  /* -------------------------
     СЕВЕРО-ЗАПАД
     ------------------------- */

  {
    id:"RAVO",
    name:"Воейково",
    lat:59.944,
    lon:30.656,
    range:250
  },

  {
    id:"RUDP",
    name:"Петрозаводск",
    lat:61.78,
    lon:34.35,
    range:250
  },

  {
    id:"RUDP2",
    name:"Псков",
    lat:57.82,
    lon:28.30,
    range:250
  },

  {
    id:"RUWJ",
    name:"Великий Новгород",
    lat:58.52,
    lon:31.28,
    range:250
  },

  {
    id:"RUDL",
    name:"Смоленск",
    lat:54.85,
    lon:32.00,
    range:250
  },

  {
    id:"RUDB",
    name:"Брянск",
    lat:53.25,
    lon:34.37,
    range:250
  },


  /* -------------------------
     ЦЕНТР
     ------------------------- */

  {
    id:"RAVN",
    name:"Москва-Профсоюзная",
    lat:55.67,
    lon:37.55,
    range:250
  },

  {
    id:"RUDV",
    name:"Тверь",
    lat:56.90,
    lon:35.92,
    range:250
  },

  {
    id:"RATL",
    name:"Тула",
    lat:54.20,
    lon:37.62,
    range:250
  },

  {
    id:"RUMO",
    name:"Калуга",
    lat:54.50,
    lon:36.25,
    range:250
  },

  {
    id:"RAVO2",
    name:"Владимир",
    lat:56.28,
    lon:40.20,
    range:250
  },

  {
    id:"RUKO",
    name:"Кострома",
    lat:57.77,
    lon:40.93,
    range:250
  },

  {
    id:"RUDK",
    name:"Ярославль",
    lat:57.63,
    lon:39.87,
    range:250
  },

  {
    id:"RAKT",
    name:"Котлас",
    lat:61.25,
    lon:46.63,
    range:250
  },

  {
    id:"RUDX",
    name:"Архангельск",
    lat:64.54,
    lon:40.54,
    range:250
  },

  {
    id:"RUDV2",
    name:"Вологда",
    lat:59.22,
    lon:39.89,
    range:250
  },


  /* -------------------------
     ЦЕНТРАЛЬНЫЙ ЧЕРНОЗЕМНЫЙ РАЙОН
     ------------------------- */

  {
    id:"RAKU",
    name:"Курск",
    lat:51.73,
    lon:36.19,
    range:250
  },

  {
    id:"RABG",
    name:"Белгород",
    lat:50.60,
    lon:36.60,
    range:250
  },

  {
    id:"RAVR",
    name:"Воронеж",
    lat:51.67,
    lon:39.20,
    range:250
  },

  {
    id:"RATL2",
    name:"Липецк",
    lat:52.61,
    lon:39.59,
    range:250
  },

  {
    id:"RUTM",
    name:"Тамбов",
    lat:52.72,
    lon:41.45,
    range:250
  },

  {
    id:"RURY",
    name:"Рязань",
    lat:54.63,
    lon:39.73,
    range:250
  },


  /* -------------------------
     ПОВОЛЖЬЕ
     ------------------------- */

  {
    id:"RUDN",
    name:"Нижний Новгород",
    lat:56.33,
    lon:44.00,
    range:250
  },

  {
    id:"RUDZ",
    name:"Казань",
    lat:55.79,
    lon:49.12,
    range:250
  },

  {
    id:"RAKW",
    name:"Киров",
    lat:58.60,
    lon:49.67,
    range:250
  },

  {
    id:"RASM",
    name:"Самара",
    lat:53.20,
    lon:50.15,
    range:250
  },

  {
    id:"RASA",
    name:"Саратов",
    lat:51.53,
    lon:46.03,
    range:250
  },

  {
    id:"RAUL",
    name:"Ульяновск",
    lat:54.32,
    lon:48.40,
    range:250
  },

  {
    id:"RASA2",
    name:"Саранск",
    lat:54.18,
    lon:45.18,
    range:250
  },

  {
    id:"RUDI",
    name:"Ижевск",
    lat:56.85,
    lon:53.20,
    range:250
  },

  {
    id:"RUPR",
    name:"Пермь",
    lat:58.01,
    lon:56.25,
    range:250
  },


  /* -------------------------
     БАШКОРТОСТАН / УРАЛ
     ------------------------- */

  {
    id:"RUDU",
    name:"Уфа",
    lat:54.5567,
    lon:55.8750,
    range:250
  },

  {
    id:"RAOR",
    name:"Оренбург",
    lat:51.77,
    lon:55.10,
    range:250
  },

  {
    id:"RUEK",
    name:"Екатеринбург",
    lat:56.84,
    lon:60.61,
    range:250
  },

  {
    id:"RUCHE",
    name:"Челябинск",
    lat:55.16,
    lon:61.40,
    range:250
  },


  /* -------------------------
     ЮГ
     ------------------------- */

  {
    id:"RAYL",
    name:"Элиста",
    lat:46.31,
    lon:44.27,
    range:250
  },

  {
    id:"RUDG",
    name:"Волгоград",
    lat:48.71,
    lon:44.51,
    range:250
  },

  {
    id:"RAMI",
    name:"Миллерово",
    lat:48.93,
    lon:40.40,
    range:250
  },

  {
    id:"RAKD",
    name:"Краснодар",
    lat:45.04,
    lon:38.98,
    range:250
  },

  {
    id:"RUDT",
    name:"Ставрополь",
    lat:45.04,
    lon:41.97,
    range:250
  },

  {
    id:"RUDM",
    name:"Минеральные Воды",
    lat:44.21,
    lon:43.14,
    range:250
  },

  {
    id:"RACK",
    name:"Ростов-на-Дону",
    lat:47.24,
    lon:39.71,
    range:250
  },

  {
    id:"RANL",
    name:"Нальчик",
    lat:43.48,
    lon:43.60,
    range:250
  },

  {
    id:"RAIG",
    name:"Магас",
    lat:43.17,
    lon:44.81,
    range:250
  },

  {
    id:"RADG",
    name:"Дагестан",
    lat:42.98,
    lon:47.50,
    range:250
  }

];


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let radarVisible = false;

let radarLayer = null;


/* =========================================================
   ПОЛУЧЕНИЕ LEAFLET-КАРТЫ
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


  if(
    window.map &&
    typeof window.map.addLayer === "function"
  ){

    return window.map;

  }


  if(
    window._map &&
    typeof window._map.addLayer === "function"
  ){

    return window._map;

  }


  if(
    window.quantumMap &&
    typeof window.quantumMap.addLayer === "function"
  ){

    return window.quantumMap;

  }


  return null;

}


/* =========================================================
   СОЗДАНИЕ ГРУППЫ
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
   POPUP
   ========================================================= */

function radarPopup(r){

  return (

    '<div style="' +

    'font:12px Arial;' +
    'line-height:18px;' +
    'min-width:175px;' +

    '">' +

    '<b style="font-size:14px">' +
    'ДМРЛ-С' +
    '</b>' +

    '<br>' +

    '<b>' +
    r.name +
    '</b>' +

    '<hr style="' +
    'margin:4px 0;' +
    'border:0;' +
    'border-top:1px solid #bbb' +
    '">' +

    'ID: ' +
    r.id +

    '<br>' +

    'Широта: ' +
    Number(r.lat).toFixed(4) +
    '°' +

    '<br>' +

    'Долгота: ' +
    Number(r.lon).toFixed(4) +
    '°' +

    '<br>' +

    'Радиус покрытия: ' +
    r.range +
    ' км' +

    '<br>' +

    '<span style="' +
    'color:#777' +
    '">' +

    'Источник привязки: МЕТЕОРАД' +

    '</span>' +

    '</div>'

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

        radius:10,

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

      maxWidth:260

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
   СЕРАЯ ЗОНА ПОКРЫТИЯ
   ========================================================= */

function createCoverage(r){

  const group =
    ensureRadarLayer();


  if(!group){

    return null;

  }


  const coverage =
    L.circle(

      [
        r.lat,
        r.lon
      ],

      {

        radius:
          Number(r.range) *
          1000,

        color:"#555",

        weight:1,

        opacity:.28,

        fillColor:"#777",

        fillOpacity:.12,

        interactive:false

      }

    );


  coverage.addTo(group);


  return coverage;

}


/* =========================================================
   ОДНА РЛС
   ========================================================= */

function createRadar(r){

  /*
   * Сначала зона,
   * затем белая точка поверх неё.
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


  for(
    let i=0;
    i<RADARS.length;
    i++
  ){

    createRadar(
      RADARS[i]
    );

  }


  if(
    !currentMap.hasLayer(group)
  ){

    group.addTo(
      currentMap
    );

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

    drawRadar();

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


    for(
      let i=0;
      i<data.length;
      i++
    ){

      const r =
        data[i];


      const lat =
        Number(r.lat);


      const lon =
        Number(r.lon);


      if(
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ){

        continue;

      }


      RADARS.push({

        id:
          r.id ||
          ("DMRL-" + (i+1)),

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
