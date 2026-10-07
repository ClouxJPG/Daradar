/* =========================================================
   Quantum Meteo — ДМРЛ-С / РЛС и покрытие

   ВАЖНО:
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - ЛИНЕЙКА НЕ ИЗМЕНЯЕТСЯ
   - НИКАКИХ запросов к Nowcast
   - НИКАКИХ fetch()
   - НИКАКИХ XMLHttpRequest
   - НИКАКИХ WMS
   - НИКАКИХ внешних API
   - НИКАКИХ таймеров
   - все данные находятся локально в этом файле

   28 ДМРЛ-С:
   RUDO RUDP RUTD RUDX RAVO RAKT RUDB RUDV
   RUDG RATL RAKD RUDT RUWJ RAMI RAVN RAKU
   RUDI RAYL RUDL RASM RABG RUDM RUDK RUDZ
   RAVL RUDU RUDN RAKW

   Источник списка:
   материалы ЦАО / Росгидромета.

   Координаты:
   статическая визуальная привязка станций.
   ========================================================= */


/* =========================================================
   1. РЛС
   ========================================================= */

const RADARS = [

  {
    id:"RUDO",
    name:"Оренбург",
    lat:51.77,
    lon:55.10,
    range:250,
    beam:2.2
  },

  {
    id:"RUDP",
    name:"Петрозаводск",
    lat:61.78,
    lon:34.35,
    range:250,
    beam:2.0
  },

  {
    id:"RUTD",
    name:"Тамбов",
    lat:52.72,
    lon:41.45,
    range:250,
    beam:2.4
  },

  {
    id:"RUDX",
    name:"Архангельск",
    lat:64.54,
    lon:40.54,
    range:250,
    beam:1.9
  },

  {
    id:"RAVO",
    name:"Воейково",
    lat:59.96,
    lon:30.67,
    range:250,
    beam:2.0
  },

  {
    id:"RAKT",
    name:"Котлас",
    lat:61.25,
    lon:46.63,
    range:240,
    beam:2.1
  },

  {
    id:"RUDB",
    name:"Брянск",
    lat:53.25,
    lon:34.37,
    range:250,
    beam:2.5
  },

  {
    id:"RUDV",
    name:"Вологда",
    lat:59.22,
    lon:39.89,
    range:250,
    beam:2.0
  },

  {
    id:"RUDG",
    name:"Волгоград",
    lat:48.71,
    lon:44.51,
    range:250,
    beam:2.6
  },

  {
    id:"RATL",
    name:"Тула",
    lat:54.20,
    lon:37.62,
    range:250,
    beam:2.4
  },

  {
    id:"RAKD",
    name:"Краснодар",
    lat:45.04,
    lon:38.98,
    range:250,
    beam:2.7
  },

  {
    id:"RUDT",
    name:"Ставрополь",
    lat:45.04,
    lon:41.97,
    range:250,
    beam:2.5
  },

  {
    id:"RUWJ",
    name:"Валдай",
    lat:57.98,
    lon:33.25,
    range:250,
    beam:2.0
  },

  {
    id:"RAMI",
    name:"Миллерово",
    lat:48.93,
    lon:40.40,
    range:250,
    beam:2.6
  },

  {
    id:"RAVN",
    name:"Внуково",
    lat:55.60,
    lon:37.29,
    range:230,
    beam:2.3
  },

  {
    id:"RAKU",
    name:"Курск",
    lat:51.73,
    lon:36.19,
    range:250,
    beam:2.5
  },

  {
    id:"RUDI",
    name:"Ижевск",
    lat:56.85,
    lon:53.20,
    range:250,
    beam:2.1
  },

  {
    id:"RAYL",
    name:"Элиста",
    lat:46.31,
    lon:44.27,
    range:250,
    beam:2.8
  },

  {
    id:"RUDL",
    name:"Смоленск",
    lat:54.78,
    lon:32.04,
    range:250,
    beam:2.2
  },

  {
    id:"RASM",
    name:"Самара",
    lat:53.20,
    lon:50.15,
    range:250,
    beam:2.5
  },

  {
    id:"RABG",
    name:"Белгород",
    lat:50.60,
    lon:36.60,
    range:250,
    beam:2.4
  },

  {
    id:"RUDM",
    name:"Минеральные Воды",
    lat:44.21,
    lon:43.14,
    range:250,
    beam:2.6
  },

  {
    id:"RUDK",
    name:"Кострома",
    lat:57.77,
    lon:40.93,
    range:250,
    beam:2.1
  },

  {
    id:"RUDZ",
    name:"Казань",
    lat:55.79,
    lon:49.12,
    range:250,
    beam:2.4
  },

  {
    id:"RAVL",
    name:"Великие Луки",
    lat:56.34,
    lon:30.52,
    range:245,
    beam:2.0
  },

  {
    id:"RUDU",
    name:"Уфа",
    lat:54.5567,
    lon:55.8750,
    range:250,
    beam:2.5
  },

  {
    id:"RUDN",
    name:"Нижний Новгород",
    lat:56.33,
    lon:44.00,
    range:250,
    beam:2.3
  },

  {
    id:"RAKW",
    name:"Киров",
    lat:58.60,
    lon:49.67,
    range:250,
    beam:2.0
  }

];


/* =========================================================
   2. Состояние
   ========================================================= */

let radarVisible=false;

let radarLayer=null;

let radarObjects=[];


/* =========================================================
   3. Leaflet layer
   ========================================================= */

function ensureRadarLayer(){

  if(
    typeof L==="undefined" ||
    typeof map==="undefined"
  ){

    return null;

  }


  if(!radarLayer){

    radarLayer=L.layerGroup();

  }


  return radarLayer;

}


/* =========================================================
   4. Геометрия
   ========================================================= */

function destination(
  lat,
  lon,
  bearing,
  distance
){

  const R=6371;

  const br=bearing*Math.PI/180;

  const d=distance/R;

  const lat1=lat*Math.PI/180;

  const lon1=lon*Math.PI/180;


  const lat2=Math.asin(

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
   5. Кликабельная точка
   ========================================================= */

function createRadarPoint(r){

  const group=ensureRadarLayer();

  if(!group) return null;


  /*
     Большая невидимая область нажатия.
     Особенно удобно на телефоне.
  */

  const hit=L.circleMarker(

    [r.lat,r.lon],

    {
      radius:18,

      color:"#000",

      weight:0,

      opacity:0,

      fillColor:"#000",

      fillOpacity:0,

      interactive:true
    }

  );


  /*
     Видимая точка.
  */

  const point=L.circleMarker(

    [r.lat,r.lon],

    {
      radius:8,

      color:"#222",

      weight:2,

      opacity:1,

      fillColor:"#fff",

      fillOpacity:1,

      interactive:false
    }

  );


  /*
     Центральная точка.
  */

  const core=L.circleMarker(

    [r.lat,r.lon],

    {
      radius:3,

      color:"#555",

      weight:1,

      fillColor:"#555",

      fillOpacity:1,

      interactive:false
    }

  );


  /*
     Общий popup открывается по большой зоне.
  */

  hit.bindPopup(

    "<div style=\"font:12px Arial;line-height:17px\">"+

    "<b>ДМРЛ-С</b><br>"+

    r.name+

    "<br><b>"+

    r.id+

    "</b><br>"+

    "Радиус: "+

    r.range+

    " км"+

    "</div>",

    {
      closeButton:true,

      autoPan:true,

      maxWidth:180
    }

  );


  hit.bindTooltip(

    r.name+

    " ("+

    r.id+

    ")",

    {
      direction:"top",

      offset:[0,-10],

      opacity:.95
    }

  );


  hit.addTo(group);

  point.addTo(group);

  core.addTo(group);


  return [

    hit,

    point,

    core

  ];

}


/* =========================================================
   6. Основное покрытие
   ========================================================= */

function createCoverage(r){

  const group=ensureRadarLayer();

  if(!group) return null;


  const circle=L.circle(

    [r.lat,r.lon],

    {
      radius:r.range*1000,

      color:"#666",

      weight:1,

      opacity:.45,

      fillColor:"#777",

      fillOpacity:.035,

      interactive:false
    }

  );


  circle.addTo(group);


  return circle;

}


/* =========================================================
   7. Кольца
   ========================================================= */

function createRings(r){

  const group=ensureRadarLayer();

  if(!group) return [];


  const result=[];


  /*
     Кольца через 50 км.
  */

  for(

    let distance=50;

    distance<r.range;

    distance+=50

  ){

    const ring=L.circle(

      [r.lat,r.lon],

      {
        radius:distance*1000,

        color:"#777",

        weight:.55,

        opacity:.20,

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
   8. Лучи
   ========================================================= */

function createRays(r){

  const group=ensureRadarLayer();

  if(!group) return [];


  const result=[];


  /*
     Не одинаковая ширина.

     У каждой РЛС своё значение beam.
     Кроме того, дальние части луча немного тоньше.
  */

  const angles=[

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


  angles.forEach(function(angle,index){

    const p1=destination(

      r.lat,
      r.lon,
      angle-r.beam/2,
      r.range

    );


    const p2=destination(

      r.lat,
      r.lon,
      angle+r.beam/2,
      r.range

    );


    /*
       Тонкий сектор вместо одинаковой линии.
       Это визуально ближе к радиолокационному
       лучу и позволяет каждой станции иметь
       собственную ширину.
    */

    const sector=L.polygon(

      [
        [r.lat,r.lon],
        p1,
        p2
      ],

      {
        color:"#666",

        weight:

          index%3===0

            ? 1.15

            : index%2===0

              ? .85

              : .6,

        opacity:.25,

        fillColor:"#777",

        fillOpacity:.018,

        interactive:false
      }

    );


    sector.addTo(group);

    result.push(sector);

  });


  return result;

}


/* =========================================================
   9. Создание РЛС
   ========================================================= */

function createRadar(r){

  const objects=[];


  const point=createRadarPoint(r);

  if(point){

    point.forEach(function(x){

      objects.push(x);

    });

  }


  const coverage=createCoverage(r);

  if(coverage){

    objects.push(coverage);

  }


  const rings=createRings(r);

  rings.forEach(function(x){

    objects.push(x);

  });


  const rays=createRays(r);

  rays.forEach(function(x){

    objects.push(x);

  });


  return objects;

}


/* =========================================================
   10. Очистка
   ========================================================= */

function clearRadar(){

  if(!radarLayer)
    return;


  radarLayer.clearLayers();


  radarObjects=[];

}


/* =========================================================
   11. Отрисовка
   ========================================================= */

function drawRadar(){

  const group=ensureRadarLayer();

  if(!group)
    return;


  clearRadar();


  RADARS.forEach(function(r){

    const objects=createRadar(r);


    radarObjects.push({

      radar:r,

      objects:objects

    });

  });


  if(!map.hasLayer(group)){

    group.addTo(map);

  }

}


/* =========================================================
   12. Видимость
   ========================================================= */

function setRadarVisible(enabled){

  radarVisible=!!enabled;


  const group=ensureRadarLayer();

  if(!group)
    return;


  if(radarVisible){

    drawRadar();

  }else{

    if(map.hasLayer(group)){

      map.removeLayer(group);

    }

  }

}


/* =========================================================
   13. Переключение
   ========================================================= */

function toggleRadar(){

  setRadarVisible(

    !radarVisible

  );

}


/* =========================================================
   14. Обновление
   ========================================================= */

function updateRadar(){

  if(radarVisible){

    drawRadar();

  }

}


/* =========================================================
   15. Передача реальных координат
   ========================================================= */

function setRadars(data){

  if(

    !Array.isArray(data) ||

    !data.length

  ){

    return;

  }


  /*
     Если когда-нибудь index.html/server
     передаст реальные координаты,
     они заменят статические.

     При этом этот файл сам НИЧЕГО
     не запрашивает.
  */

  RADARS.length=0;


  data.forEach(function(r){

    if(

      !r ||

      typeof r.lat!=="number" ||

      typeof r.lon!=="number"

    ){

      return;

    }


    RADARS.push({

      id:r.id || "",

      name:r.name || r.id || "ДМРЛ-С",

      lat:r.lat,

      lon:r.lon,

      range:

        Number(

          r.range_km ||

          r.range ||

          250

        ),

      beam:

        Number(

          r.beam ||

          2

        )

    });

  });


  updateRadar();

}


/* =========================================================
   16. Глобальный API
   ========================================================= */

window.RadarPoints={

  setRadars:setRadars,

  setVisible:setRadarVisible,

  toggle:toggleRadar,

  update:updateRadar,

  getRadars:function(){

    return RADARS.slice();

  },

  isVisible:function(){

    return radarVisible;

  }

};


/* =========================================================
   17. Инициализация
   ========================================================= */

function initRadarLayer(){

  if(

    typeof L==="undefined" ||

    typeof map==="undefined"

  ){

    return;

  }


  ensureRadarLayer();

}


/* =========================================================
   18. Запуск
   ========================================================= */

if(

  document.readyState==="loading"

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
