/* =========================================================
   Quantum Meteo — МЕТЕОРАД / РЛС

   ВАЖНО:
   - НЕ используем старые координаты РЛС
   - НЕ используем Nowcast
   - НЕ используем API
   - НЕ рисуем искусственные круги
   - НЕ рисуем искусственные лучи
   - источник визуального слоя: кадр МЕТЕОРАД
   - слой содержит точки + фактическую видимую геометрию
     покрытия из подготовленного PNG

   Файлы рядом:
     index.html
     radars.js
     meteorad_radar_points_coverage.png
   ========================================================= */

const METEORAD_IMAGE =
  "./meteorad_radar_points_coverage.png";

/*
 * Рамка растрового кадра.
 * Это НЕ координаты отдельных РЛС.
 */
const METEORAD_BOUNDS = [
  [40.0, 18.0],
  [67.0, 70.0]
];

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

  if(
    window.map &&
    typeof window.map.addLayer === "function"
  ){

    return window.map;

  }

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
   РАСТРОВЫЙ СЛОЙ МЕТЕОРАД
   ========================================================= */

function createMeteoradOverlay(){

  const currentMap =
    getRadarMap();

  if(
    !currentMap ||
    typeof L === "undefined"
  ){

    return null;

  }

  return L.imageOverlay(

    METEORAD_IMAGE,

    METEORAD_BOUNDS,

    {

      opacity:1,

      interactive:false,

      crossOrigin:true,

      zIndex:350

    }

  );
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

    return;

  }

  group.clearLayers();

  const overlay =
    createMeteoradOverlay();

  if(!overlay){

    return;

  }

  overlay.addTo(group);

  if(
    !currentMap.hasLayer(group)
  ){

    group.addTo(currentMap);

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

    return [];

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
