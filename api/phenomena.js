
/* =========================================================
   Quantum Meteo — Phenomena API
   GIF -> отдельные полноценные PNG-кадры
   ========================================================= */

const SOURCE =
  "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";

const MAX_FRAMES = 30;
const CACHE_MS = 60_000;

let cache = null;
let cacheTime = 0;
let pending = null;

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
  const parsedFrames = decompressFrames(gif, true).slice(
    0,
    MAX_FRAMES
  );

  const width = gif.lsd.width;
  const height = gif.lsd.height;

  if (!width || !height || !parsedFrames.length) {
    throw new Error("Не удалось разобрать кадры GIF");
  }

  // Полный холст, на котором накапливаются изменения кадров.
  let canvas = Buffer.alloc(width * height * 4);
  const frames = [];

  for (let index = 0; index < parsedFrames.length; index++) {
    const frame = parsedFrames[index];
    const dims = frame.dims;
    const patch = frame.patch;

    // GIF disposal method 3: перед кадром нужно сохранить холст.
    const previousCanvas =
      frame.disposalType === 3 ? Buffer.from(canvas) : null;

    // Накладываем фрагмент кадра с учётом прозрачности.
    for (let py = 0; py < dims.height; py++) {
      for (let px = 0; px < dims.width; px++) {
        const sx = px;
        const sy = py;
        const dx = dims.left + px;
        const dy = dims.top + py;

        if (dx < 0 || dy < 0 || dx >= width || dy >= height) {
          continue;
        }

        const si = (sy * dims.width + sx) * 4;
        const di = (dy * width + dx) * 4;
        const alpha = patch[si + 3];

        if (alpha === 0) continue;

        if (alpha === 255) {
          canvas[di] = patch[si];
          canvas[di + 1] = patch[si + 1];
          canvas[di + 2] = patch[si + 2];
          canvas[di + 3] = 255;
        } else {
          const dstAlpha = canvas[di + 3] / 255;
          const srcAlpha = alpha / 255;
          const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

          if (outAlpha > 0) {
            for (let c = 0; c < 3; c++) {
              canvas[di + c] = Math.round(
                (
                  patch[si + c] * srcAlpha +
                  canvas[di + c] * dstAlpha * (1 - srcAlpha)
                ) / outAlpha
              );
            }
            canvas[di + 3] = Math.round(outAlpha * 255);
          }
        }
      }
    }

    const png = await sharp(Buffer.from(canvas), {
      raw: { width, height, channels: 4 }
    })
      .png()
      .toBuffer();

    frames.push({
      index,
      delay: Math.max(100, Number(frame.delay) || 70) * 10,
      png: png.toString("base64")
    });

    // Учитываем очистку кадра после его показа.
    if (frame.disposalType === 2) {
      for (let py = 0; py < dims.height; py++) {
        for (let px = 0; px < dims.width; px++) {
          const dx = dims.left + px;
          const dy = dims.top + py;

          if (dx < 0 || dy < 0 || dx >= width || dy >= height) {
            continue;
          }

          const di = (dy * width + dx) * 4;
          canvas.fill(0, di, di + 4);
        }
      }
    } else if (frame.disposalType === 3 && previousCanvas) {
      canvas = previousCanvas;
    }
  }

  // Проверяем, что хотя бы некоторые кадры различаются.
  const uniqueFrames = new Set(
    frames.map(frame => frame.png.slice(0, 200))
  );

  console.info("[Quantum Phenomena] GIF разобран", {
    width,
    height,
    frameCount: frames.length,
    uniqueFramePrefixes: uniqueFrames.size
  });

  return {
    ok: true,
    width,
    height,
    frameCount: frames.length,
    frames,
    bounds: {
      south: 38.2156,
      west: 14.9893,
      north: 69.6544,
      east: 72.9238
    },
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
