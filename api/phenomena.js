/* =========================================================
   Quantum Meteo — Phenomena API
   GIF -> очистка -> геопривязка -> PNG

   GET /api/phenomena
   GET /api/phenomena?frame=latest
   GET /api/phenomena?frame=0
   ========================================================= */

const SOURCE = "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";
const CACHE_MS = 60_000;

let cache = null;
let cacheTime = 0;
let pending = null;

const GIF_BOUNDS = [
  [38.2155955810, 14.9892981264],
  [69.6543707199, 72.9237642948]
];

const BOUNDS = {
  south: GIF_BOUNDS[0][0],
  west: GIF_BOUNDS[0][1],
  north: GIF_BOUNDS[1][0],
  east: GIF_BOUNDS[1][1]
};

/* CLOrad — базовая калибровка */

const UC_LON = 42.7295125;
const UC_MERC = 1.159140403966;
const US_LON = 11.984477282034;
const US_MERC = 0.080017466461;

const PX = [
  614.702787260693,
  213.524267491052,
  86.865800553715,
  17.052995641967,
  -18.941081998370,
  -3.466637383242
];

const PY = [
  548.709828924571,
  231.245550214358,
  -80.613999910294,
  -23.817051905972,
  -12.895624928117,
  3.365220370149
];

const CALIBRATION_WIDTH = 1122;
const CALIBRATION_HEIGHT = 1136;

const GEO_ADJUST = {
  shiftLon: 0,
  shiftMerc: 0,
  scaleLon: 1,
  scaleMerc: 1
};

function mercatorY(lat) {
  const rad = lat * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function geoToSource(lon, mercY) {
  const x = (lon - UC_LON) / US_LON;
  const y = (mercY - UC_MERC) / US_MERC;

  const xx = x * x;
  const xy = x * y;
  const yy = y * y;

  const sx =
    PX[0] + PX[1] * x + PX[2] * y +
    PX[3] * xx + PX[4] * xy + PX[5] * yy;

  const sy =
    PY[0] + PY[1] * x + PY[2] * y +
    PY[3] * xx + PY[4] * xy + PY[5] * yy;

  return [sx, sy];
}

function isServicePixel(x, y, width, height) {
  const sx = x * CALIBRATION_WIDTH / width;
  const sy = y * CALIBRATION_HEIGHT / height;

  if (sx <= 145 && sy <= 365) return true;
  if (sy <= 58) return true;
  if (sx <= 160 && sy >= 965) return true;
  if (sy >= 1105) return true;
  if (sx >= 760 && sy >= 1060) return true;
  if (sx >= 735 && sy <= 65) return true;

  return false;
}

function isPhenomena(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;

  if (max < 70 || spread < 30) return false;

  const saturation = spread / max;

  if (saturation < 0.15) return false;
  if (max > 238 && saturation < 0.20) return false;

  return true;
}

function reprojectFrame(source, width, height) {
  const output = Buffer.alloc(width * height * 4);

  const west = BOUNDS.west;
  const east = BOUNDS.east;
  const southMerc = mercatorY(BOUNDS.south);
  const northMerc = mercatorY(BOUNDS.north);

  const lonStep = (east - west) / Math.max(1, width - 1);
  const mercStep = (northMerc - southMerc) / Math.max(1, height - 1);

  const scaleLon =
    Number.isFinite(GEO_ADJUST.scaleLon) && GEO_ADJUST.scaleLon > 0
      ? GEO_ADJUST.scaleLon
      : 1;

  const scaleMerc =
    Number.isFinite(GEO_ADJUST.scaleMerc) && GEO_ADJUST.scaleMerc > 0
      ? GEO_ADJUST.scaleMerc
      : 1;

  for (let y = 0; y < height; y++) {
    const mercY = northMerc - y * mercStep;

    for (let x = 0; x < width; x++) {
      const lon = west + x * lonStep;

      const correctedLon =
        UC_LON + (lon - UC_LON - GEO_ADJUST.shiftLon) / scaleLon;

      const correctedMerc =
        UC_MERC + (mercY - UC_MERC - GEO_ADJUST.shiftMerc) / scaleMerc;

      const [calX, calY] = geoToSource(correctedLon, correctedMerc);

      const sourceX = Math.round(calX * width / CALIBRATION_WIDTH);
      const sourceY = Math.round(calY * height / CALIBRATION_HEIGHT);

      if (
        sourceX < 0 || sourceX >= width ||
        sourceY < 0 || sourceY >= height
      ) continue;

      if (isServicePixel(sourceX, sourceY, width, height)) continue;

      const si = (sourceY * width + sourceX) * 4;

      if (!source[si + 3]) continue;

      const r = source[si];
      const g = source[si + 1];
      const b = source[si + 2];

      if (!isPhenomena(r, g, b)) continue;

      const oi = (y * width + x) * 4;

      output[oi] = r;
      output[oi + 1] = g;
      output[oi + 2] = b;
      output[oi + 3] = 255;
    }
  }

  return output;
}

async function buildFrames() {
  const sharp = require("sharp");
  const { parseGIF, decompressFrames } = require("gifuct-js");

  const response = await fetch(SOURCE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; QuantumMeteo/1.0)",
      "Accept": "image/gif,image/*,*/*;q=0.8",
      "Referer": "https://meteoinfo.ru/radanim"
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Meteoinfo HTTP ${response.status}`);
  }

  const input = Buffer.from(await response.arrayBuffer());

  if (input.toString("ascii", 0, 3) !== "GIF") {
    throw new Error("Источник не вернул GIF");
  }

  const gif = parseGIF(input);
  const parsedFrames = decompressFrames(gif, true);

  const width = gif.lsd.width;
  const height = gif.lsd.height;
  const pixelCount = width * height;

  if (!width || !height || !parsedFrames.length) {
    throw new Error("Не удалось разобрать GIF");
  }

  const rawFrames = [];
  let canvas = Buffer.alloc(pixelCount * 4);

  /* Сборка полных кадров с учётом disposal GIF */

  for (const frame of parsedFrames) {
    const dims = frame.dims;
    const patch = frame.patch;

    const previousCanvas =
      frame.disposalType === 3 ? Buffer.from(canvas) : null;

    for (let py = 0; py < dims.height; py++) {
      for (let px = 0; px < dims.width; px++) {
        const dx = dims.left + px;
        const dy = dims.top + py;

        if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;

        const si = (py * dims.width + px) * 4;
        const di = (dy * width + dx) * 4;
        const alpha = patch[si + 3];

        if (!alpha) continue;

        if (alpha === 255) {
          canvas[di] = patch[si];
          canvas[di + 1] = patch[si + 1];
          canvas[di + 2] = patch[si + 2];
          canvas[di + 3] = 255;
        } else {
          const sa = alpha / 255;
          const da = canvas[di + 3] / 255;
          const oa = sa + da * (1 - sa);

          if (oa > 0) {
            for (let c = 0; c < 3; c++) {
              canvas[di + c] = Math.round(
                (
                  patch[si + c] * sa +
                  canvas[di + c] * da * (1 - sa)
                ) / oa
              );
            }

            canvas[di + 3] = Math.round(oa * 255);
          }
        }
      }
    }

    rawFrames.push({
      pixels: Buffer.from(canvas),
      delay: Math.max(100, Number(frame.delay) || 70) * 10
    });

    if (frame.disposalType === 2) {
      for (let py = 0; py < dims.height; py++) {
        for (let px = 0; px < dims.width; px++) {
          const dx = dims.left + px;
          const dy = dims.top + py;

          if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;

          const di = (dy * width + dx) * 4;
          canvas.fill(0, di, di + 4);
        }
      }
    } else if (frame.disposalType === 3 && previousCanvas) {
      canvas = previousCanvas;
    }
  }

  /* Поиск стабильных цветных областей */

  const stableBackground = new Uint8Array(pixelCount);

  if (rawFrames.length >= 3) {
    for (let p = 0; p < pixelCount; p++) {
      const i = p * 4;

      let minR = 255, maxR = 0;
      let minG = 255, maxG = 0;
      let minB = 255, maxB = 0;
      let count = 0;

      for (const frame of rawFrames) {
        const data = frame.pixels;

        if (!data[i + 3]) continue;

        minR = Math.min(minR, data[i]);
        maxR = Math.max(maxR, data[i]);
        minG = Math.min(minG, data[i + 1]);
        maxG = Math.max(maxG, data[i + 1]);
        minB = Math.min(minB, data[i + 2]);
        maxB = Math.max(maxB, data[i + 2]);

        count++;
      }

      if (count < 3) continue;

      const variation = Math.max(
        maxR - minR,
        maxG - minG,
        maxB - minB
      );

      if (variation <= 3) {
        const data = rawFrames[0].pixels;

        if (isPhenomena(data[i], data[i + 1], data[i + 2])) {
          stableBackground[p] = 1;
        }
      }
    }
  }

  /* Очистка, перепроекция и сжатие PNG */

  const frames = [];

  for (let index = 0; index < rawFrames.length; index++) {
    const sourcePixels = rawFrames[index].pixels;
    const filtered = Buffer.from(sourcePixels);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const i = p * 4;

        const invalid =
          isServicePixel(x, y, width, height) ||
          stableBackground[p] ||
          !sourcePixels[i + 3] ||
          !isPhenomena(
            sourcePixels[i],
            sourcePixels[i + 1],
            sourcePixels[i + 2]
          );

        filtered[i + 3] = invalid ? 0 : 255;
      }
    }

    const output = reprojectFrame(filtered, width, height);

    const png = await sharp(output, {
      raw: { width, height, channels: 4 }
    })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    frames.push({
      index,
      delay: rawFrames[index].delay,
      png: png.toString("base64")
    });
  }

  console.info("[Quantum Phenomena] GIF обработан", {
    width,
    height,
    frameCount: frames.length,
    bounds: GIF_BOUNDS,
    adjustment: GEO_ADJUST
  });

  return {
    ok: true,
    width,
    height,
    frameCount: frames.length,
    frames,
    bounds: BOUNDS,
    updatedAt: new Date().toISOString()
  };
}

/* API — отдаём только запрошенный кадр */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let data;

  if (cache && Date.now() - cacheTime < CACHE_MS) {
    data = cache;
  } else if (pending) {
    try {
      data = await pending;
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error: "Не удалось обработать GIF",
        details: error.message
      });
    }
  } else {
    pending = buildFrames();

    try {
      data = await pending;
      cache = data;
      cacheTime = Date.now();
    } catch (error) {
      console.error("[Quantum Phenomena]", error);

      return res.status(502).json({
        ok: false,
        error: "Не удалось обработать GIF",
        details: error.message
      });
    } finally {
      pending = null;
    }
  }

  if (!data || !Array.isArray(data.frames) || !data.frames.length) {
    return res.status(502).json({ ok: false, error: "Нет доступных кадров" });
  }

  const requested = req.query?.frame;
  const index = requested === undefined || requested === "latest"
    ? data.frames.length - 1
    : Number(requested);

  if (!Number.isInteger(index) || index < 0 || index >= data.frames.length) {
    return res.status(400).json({
      ok: false,
      error: "Неверный номер кадра",
      frameCount: data.frames.length
    });
  }

  const frame = data.frames[index];

  return res.status(200).json({
    ok: true,
    width: data.width,
    height: data.height,
    frameCount: data.frames.length,
    frame: {
      index: frame.index,
      delay: frame.delay,
      png: frame.png
    },
    bounds: data.bounds,
    updatedAt: data.updatedAt
  });
};
