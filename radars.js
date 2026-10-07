/* =========================================================
   Quantum Meteo — Реальные ДМРЛ-С / покрытие

   ВАЖНО:
   - НИКАКИХ запросов к Nowcast
   - НИКАКИХ fetch / XMLHttpRequest / WMS
   - НИКАКИХ внешних API
   - Все данные находятся прямо в этом файле
   - index.html НЕ ИЗМЕНЯЕТСЯ
   - ЛИНЕЙКА НЕ ИЗМЕНЯЕТСЯ

   Источник списка РЛС:
   система наукастинга / материалы Росгидромета.

   Координаты ниже являются приближёнными
   и предназначены для отображения сети РЛС.
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
    id:"RUTD",
    name:"Тамбов",
    lat:52.72,
    lon:41.45,
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
    id:"RAVO",
    name:"Воейково",
    lat:59.96,
    lon:30.67,
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
    id:"RUDB",
    name:"Брянск",
    lat:53.25,
    lon:34.37,
    range:250
  },

  {
    id:"RUDV",
    name:"Вологда",
    lat:59.22,
    lon:39.89,
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
    id:"RATL",
    name:"Тула",
    lat:54.20,
    lon:37.62,
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
    id:"RUWJ",
    name:"Валдай",
    lat:57.98,
    lon:33.25,
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
    id:"RAVN",
    name:"Внуково",
    lat:55.60,
    lon:37.29,
    range:250
  },

  {
    id:"RAKU",
    name:"Курск",
    lat:51.73,
    lon:36.19,
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
    id:"RAYL",
    name:"Элиста",
    lat:46.31,
    lon:44.27,
    range:250
  },

  {
    id:"RUDL",
    name:"Смоленск",
    lat:54.78,
    lon:32.04,
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
    id:"RABG",
    name:"Белгород",
    lat:50.60,
    lon:36.60,
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
    id:"RUDK",
    name:"Кострома",
    lat:57.77,
    lon:40.93,
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
    id:"RAVL",
    name:"Великие Луки",
    lat:56.34,
    lon:30.52,
    range:250
  },

  {
    id:"RUDU",
    name:"Уфа",
    lat:54.74,
    lon:55.96,
    range:250
  },

  {
    id:"RUDN",
    name:"Нижний Новгород",
    lat:56.33,
    lon:44.00,
    range:250
  },

  {
    id:"RAKW",
    name:"Киров",
    lat:58.60,
    lon:49.67,
    range:250
  }

];


/* =========================================================
   2. Состояние
   ========================================================= */

let radarVisible = false;

let radarLayer = null;

let radarObjects = [];


/* =========================================================
   3. Создание группы
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
   4. Цвета
   ========================================================= */

function radarColor(){

  return "#777";

}


/* =========================================================
   5. Точка РЛС
   ========================================================= */

function createRadarPoint(r){

  const group = ensureRadarLayer();

  if(!group) return null;


  const marker = L.circleMarker(
    [r.lat,r.lon],
    {
      radius:5,

      color:"#333",

      weight:1,

      fillColor:"#fff",

      fillOpacity:1,

      opacity:1
    }
  );


  marker.bindTooltip(
    "<b>ДМРЛ-С</b><br>"+
    r.name+
    "<br>"+
    r.id,
    {
      direction:"top",

      offset:[0,-4],

      opacity:.95
    }
  );


  marker.addTo(group);


  return marker;
}


/* =========================================================
   6. Кольцо покрытия
   ========================================================= */

function createCoverage(r){

  const group = ensureRadarLayer();

  if(!group) return null;


  const circle = L.circle(
    [r.lat,r.lon],
    {
      radius:r.range*1000,

      color:"#777",

      weight:1,

      opacity:.45,

      fillColor:"#888",

      fillOpacity:.035,

      interactive:false
    }
  );


  circle.addTo(group);


  return circle;
}


/* =========================================================
   7. Дополнительные кольца
   ========================================================= */

function createRings(r){

  const group = ensureRadarLayer();

  if(!group) return [];


  const result=[];


  const rings=[
    .25,
    .50,
    .75,
    1
  ];


  rings.forEach(function(k){

    const ring=L.circle(
      [r.lat,r.lon],
      {
        radius:r.range*1000*k,

        color:"#777",

        weight:.7,

        opacity:.22,

        fill:false,

        interactive:false
      }
    );


    ring.addTo(group);

    result.push(ring);

  });


  return result;
}


/* =========================================================
   8. Радиолокационные лучи
   ========================================================= */

function destination(lat,lon,bearing,distance){

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
      Math.cos(d)-Math.sin(lat1)*Math.sin(lat2)
    );


  return [

    lat2*180/Math.PI,

    lon2*180/Math.PI

  ];

}


function createRays(r){

  const group=ensureRadarLayer();

  if(!group) return [];


  const result=[];


  /*
     12 направлений.
     Это именно визуальные лучи покрытия,
     а не реальные азимутальные данные РЛС.
  */

  for(
    let angle=0;
    angle<360;
    angle+=30
  ){

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
        color:radarColor(),

        weight:.7,

        opacity:.16,

        interactive:false
      }
    );


    line.addTo(group);

    result.push(line);

  }


  return result;
}


/* =========================================================
   9. Создание всей РЛС
   ========================================================= */

function createRadar(r){

  const objects=[];


  const point=createRadarPoint(r);

  if(point)
    objects.push(point);


  const coverage=createCoverage(r);

  if(coverage)
    objects.push(coverage);


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


  if(
    !map.hasLayer(group)
  ){

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

    if(
      map.hasLayer(group)
    ){

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

  if(
    radarVisible
  ){

    drawRadar();

  }

}


/* =========================================================
   15. Работа с внешним списком
   ========================================================= */

function setRadars(data){

  if(
    Array.isArray(data) &&
    data.length
  ){

    /*
      Если сервер когда-нибудь передаст
      реальные координаты, можно использовать их.

      Но этот файл сам по себе работает
      без каких-либо запросов.
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
          )

      });

    });

  }


  updateRadar();

}


/* =========================================================
   16. Глобальный интерфейс
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
   17. После готовности карты
   ========================================================= */

function initRadarLayer(){

  if(
    typeof map==="undefined" ||
    typeof L==="undefined"
  ){

    return;

  }


  ensureRadarLayer();


  /*
     По умолчанию покрытие выключено.

     НИКАКИХ запросов наружу.
     НИКАКИХ таймеров.
     НИКАКИХ обращений к Nowcast.
  */

}


/* =========================================================
   18. Инициализация
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
