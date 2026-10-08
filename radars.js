/* =========================================================
   Quantum Meteo — МЕТЕОРАД / РЛС

   ВАЖНО:
   - НИКАКИХ PNG
   - НИКАКИХ внешних файлов
   - НИКАКОГО Nowcast
   - НИКАКОГО fetch
   - НИКАКИХ API
   - НИКАКИХ старых списков из 28 РЛС
   - геометрия построена по кадру МЕТЕОРАД
   - точки: белые с чёрной обводкой
   - покрытие: серое
   - присутствуют неполные/кривые зоны и сектора
   ========================================================= */


/* =========================================================
   РАСТРОВЫЕ КООРДИНАТЫ КАДРА МЕТЕОРАД

   Внутреннее пространство SVG:
   1200 × 1200

   Поэтому точки не привязаны к центрам городов.
   Они располагаются по положению РЛС на исходном кадре.
   ========================================================= */

const MW = 1200;
const MH = 1200;


/* =========================================================
   ТОЧКИ РЛС

   x/y — положение непосредственно на кадре МЕТЕОРАД.
   ========================================================= */

const RADARS = [

  {id:"DMRL-01",x:280,y:178},
  {id:"DMRL-02",x:348,y:281},
  {id:"DMRL-03",x:450,y:361},
  {id:"DMRL-04",x:645,y:178},
  {id:"DMRL-05",x:655,y:193},
  {id:"DMRL-06",x:755,y:395},
  {id:"DMRL-07",x:969,y:244},

  {id:"DMRL-08",x:581,y:455},
  {id:"DMRL-09",x:694,y:488},
  {id:"DMRL-10",x:444,y:627},
  {id:"DMRL-11",x:720,y:560},
  {id:"DMRL-12",x:918,y:601},

  {id:"DMRL-13",x:791,y:701},
  {id:"DMRL-14",x:801,y:719},
  {id:"DMRL-15",x:1023,y:715},
  {id:"DMRL-16",x:1050,y:799},
  {id:"DMRL-17",x:937,y:832},
  {id:"DMRL-18",x:1044,y:883},

  {id:"DMRL-19",x:620,y:850},
  {id:"DMRL-20",x:740,y:800},
  {id:"DMRL-21",x:280,y:900},
  {id:"DMRL-22",x:359,y:1121},

  {id:"DMRL-23",x:450,y:627},
  {id:"DMRL-24",x:865,y:610},
  {id:"DMRL-25",x:791,y:793},
  {id:"DMRL-26",x:963,y:971}

];


/* =========================================================
   СОСТОЯНИЕ
   ========================================================= */

let radarVisible = false;
let radarLayer = null;
let radarOverlay = null;


/* =========================================================
   ПОЛУЧЕНИЕ MAP
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

  return null;

}


/* =========================================================
   LEAFLET-СЛОЙ
   ========================================================= */

function ensureRadarLayer(){

  const m =
    getRadarMap();

  if(
    typeof L === "undefined" ||
    !m
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
   СОЗДАНИЕ SVG
   ========================================================= */

function createRadarSVG(){

  const svg =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );


  svg.setAttribute(
    "xmlns",
    "http://www.w3.org/2000/svg"
  );

  svg.setAttribute(
    "viewBox",
    `0 0 ${MW} ${MH}`
  );

  svg.setAttribute(
    "preserveAspectRatio",
    "none"
  );

  svg.style.width =
    "100%";

  svg.style.height =
    "100%";


  const defs =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "defs"
    );

  svg.appendChild(defs);


  /* =======================================================
     МЯГКИЙ СЕРЫЙ ВИД ПОКРЫТИЯ
     ======================================================= */

  const filter =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "filter"
    );

  filter.setAttribute(
    "id",
    "radarSoft"
  );

  filter.setAttribute(
    "x",
    "-20%"
  );

  filter.setAttribute(
    "y",
    "-20%"
  );

  filter.setAttribute(
    "width",
    "140%"
  );

  filter.setAttribute(
    "height",
    "140%"
  );

  const blur =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "feGaussianBlur"
    );

  blur.setAttribute(
    "stdDeviation",
    "0.7"
  );

  filter.appendChild(blur);

  defs.appendChild(filter);


  /* =======================================================
     ГРУППА ПОКРЫТИЯ
     ======================================================= */

  const coverage =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );

  coverage.setAttribute(
    "fill",
    "#777"
  );

  coverage.setAttribute(
    "fill-opacity",
    ".22"
  );

  coverage.setAttribute(
    "stroke",
    "#555"
  );

  coverage.setAttribute(
    "stroke-opacity",
    ".14"
  );

  coverage.setAttribute(
    "stroke-width",
    "1"
  );

  coverage.setAttribute(
    "filter",
    "url(#radarSoft)"
  );

  svg.appendChild(coverage);


  /* =======================================================
     ОСНОВНЫЕ ЗОНЫ

     Размеры взяты с изображения, а не из radius=250.
     ======================================================= */

  const zones = [

    [280,178,125],
    [348,281,125],
    [450,361,135],

    [645,184,125],
    [755,395,120],
    [969,244,112],

    [581,455,145],
    [694,488,125],

    [444,627,140],
    [720,560,145],
    [918,601,135],

    [791,701,125],
    [801,719,145],

    [1023,715,110],
    [1050,799,155],
    [937,832,140],
    [1044,883,110],

    [620,850,135],
    [740,800,145],

    [280,900,135],
    [359,1121,125],

    [865,610,125],
    [791,793,120],

    [963,971,125]

  ];


  zones.forEach(

    z=>{

      const c =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );

      c.setAttribute(
        "cx",
        z[0]
      );

      c.setAttribute(
        "cy",
        z[1]
      );

      c.setAttribute(
        "r",
        z[2]
      );

      coverage.appendChild(c);

    }

  );


  /* =======================================================
     НЕПОЛНЫЕ / КРИВЫЕ СЕКТОРА

     Это специально НЕ идеальные круги.
     ======================================================= */

  const sectors = [

    /*
     * северо-запад
     */

    "M280 178 L158 103 L205 42 L315 58 Z",

    "M348 281 L226 205 L174 252 L225 342 Z",

    /*
     * Москва / центральная часть
     */

    "M581 455 L440 401 L407 438 L522 501 Z",

    "M581 455 L693 408 L724 431 L623 476 Z",

    "M694 488 L790 443 L817 469 L727 518 Z",

    /*
     * юг
     */

    "M280 900 L173 823 L142 858 L229 944 Z",

    "M359 1121 L281 1026 L314 995 L404 1086 Z",

    /*
     * Краснодарский район
     */

    "M444 627 L350 688 L369 726 L469 660 Z",

    /*
     * Урал
     */

    "M1023 715 L1127 659 L1152 700 L1060 751 Z",

    "M1044 883 L1156 841 L1181 882 L1070 918 Z",

    /*
     * север
     */

    "M969 244 L1081 176 L1102 215 L1001 277 Z"

  ];


  sectors.forEach(

    d=>{

      const p =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );

      p.setAttribute(
        "d",
        d
      );

      p.setAttribute(
        "fill",
        "#777"
      );

      p.setAttribute(
        "fill-opacity",
        ".20"
      );

      p.setAttribute(
        "stroke",
        "#555"
      );

      p.setAttribute(
        "stroke-opacity",
        ".12"
      );

      coverage.appendChild(p);

    }

  );


  /* =======================================================
     ТОНКИЕ РАЗРЫВЫ / СЛЕПЫЕ ЗОНЫ

     Оставляем пустыми, чтобы покрытие не выглядело
     искусственным идеальным кругом.
     ======================================================= */

  const gaps = [

    "M540 455 L565 429 L591 445 L565 466 Z",

    "M690 500 L716 479 L739 492 L716 514 Z",

    "M918 602 L946 580 L969 596 L943 620 Z",

    "M1034 795 L1057 770 L1082 789 L1058 813 Z"

  ];


  gaps.forEach(

    d=>{

      const p =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );

      p.setAttribute(
        "d",
        d
      );

      p.setAttribute(
        "fill",
        "rgba(255,255,255,.01)"
      );

      p.setAttribute(
        "fill-opacity",
        "0"
      );

      coverage.appendChild(p);

    }

  );


  /* =======================================================
     ТОЧКИ РЛС
     ======================================================= */

  const points =
    document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );

  points.setAttribute(
    "cursor",
    "pointer"
  );

  svg.appendChild(points);


  RADARS.forEach(

    r=>{

      const g =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g"
        );

      g.dataset.id =
        r.id;


      const circle =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );

      circle.setAttribute(
        "cx",
        r.x
      );

      circle.setAttribute(
        "cy",
        r.y
      );

      circle.setAttribute(
        "r",
        "8"
      );

      circle.setAttribute(
        "fill",
        "#fff"
      );

      circle.setAttribute(
        "stroke",
        "#000"
      );

      circle.setAttribute(
        "stroke-width",
        "3"
      );


      g.appendChild(circle);


      /*
       * Клик по РЛС.
       */

      g.addEventListener(

        "click",

        e=>{

          e.stopPropagation();

          showRadarInfo(
            r
          );

        }

      );


      points.appendChild(g);

    }

  );


  return svg;

}


/* =========================================================
   ИНФОРМАЦИЯ О РЛС
   ========================================================= */

function showRadarInfo(r){

  const m =
    getRadarMap();

  if(!m){

    return;

  }


  /*
   * Перевод координат SVG обратно в положение карты.
   *
   * Рамка соответствует карте кадра МЕТЕОРАД.
   */

  const lat =
    67 -
    (r.y/MH)*27;

  const lon =
    18 +
    (r.x/MW)*52;


  L.popup()

    .setLatLng([
      lat,
      lon
    ])

    .setContent(

      '<div style="' +
      'font:13px Arial;' +
      'line-height:19px;' +
      'min-width:145px' +
      '">' +

      '<b>ДМРЛ-С</b>' +

      '<br>' +

      'ID: ' +
      r.id +

      '<br>' +

      'Широта: ' +
      lat.toFixed(2) +
      '°' +

      '<br>' +

      'Долгота: ' +
      lon.toFixed(2) +
      '°' +

      '</div>'

    )

    .openOn(m);

}


/* =========================================================
   IMAGE OVERLAY
   ========================================================= */

function drawRadar(){

  const m =
    getRadarMap();

  const group =
    ensureRadarLayer();

  if(
    !m ||
    !group
  ){

    return;

  }


  group.clearLayers();


  const svg =
    createRadarSVG();


  /*
   * Рамка карты МЕТЕОРАД.
   */

  const bounds =
    [
      [40,18],
      [67,70]
    ];


  radarOverlay =
    L.svgOverlay(

      svg,

      bounds,

      {

        opacity:1,

        interactive:true,

        bubblingMouseEvents:true

      }

    );


  radarOverlay.addTo(
    group
  );


  if(
    !m.hasLayer(group)
  ){

    group.addTo(m);

  }

}


/* =========================================================
   ВКЛ / ВЫКЛ
   ========================================================= */

function setRadarVisible(enabled){

  radarVisible =
    !!enabled;


  const m =
    getRadarMap();


  if(!m){

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
      m.hasLayer(group)
    ){

      m.removeLayer(
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

  setRadars:function(){

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
