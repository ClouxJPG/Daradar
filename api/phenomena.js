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

/* =========================================================
   Определение цветных метеоявлений
   ========================================================= */

function isPhenomena(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;

  // Убираем нейтральные цвета: подложку, серые круги,
  // большую часть границ и географической сетки.
  if (spread < 20) return false;

  // Дополнительно подавляем бледные картографические линии.
  if (max > 215 && spread < 55) return false;

  // Голубые и синие слабые эхо-сигналы.
  if (
    b > r + 9 &&
    b >= g - 10 &&
    spread >= 20
  ) {
    return true;
  }

  // Зелёные и бирюзовые отражения.
  if (
    g > r + 9 &&
    g >= b - 18 &&
    spread >= 20
  ) {
    return true;
  }

  // Жёлтые, оранжевые и красные отражения.
  if (
    r > b + 18 &&
    g > b + 10 &&
    spread >= 25
  ) {
    return true;
  }

  // Яркие цветные участки, включая фиолетовые.
  return spread >= 42;
}

/* =========================================================
   Удаление фона и служебных элементов
   ========================================================= */

function removeServiceAreas(raw, width, height) {
  const out = Buffer.from(raw);

  // Область легенды в левом верхнем углу.
  // Вырезаем её вместе с рамкой и текстом.
  const legendRight = Math.floor(width * 0.105);
  const legendBottom = Math.floor(height * 0.285);

  // Нижние логотипы.
  const bottomLogoRight = Math.floor(width * 0.09);
  const bottomLogoTop = Math.floor(height * 0.89);

  // Крайние полосы с датой и временем.
  const topStrip = Math.floor(height * 0.025);
  const bottomStrip = Math.floor(height * 0.975);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // Легенда и её подписи.
      if (x < legendRight && y < legendBottom) {
        out[i + 3] = 0;
        continue;
      }

      // Логотипы и копирайт снизу слева.
      if (
        x < bottomLogoRight &&
        y >= bottomLogoTop
      ) {
        out[i + 3] = 0;
        continue;
      }

      // Дата и время в верхней и нижней кромке.
      if (y < topStrip || y >= bottomStrip) {
        out[i + 3] = 0;
        continue;
      }

      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];

      if (!isPhenomena(r, g, b)) {
        out[i + 3] = 0;
      } else {
        // Сохраняем цветные метеоявления без затемнения.
        out[i + 3] = 255;
      }
    }
  }

  return out;
}

/* =========================================================
   Загрузка и обработка GIF
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

  if (!width || !height || !parsedFrames.length) {
    throw new Error("Не удалось разобрать GIF");
  }

  // Используем только реально существующие кадры GIF.
  const frames = [];

  // Холст для сборки кадров с частичными обновлениями.
  let canvas = Buffer.alloc(width * height * 4);

  for (
    let index = 0;
    index < parsedFrames.length;
    index++
  ) {
    const frame = parsedFrames[index];
    const dims = frame.dims;
    const patch = frame.patch;

    // Disposal method 3 восстанавливает предыдущий холст.
    const previousCanvas =
      frame.disposalType === 3
        ? Buffer.from(canvas)
        : null;

    // Накладываем текущий фрагмент GIF на холст.
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

    // Удаляем фон из готового кадра.
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
      delay: Math.max(
        100,
        Number(frame.delay) || 70
      ) * 10,
      png: png.toString("base64")
    });

    // Disposal method 2: очищаем область текущего кадра.
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

  console.info("[Quantum Phenomena] GIF обработан", {
    width,
    height,
    frameCount: frames.length
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

  if (
    cache &&
    Date.now() - cacheTime < CACHE_MS
  ) {
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
