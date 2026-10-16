/* =========================================================
   Quantum Meteo — Phenomena API
   GIF -> PNG с прозрачным картографическим фоном

   Удаляет:
   - нейтральную подложку и серые круги;
   - легенду и служебные надписи;
   - стабильные цветные участки картографического фона;
   - мелкий цветовой шум.

   Сохраняет изменяющиеся метеоявления.
   ========================================================= */

const SOURCE =
  "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";

const CACHE_MS = 60_000;

let cache = null;
let cacheTime = 0;
let pending = null;

/* =========================================================
   Точные границы исходного GIF
   Порядок: [[юг, запад], [север, восток]]
   ========================================================= */

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

/* =========================================================
   Служебные области
   ========================================================= */

function isServicePixel(x, y, width, height) {
  const legendRight = Math.floor(width * 0.105);
  const legendBottom = Math.floor(height * 0.285);

  const bottomLogoRight = Math.floor(width * 0.09);
  const bottomLogoTop = Math.floor(height * 0.89);

  const topStrip = Math.floor(height * 0.025);
  const bottomStrip = Math.floor(height * 0.975);

  if (x < legendRight && y < legendBottom) {
    return true;
  }

  if (x < bottomLogoRight && y >= bottomLogoTop) {
    return true;
  }

  return y < topStrip || y >= bottomStrip;
}

/* =========================================================
   Строгая цветовая маска
   ========================================================= */

function isPhenomena(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;

  if (spread < 24) return false;

  if (max > 215 && spread < 55) return false;

  // Синий и голубой.
  if (
    b >= 95 &&
    b >= r + 22 &&
    b >= g - 15 &&
    spread >= 30
  ) {
    return true;
  }

  // Зелёный.
  if (
    g >= 85 &&
    g >= r + 18 &&
    g >= b - 22 &&
    spread >= 28
  ) {
    return true;
  }

  // Жёлтый и оранжевый.
  if (
    r >= 145 &&
    g >= 105 &&
    r >= b + 35 &&
    g >= b + 20
  ) {
    return true;
  }

  // Красный и розовый.
  if (
    r >= 145 &&
    r >= g + 20 &&
    r >= b + 25
  ) {
    return true;
  }

  // Фиолетовый.
  if (
    b >= 90 &&
    r >= 90 &&
    b >= g + 18 &&
    r >= g + 18 &&
    spread >= 35
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   Сборка кадров GIF
   ========================================================= */

async function buildFrames() {
  const sharp = require("sharp");
  const {
    parseGIF,
    decompressFrames
  } = require("gifuct-js");

  const response = await fetch(SOURCE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; QuantumMeteo/1.0)",
      Accept: "image/gif,image/*,*/*;q=0.8"
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

  for (const frame of parsedFrames) {
    const dims = frame.dims;
    const patch = frame.patch;

    const previousCanvas =
      frame.disposalType === 3
        ? Buffer.from(canvas)
        : null;

    for (let py = 0; py < dims.height; py++) {
      for (let px = 0; px < dims.width; px++) {
        const dx = dims.left + px;
        const dy = dims.top + py;

        if (
          dx < 0 ||
          dy < 0 ||
          dx >= width ||
          dy >= height
        ) {
          continue;
        }

        const si = (py * dims.width + px) * 4;
        const di = (dy * width + dx) * 4;
        const alpha = patch[si + 3];

        if (alpha === 0) continue;

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

          if (
            dx < 0 ||
            dy < 0 ||
            dx >= width ||
            dy >= height
          ) {
            continue;
          }

          const di = (dy * width + dx) * 4;
          canvas.fill(0, di, di + 4);
        }
      }
    } else if (
      frame.disposalType === 3 &&
      previousCanvas
    ) {
      canvas = previousCanvas;
    }
  }

  /* =======================================================
     Анализ стабильности пикселей между кадрами
     ======================================================= */

  const stableBackground = new Uint8Array(pixelCount);

  if (rawFrames.length >= 3) {
    for (let p = 0; p < pixelCount; p++) {
      const i = p * 4;

      let minR = 255;
      let maxR = 0;
      let minG = 255;
      let maxG = 0;
      let minB = 255;
      let maxB = 0;
      let coloredCount = 0;

      for (const frame of rawFrames) {
        const data = frame.pixels;

        if (data[i + 3] === 0) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minG = Math.min(minG, g);
        maxG = Math.max(maxG, g);
        minB = Math.min(minB, b);
        maxB = Math.max(maxB, b);

        coloredCount++;
      }

      if (coloredCount < 3) continue;

      const variation = Math.max(
        maxR - minR,
        maxG - minG,
        maxB - minB
      );

      if (variation <= 3) {
        const r = rawFrames[0].pixels[i];
        const g = rawFrames[0].pixels[i + 1];
        const b = rawFrames[0].pixels[i + 2];

        if (isPhenomena(r, g, b)) {
          stableBackground[p] = 1;
        }
      }
    }
  }

  /* =======================================================
     Прозрачные PNG
     ======================================================= */

  const frames = [];

  for (let index = 0; index < rawFrames.length; index++) {
    const sourcePixels = rawFrames[index].pixels;
    const output = Buffer.from(sourcePixels);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const i = p * 4;

        if (isServicePixel(x, y, width, height)) {
          output[i + 3] = 0;
          continue;
        }

        if (stableBackground[p]) {
          output[i + 3] = 0;
          continue;
        }

        if (sourcePixels[i + 3] === 0) {
          output[i + 3] = 0;
          continue;
        }

        if (
          !isPhenomena(
            sourcePixels[i],
            sourcePixels[i + 1],
            sourcePixels[i + 2]
          )
        ) {
          output[i + 3] = 0;
          continue;
        }

        output[i + 3] = 255;
      }
    }

    const png = await sharp(output, {
      raw: {
        width,
        height,
        channels: 4
      }
    })
      .png()
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
    bounds: GIF_BOUNDS
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

/* =========================================================
   API handler
   ========================================================= */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  if (cache && Date.now() - cacheTime < CACHE_MS) {
    return res.status(200).json(cache);
  }

  if (pending) {
    try {
      return res.status(200).json(await pending);
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error: error.message
      });
    }
  }

  pending = buildFrames();

  try {
    const result = await pending;

    cache = result;
    cacheTime = Date.now();

    return res.status(200).json(result);
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
};
