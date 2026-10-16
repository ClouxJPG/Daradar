/* =========================================================
   Quantum Meteo — Phenomena API
   GIF -> PNG с прозрачным картографическим фоном

   Сохраняет цветные метеоявления.
   Удаляет нейтральную подложку, серые круги,
   легенду и служебные надписи у краёв.
   ========================================================= */

const SOURCE =
  "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";

const CACHE_MS = 60_000;

let cache = null;
let cacheTime = 0;
let pending = null;

const BOUNDS = {
  south: 38.2156,
  west: 14.9893,
  north: 69.6544,
  east: 72.9238
};

function isPhenomena(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;

  // Нейтральные цвета: карта, серые зоны покрытия,
  // подписи и большая часть служебной графики.
  if (spread < 13) return false;

  // Явные цветные зоны.
  if (spread >= 30) return true;

  // Слабые голубые и синие эхо-сигналы.
  if (b > r + 7 && b >= g - 4) return true;

  // Зелёные и бирюзовые слабые отражения.
  if (g > r + 8 && g >= b - 12) return true;

  // Жёлтые, оранжевые и красные отражения.
  if (r > b + 15 && g > b + 8) return true;

  return false;
}

function removeServiceAreas(raw, width, height) {
  const out = Buffer.from(raw);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // Легенда и подписи оборудования слева.
      if (x < Math.floor(width * 0.065)) {
        out[i + 3] = 0;
        continue;
      }

      // Логотипы и копирайт внизу слева.
      if (
        x < Math.floor(width * 0.09) &&
        y > Math.floor(height * 0.89)
      ) {
        out[i + 3] = 0;
        continue;
      }

      // Время, напечатанное поверх карты вверху и внизу.
      // Убираем узкие полосы с метками времени.
      if (
        y < Math.floor(height * 0.025) ||
        y > Math.floor(height * 0.975)
      ) {
        out[i + 3] = 0;
        continue;
      }

      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];

      if (!isPhenomena(r, g, b)) {
        out[i + 3] = 0;
      } else {
        // Сохраняем исходную яркость и цвет эха.
        out[i + 3] = 255;
      }
    }
  }

  return out;
}

async function buildFrames() {
  const sharp = require("sharp");
  const { parseGIF, decompressFrames } = require("gifuct-js");

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

  if (!width || !height || !parsedFrames.length) {
    throw new Error("Не удалось разобрать GIF");
  }

  // Не придумываем дополнительные кадры:
  // используем только реально присутствующие в GIF.
  const frames = [];
  let canvas = Buffer.alloc(width * height * 4);

  for (let index = 0; index < parsedFrames.length; index++) {
    const frame = parsedFrames[index];
    const dims = frame.dims;
    const patch = frame.patch;

    const previousCanvas =
      frame.disposalType === 3 ? Buffer.from(canvas) : null;

    for (let py = 0; py < dims.height; py++) {
      for (let px = 0; px < dims.width; px++) {
        const dx = dims.left + px;
        const dy = dims.top + py;

        if (
          dx < 0 || dy < 0 ||
          dx >= width || dy >= height
        ) continue;

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

    const transparent = removeServiceAreas(
      canvas,
      width,
      height
    );

    const png = await sharp(transparent, {
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
      delay: Math.max(100, Number(frame.delay) || 70) * 10,
      png: png.toString("base64")
    });

    if (frame.disposalType === 2) {
      for (let py = 0; py < dims.height; py++) {
        for (let px = 0; px < dims.width; px++) {
          const dx = dims.left + px;
          const dy = dims.top + py;

          if (
            dx < 0 || dy < 0 ||
            dx >= width || dy >= height
          ) continue;

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
