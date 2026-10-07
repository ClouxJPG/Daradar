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
   СОЗДАНИЕ ГРУППЫ
   ========================================================= */

function ensureRadarLayer(){

  if(
    typeof L === "undefined" ||
    typeof map === "undefined"
  ){

    return null;

  }

  if(!radarLayer){

    radarLayer = L.layerGroup();

  }

  return radarLayer;

}


/* =========================================================
   ГЕОГРАФИЧЕСКАЯ ТОЧКА
   ========================================================= */

function destination(
  lat,
  lon,
  bearing,
  distance
){

  const R = 6371;

  const br =
    bearing *
    Math.PI /
    180;

  const d =
    distance /
    R;

  const lat1 =
    lat *
    Math.PI /
    180;

  const lon1 =
    lon *
    Math.PI /
    180;


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
   ТОЧКА РЛС

   ОДНА БЕЛАЯ ТОЧКА
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

        /*
         * Большой размер специально
         * для нажатия пальцем.
         */
        radius:11,

        color:"#111",

        weight:3,

        opacity:1,

        fillColor:"#fff",

        fillOpacity:1,

        interactive:true

      }

    );


  /*
   * Информация открывается
   * непосредственно при нажатии
   * на белый круг.
   */

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
   ПОКРЫТИЕ
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

        interactive:false

      }

    );


  circle.addTo(group);


  return circle;

}


/* =========================================================
   КОЛЬЦА

   Только тонкие окружности.
   Никаких заливок и полос.
   ========================================================= */

function createRings(r){

  const group =
    ensureRadarLayer();

  if(!group){

    return [];

  }


  const result = [];


  for(

    let distance = 50;

    distance < r.range;

    distance += 50

  ){

    const ring =
      L.circle(

        [
          r.lat,
          r.lon
        ],

        {

          radius:
            distance *
            1000,

          color:"#777",

          weight:.45,

          opacity:.14,

          fill:false,

          interactive:false

        }

      );


    ring.addTo(group);

    result.push(ring);

  }


  return result;

}


/* =========================================================
   ЛУЧИ

   Только одиночные линии.
   Никаких секторов.
   Никаких треугольников.
   ========================================================= */

function createRays(r){

  const group =
    ensureRadarLayer();

  if(!group){

    return [];

  }


  const result = [];


  /*
   * 12 отдельных тонких лучей.
   */

  const angles = [

    0,
    30,
    60,
    90,
    120,
    150,
    180,
    210,
    240,
    270,
    300,
    330

  ];


  angles.forEach(function(angle){

    const end =
      destination(

        r.lat,

        r.lon,

        angle,

        r.range

      );


    const line =
      L.polyline(

        [

          [
            r.lat,
            r.lon
          ],

          end

        ],

        {

          color:"#555",

          weight:.7,

          opacity:.16,

          interactive:false

        }

      );


    line.addTo(group);

    result.push(line);

  });


  return result;

}


/* =========================================================
   СОЗДАНИЕ РЛС
   ========================================================= */

function createRadar(r){

  const objects = [];


  const point =
    createRadarPoint(r);

  if(point){

    objects.push(point);

  }


  const coverage =
    createCoverage(r);

  if(coverage){

    objects.push(coverage);

  }


  const rings =
    createRings(r);

  rings.forEach(function(obj){

    objects.push(obj);

  });


  const rays =
    createRays(r);

  rays.forEach(function(obj){

    objects.push(obj);

  });


  return objects;

}


/* =========================================================
   ОЧИСТКА
   ========================================================= */

function clearRadar(){

  if(!radarLayer){

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

    return;

  }


  clearRadar();


  RADARS.forEach(function(r){

    createRadar(r);

  });


  if(
    !map.hasLayer(group)
  ){

    group.addTo(map);

  }

}


/* =========================================================
   ВИДИМОСТЬ
   ========================================================= */

function setRadarVisible(enabled){

  radarVisible =
    !!enabled;


  const group =
    ensureRadarLayer();

  if(!group){

    return;

  }


  if(radarVisible){

    drawRadar();

  }else{

    if(
      map.hasLayer(group)
    ){

      map.removeLayer(group);

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
   ВНЕШНИЕ ДАННЫЕ

   Важно:
   функция НЕ делает никаких запросов.
   ========================================================= */

function setRadars(data){

  if(
    !Array.isArray(data) ||
    !data.length
  ){

    return;

  }


  RADARS.length = 0;


  data.forEach(function(r){

    if(
      !r ||
      typeof r.lat !== "number" ||
      typeof r.lon !== "number"
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

      lat:
        r.lat,

      lon:
        r.lon,

      range:
        Number(
          r.range_km ||
          r.range ||
          250
        )

    });

  });


  updateRadar();

}


/* =========================================================
   ГЛОБАЛЬНЫЙ API
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

  if(
    typeof L === "undefined" ||
    typeof map === "undefined"
  ){

    return;

  }


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
