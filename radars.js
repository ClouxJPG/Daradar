/* =========================================================
   Quantum Meteo — ДМРЛ-С / РЛС и покрытие

   ВАЖНО:
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - ЛИНЕЙКА НЕ ИЗМЕНЯЕТСЯ
   - Nowcast НЕ ЗАПРАШИВАЕТСЯ
   - fetch НЕ ИСПОЛЬЗУЕТСЯ
   - XMLHttpRequest НЕ ИСПОЛЬЗУЕТСЯ
   - WMS НЕ ИСПОЛЬЗУЕТСЯ
   - таймеров нет

   РЛС:
   RUDO RUDP RUTD RUDX RAVO RAKT RUDB RUDV
   RUDG RATL RAKD RUDT RUWJ RAMI RAVN RAKU
   RUDI RAYL RUDL RASM RABG RUDM RUDK RUDZ
   RAVL RUDU RUDN RAKW

   ОТОБРАЖЕНИЕ:
   - белая точка
   - чёрная обводка
   - точка кликабельна
   - круг покрытия
   - НИКАКИХ ЛУЧЕЙ
   - НИКАКИХ СЕКТОРОВ
   - НИКАКИХ ЛИНИЙ ВНУТРИ ПОКРЫТИЯ
   ========================================================= */


/* =========================================================
   РЛС
   ========================================================= */

const RADARS = [

  {
    id:"RUDO",
    name:"Оренбург",
    lat:51.7700,
    lon:55.1000,
    range:250
  },

  {
    id:"RUDP",
    name:"Петрозаводск",
    lat:61.7800,
    lon:34.3500,
    range:250
  },

  {
    id:"RUTD",
    name:"Тамбов",
    lat:52.7200,
    lon:41.4500,
    range:250
  },

  {
    id:"RUDX",
    name:"Архангельск",
    lat:64.5400,
    lon:40.5400,
    range:250
  },

  {
    id:"RAVO",
    name:"Воейково",
    lat:59.9440,
    lon:30.6560,
    range:250
  },

  {
    id:"RAKT",
    name:"Котлас",
    lat:61.2500,
    lon:46.6300,
    range:250
  },

  {
    id:"RUDB",
    name:"Брянск",
    lat:53.2500,
    lon:34.3700,
    range:250
  },

  {
    id:"RUDV",
    name:"Вологда",
    lat:59.2200,
    lon:39.8900,
    range:250
  },

  {
    id:"RUDG",
    name:"Волгоград",
    lat:48.7100,
    lon:44.5100,
    range:250
  },

  {
    id:"RATL",
    name:"Тула",
    lat:54.2000,
    lon:37.6200,
    range:250
  },

  {
    id:"RAKD",
    name:"Краснодар",
    lat:45.0400,
    lon:38.9800,
    range:250
  },

  {
    id:"RUDT",
    name:"Ставрополь",
    lat:45.0400,
    lon:41.9700,
    range:250
  },

  {
    id:"RUWJ",
    name:"Валдай",
    lat:57.9800,
    lon:33.2500,
    range:250
  },

  {
    id:"RAMI",
    name:"Миллерово",
    lat:48.9300,
    lon:40.4000,
    range:250
  },

  {
    id:"RAVN",
    name:"Внуково",
    lat:55.5960,
    lon:37.2670,
    range:250
  },

  {
    id:"RAKU",
    name:"Курск",
    lat:51.7300,
    lon:36.1900,
    range:250
  },

  {
    id:"RUDI",
    name:"Ижевск",
    lat:56.8500,
    lon:53.2000,
    range:250
  },

  {
    id:"RAYL",
    name:"Элиста",
    lat:46.3100,
    lon:44.2700,
    range:250
  },

  {
    id:"RUDL",
    name:"Смоленск",
    lat:54.7800,
    lon:32.0400,
    range:250
  },

  {
    id:"RASM",
    name:"Самара",
    lat:53.2000,
    lon:50.1500,
    range:250
  },

  {
    id:"RABG",
    name:"Белгород",
    lat:50.6000,
    lon:36.6000,
    range:250
  },

  {
    id:"RUDM",
    name:"Минеральные Воды",
    lat:44.2100,
    lon:43.1400,
    range:250
  },

  {
    id:"RUDK",
    name:"Кострома",
    lat:57.7700,
    lon:40.9300,
    range:250
  },

  {
    id:"RUDZ",
    name:"Казань",
    lat:55.7900,
    lon:49.1200,
    range:250
  },

  {
    id:"RAVL",
    name:"Великие Луки",
    lat:56.3400,
    lon:30.5200,
    range:250
  },

  {
    id:"RUDU",
    name:"Уфа",
    lat:54.5567,
    lon:55.8750,
    range:250
  },

  {
    id:"RUDN",
    name:"Нижний Новгород",
    lat:56.3300,
    lon:44.0000,
    range:250
  },

  {
    id:"RAKW",
    name:"Киров",
    lat:58.6000,
    lon:49.6700,
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

  /*
   * Сначала пробуем глобальную map.
   */

  try{

    if(
      typeof map !== "undefined" &&
      map
    ){

      return map;

    }

  }catch(e){}


  /*
   * Затем window.map.
   */

  if(
    window.map
  ){

    return window.map;

  }


  /*
   * Некоторые варианты приложения
   * могут хранить карту в этих переменных.
   */

  if(
    window._map
  ){

    return window._map;

  }


  if(
    window.cloradMap
  ){

    return window.cloradMap;

  }


  if(
    window.quantumMap
  ){

    return window.quantumMap;

  }


  return null;

}


/* =========================================================
   СОЗДАНИЕ ГРУППЫ
   ========================================================= */

function ensureRadarLayer(){

  if(
    typeof L === "undefined"
  ){

    return null;

  }


  const currentMap =
    getRadarMap();


  if(!currentMap){

    return null;

  }


  if(!radarLayer){

    radarLayer =
      L.layerGroup();

  }


  return radarLayer;

}


/* =========================================================
   ТОЧКА РЛС
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

        /*
         * Большая белая точка.
         */

        radius:11,

        /*
         * Только чёрная обводка.
         */

        color:"#111",

        weight:3,

        opacity:1,

        /*
         * Внутри полностью белая.
         */

        fillColor:"#fff",

        fillOpacity:1,

        /*
         * Сама точка кликабельна.
         */

        interactive:true

      }

    );


  /* =======================================================
     POPUP
     ======================================================= */

  point.bindPopup(

    "<div style=\""+
    "font:12px Arial;"+
    "line-height:18px;"+
    "min-width:145px"+
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

    "</div>",

    {

      closeButton:true,

      autoPan:true,

      maxWidth:220

    }

  );


  /* =======================================================
     ПОДПИСЬ
     ======================================================= */

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


  /* =======================================================
     КЛИК

     Белый круг сам является кнопкой.
     ======================================================= */

  point.on(

    "click",

    function(){

      this.openPopup();

    }

  );


  point.addTo(
    group
  );


  return point;

}


/* =========================================================
   ПОКРЫТИЕ РЛС

   Только один чистый круг.
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

        opacity:.32,

        fillColor:"#777",

        fillOpacity:.018,

        /*
         * Круг покрытия НЕ кликабельный.
         * Клик должен попадать в точку РЛС.
         */

        interactive:false

      }

    );


  circle.addTo(
    group
  );


  return circle;

}


/* =========================================================
   СОЗДАНИЕ РЛС
   ========================================================= */

function createRadar(r){

  /*
   * Только:
   *
   * 1. круг покрытия
   * 2. белая точка
   *
   * НИКАКИХ:
   * - лучей
   * - линий
   * - колец
   * - секторов
   * - полигонов
   */

  createCoverage(r);

  createRadarPoint(r);

}


/* =========================================================
   ОЧИСТКА
   ========================================================= */

function clearRadar(){

  if(
    !radarLayer
  ){

    return;

  }


  radarLayer.clearLayers();

}


/* =========================================================
   ОТРИСОВКА
   ========================================================= */

function drawRadar(){

  const group =
    ensureRadarLayer();


  if(!group){

    return false;

  }


  const currentMap =
    getRadarMap();


  if(!currentMap){

    return false;

  }


  clearRadar();


  RADARS.forEach(

    function(r){

      createRadar(r);

    }

  );


  if(
    !currentMap.hasLayer(
      group
    )
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


  if(
    radarVisible
  ){

    drawRadar();

  }else{

    if(
      currentMap.hasLayer(
        group
      )
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

  if(
    radarVisible
  ){

    drawRadar();

  }

}


/* =========================================================
   ВНЕШНИЕ ДАННЫЕ
   =========================================================

   Никаких запросов.
   Только передача уже имеющихся данных.
   ========================================================= */

function setRadars(data){

  if(
    !Array.isArray(data) ||
    !data.length
  ){

    return;

  }


  RADARS.length = 0;


  data.forEach(

    function(r){

      if(
        !r
      ){

        return;

      }


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
          "",

        name:
          r.name ||
          r.id ||
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

}


/* =========================================================
   ПУБЛИЧНЫЙ API
   ========================================================= */

window.RadarPoints = {

  setRadars:
    setRadars,

  setVisible:
    setRadarVisible,

  toggle:
    toggleRadar,

  update:
    updateRadar,

  getRadars:
    function(){

      return RADARS.slice();

    },

  isVisible:
    function(){

      return radarVisible;

    }

};


/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */

function initRadarLayer(){

  /*
   * Ничего не рисуем автоматически.
   *
   * Рисование запускается только
   * через кнопку «РЛС и покрытие».
   */

  ensureRadarLayer();

}


/* =========================================================
   ЗАПУСК
   ========================================================= */

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


/* =========================================================
   Quantum Meteo — конец radars.js
   ========================================================= */
