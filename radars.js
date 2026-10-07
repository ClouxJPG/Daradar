/* =========================================================
   Quantum Meteo — ДМРЛ-С / РЛС и покрытие

   - index.html НЕ ИЗМЕНЯЕТСЯ
   - ЛИНЕЙКА НЕ ИЗМЕНЯЕТСЯ
   - НИКАКИХ запросов к Nowcast
   - НИКАКИХ fetch / XHR / WMS
   - НИКАКИХ таймеров
   - РЛС полностью статические
   ========================================================= */


/* =========================================================
   РЛС
   ========================================================= */

const RADARS = [

  {id:"RUDO",name:"Оренбург",lat:51.77,lon:55.10,range:250,beam:1.2},
  {id:"RUDP",name:"Петрозаводск",lat:61.78,lon:34.35,range:250,beam:1.0},
  {id:"RUTD",name:"Тамбов",lat:52.72,lon:41.45,range:250,beam:1.3},
  {id:"RUDX",name:"Архангельск",lat:64.54,lon:40.54,range:250,beam:.9},
  {id:"RAVO",name:"Воейково",lat:59.96,lon:30.67,range:250,beam:1.0},
  {id:"RAKT",name:"Котлас",lat:61.25,lon:46.63,range:240,beam:1.1},
  {id:"RUDB",name:"Брянск",lat:53.25,lon:34.37,range:250,beam:1.4},
  {id:"RUDV",name:"Вологда",lat:59.22,lon:39.89,range:250,beam:1.0},
  {id:"RUDG",name:"Волгоград",lat:48.71,lon:44.51,range:250,beam:1.5},
  {id:"RATL",name:"Тула",lat:54.20,lon:37.62,range:250,beam:1.3},
  {id:"RAKD",name:"Краснодар",lat:45.04,lon:38.98,range:250,beam:1.5},
  {id:"RUDT",name:"Ставрополь",lat:45.04,lon:41.97,range:250,beam:1.4},
  {id:"RUWJ",name:"Валдай",lat:57.98,lon:33.25,range:250,beam:1.0},
  {id:"RAMI",name:"Миллерово",lat:48.93,lon:40.40,range:250,beam:1.5},
  {id:"RAVN",name:"Внуково",lat:55.60,lon:37.29,range:230,beam:1.2},
  {id:"RAKU",name:"Курск",lat:51.73,lon:36.19,range:250,beam:1.4},
  {id:"RUDI",name:"Ижевск",lat:56.85,lon:53.20,range:250,beam:1.1},
  {id:"RAYL",name:"Элиста",lat:46.31,lon:44.27,range:250,beam:1.6},
  {id:"RUDL",name:"Смоленск",lat:54.78,lon:32.04,range:250,beam:1.2},
  {id:"RASM",name:"Самара",lat:53.20,lon:50.15,range:250,beam:1.4},
  {id:"RABG",name:"Белгород",lat:50.60,lon:36.60,range:250,beam:1.3},
  {id:"RUDM",name:"Минеральные Воды",lat:44.21,lon:43.14,range:250,beam:1.5},
  {id:"RUDK",name:"Кострома",lat:57.77,lon:40.93,range:250,beam:1.1},
  {id:"RUDZ",name:"Казань",lat:55.79,lon:49.12,range:250,beam:1.3},
  {id:"RAVL",name:"Великие Луки",lat:56.34,lon:30.52,range:245,beam:1.0},

  /* Уфа — привязка ближе к аэродромной зоне */
  {id:"RUDU",name:"Уфа",lat:54.5567,lon:55.8750,range:250,beam:1.4},

  {id:"RUDN",name:"Нижний Новгород",lat:56.33,lon:44.00,range:250,beam:1.2},
  {id:"RAKW",name:"Киров",lat:58.60,lon:49.67,range:250,beam:1.0}

];


/* =========================================================
   Состояние
   ========================================================= */

let radarVisible=false;

let radarLayer=null;

let radarObjects=[];


/* =========================================================
   LayerGroup
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
   Географическая точка по направлению
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
   РЛС — БОЛЬШАЯ БЕЛАЯ ТОЧКА
   ========================================================= */

function createRadarPoint(r){

  const group=ensureRadarLayer();

  if(!group) return null;


  /*
     Большая невидимая зона нажатия.
     Нужна именно для iPhone.
  */

  const hit=L.circleMarker(

    [r.lat,r.lon],

    {
      radius:22,

      stroke:false,

      fill:false,

      fillOpacity:0,

      opacity:0,

      interactive:true
    }

  );


  /*
     Основная белая точка.
  */

  const point=L.circleMarker(

    [r.lat,r.lon],

    {
      radius:10,

      color:"#111",

      weight:2.5,

      opacity:1,

      fillColor:"#fff",

      fillOpacity:1,

      interactive:false
    }

  );


  /*
     Popup открывается именно
     по большой зоне нажатия.
  */

  hit.bindPopup(

    "<div style=\"font:12px Arial;line-height:18px\">"+

    "<b>ДМРЛ-С</b><br>"+

    r.name+

    "<br>"+

    "<b>"+r.id+"</b><br>"+

    "Радиус: "+r.range+" км"+

    "</div>",

    {
      closeButton:true,

      autoPan:true,

      maxWidth:180
    }

  );


  hit.bindTooltip(

    r.name+" ("+r.id+")",

    {
      direction:"top",

      offset:[0,-11],

      opacity:.95
    }

  );


  hit.addTo(group);

  point.addTo(group);


  return [

    hit,

    point

  ];

}


/* =========================================================
   ОСНОВНОЕ ПОКРЫТИЕ
   ========================================================= */

function createCoverage(r){

  const group=ensureRadarLayer();

  if(!group) return null;


  const circle=L.circle(

    [r.lat,r.lon],

    {
      radius:r.range*1000,

      color:"#666",

      weight:.8,

      opacity:.32,

      fillColor:"#888",

      fillOpacity:.018,

      interactive:false
    }

  );


  circle.addTo(group);


  return circle;

}


/* =========================================================
   КОЛЬЦА ПОКРЫТИЯ
   ========================================================= */

function createRings(r){

  const group=ensureRadarLayer();

  if(!group) return [];


  const result=[];


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

        weight:.45,

        opacity:.16,

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

   ВАЖНО:
   Никаких секторов.
   Никаких треугольников.
   Никаких двойных полос.
   Только одна тонкая линия.
   ========================================================= */

function createRays(r){

  const group=ensureRadarLayer();

  if(!group) return [];


  const result=[];


  /*
     12 направлений.
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


  angles.forEach(function(angle){

    const end=destination(

      r.lat,

      r.lon,

      angle,

      r.range

    );


    const line=L.polyline(

      [
        [r.lat,r.lon],
        end
      ],

      {
        color:"#666",

        /*
           Своя ширина у каждой РЛС.
           Но это ОДНА линия, а не полоса.
        */

        weight:r.beam,

        opacity:.20,

        interactive:false
      }

    );


    line.addTo(group);

    result.push(line);

  });


  return result;

}


/* =========================================================
   Создание одной РЛС
   ========================================================= */

function createRadar(r){

  const objects=[];


  const points=createRadarPoint(r);

  if(points){

    points.forEach(function(obj){

      objects.push(obj);

    });

  }


  const coverage=createCoverage(r);

  if(coverage){

    objects.push(coverage);

  }


  const rings=createRings(r);

  rings.forEach(function(obj){

    objects.push(obj);

  });


  const rays=createRays(r);

  rays.forEach(function(obj){

    objects.push(obj);

  });


  return objects;

}


/* =========================================================
   Очистка
   ========================================================= */

function clearRadar(){

  if(!radarLayer)
    return;


  radarLayer.clearLayers();

  radarObjects=[];

}


/* =========================================================
   Отрисовка
   ========================================================= */

function drawRadar(){

  const group=ensureRadarLayer();

  if(!group)
    return;


  clearRadar();


  RADARS.forEach(function(r){

    radarObjects.push({

      radar:r,

      objects:createRadar(r)

    });

  });


  if(!map.hasLayer(group)){

    group.addTo(map);

  }

}


/* =========================================================
   Включение / выключение
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
   Toggle
   ========================================================= */

function toggleRadar(){

  setRadarVisible(

    !radarVisible

  );

}


/* =========================================================
   Update
   ========================================================= */

function updateRadar(){

  if(radarVisible){

    drawRadar();

  }

}


/* =========================================================
   Возможность передать реальные данные
   ========================================================= */

function setRadars(data){

  if(

    !Array.isArray(data) ||

    !data.length

  ){

    return;

  }


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

      range:Number(

        r.range_km ||

        r.range ||

        250

      ),

      beam:Number(

        r.beam ||

        1

      )

    });

  });


  updateRadar();

}


/* =========================================================
   Глобальный API

   Совместим с index.html
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
   Инициализация
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
   Запуск
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
