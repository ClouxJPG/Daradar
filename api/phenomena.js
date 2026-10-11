
/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena API
   GET /api/phenomena

   Сервер:
   - декодирование анимированного GIF;
   - очистка каждого кадра через sharp;
   - прозрачные PNG вместо исходной карты;
   - удаление легенды и логотипов;
   - кеширование результата на 60 секунд.
   ========================================================= */

const SOURCE =
  "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";

const CACHE_MS = 60_000;
const MAX_FRAMES = 30;

let cachedResult = null;
let cachedAt = 0;
let pending = null;

function sendJson(res, status, body) {
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function keepRadarPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (max < 45 || delta < 24) return false;

  const saturation = (delta / max) * 255;
  if (saturation < 50) return false;

  let hue;

  if (max === r) {
    hue = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    hue = 60 * ((b - r) / delta + 2);
  } else {
    hue = 60 * ((r - g) / delta + 4);
  }

  hue = (hue + 360) % 360;

  return (
    (hue >= 75 && hue <= 175) ||
    (hue > 175 && hue <= 225) ||
    (hue > 225 && hue <= 260) ||
    (hue >= 35 && hue < 75) ||
    (hue >= 0 && hue < 35) ||
    (hue > 260 && hue <= 330)
  );
}

async function fetchGif() {
  const response = await fetch(SOURCE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; QuantumMeteo/1.0)",
      "Accept": "image/gif,image/*;q=0.9,*/*;q=0.5"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error("Meteoinfo HTTP " + response.status);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const signature = buffer.toString("ascii", 0, 6);

  if (
    buffer.length < 100 ||
    (signature !== "GIF87a" && signature !== "GIF89a")
  ) {
    throw new Error("Meteoinfo did not return a valid GIF");
  }

  return buffer;
}

async function processGif() {
  const sharp = require("sharp");
  const input = await fetchGif();

  const metadata = await sharp(input, {
    animated: true,
    pages: -1,
    failOn: "error"
  }).metadata();

  const width = metadata.width;
  const frameHeight = metadata.pageHeight || metadata.height;
  const frameCount = metadata.pages;

  if (
    !width ||
    !frameHeight ||
    !frameCount ||
    frameCount > MAX_FRAMES
  ) {
    throw new Error(
      "Invalid GIF metadata: " +
      JSON.stringify({
        width,
        height: metadata.height,
        pageHeight: metadata.pageHeight,
        pages: frameCount
      })
    );
  }

  /*
   * Декодируем GIF целиком один раз.
   * В sharp анимированные страницы образуют вертикальный
   * буфер: ширина × (высота кадра × количество кадров).
   */
  const decoded = await sharp(input, {
    animated: true,
    pages: -1,
    failOn: "error"
  })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = decoded.info.channels;
  const decodedWidth = decoded.info.width;
  const totalHeight = decoded.info.height;

  if (
    channels !== 4 ||
    decodedWidth !== width ||
    totalHeight < frameHeight * frameCount
  ) {
    throw new Error(
      "Unexpected decoded GIF layout: " +
      JSON.stringify({
        decodedWidth,
        totalHeight,
        channels,
        width,
        frameHeight,
        frameCount
      })
    );
  }

  const outputFrames = [];
  const frameBytes = width * frameHeight * 4;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    const start = frameIndex * frameBytes;
    const end = start + frameBytes;

    if (end > decoded.data.length) {
      throw new Error("Incomplete GIF frame " + frameIndex);
    }

    const pixels = Buffer.from(decoded.data.subarray(start, end));

    for (let i = 0; i < pixels.length; i += 4) {
      const pixel = i / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);

      /*
       * Удаляем легенду и подписи в левом верхнем углу,
       * не меняя размеры изображения.
       */
      const isLegend = x < 138 && y < 350;

      /*
       * Удаляем логотипы в левом нижнем углу.
       */
      const isLogo = x < 115 && y > 1040;

      if (isLegend || isLogo) {
        pixels[i + 3] = 0;
        continue;
      }

      if (
        !keepRadarPixel(
          pixels[i],
          pixels[i + 1],
          pixels[i + 2]
        )
      ) {
        pixels[i + 3] = 0;
      }
    }

    const png = await sharp(pixels, {
      raw: {
        width,
        height: frameHeight,
        channels: 4
      }
    })
      .png({
        compressionLevel: 6,
        adaptiveFiltering: false
      })
      .toBuffer();

    outputFrames.push({
      index: frameIndex,
      delay: 500,
      png: png.toString("base64")
    });
  }

  return {
    ok: true,
    width,
    height: frameHeight,
    frameCount: outputFrames.length,

    /*
     * Сохраняем существующие границы слоя.
     * Для точного географического совмещения нужно знать
     * фактическую проекцию исходной карты Meteoinfo.
     */
    bounds: {
      south: 38.2156,
      west: 14.9893,
      north: 69.6544,
      east: 72.9238
    },

    frames: outputFrames,
    source: "meteoinfo.ru"
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");

    return sendJson(res, 405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    if (cachedResult && Date.now() - cachedAt < CACHE_MS) {
      if (req.method === "HEAD") {
        res.setHeader("Content-Type", "application/json");
        return res.status(200).end();
      }

      return sendJson(res, 200, cachedResult);
    }

    if (!pending) {
      pending = processGif();
    }

    const result = await pending;

    cachedResult = result;
    cachedAt = Date.now();

    if (req.method === "HEAD") {
      res.setHeader("Content-Type", "application/json");
      return res.status(200).end();
    }

    return sendJson(res, 200, result);
  } catch (error) {
    console.error("[Quantum Meteo Phenomena API]", error);

    return sendJson(res, 502, {
      ok: false,
      error: "Не удалось обработать GIF Meteoinfo",
      details: error.message || "Unknown error"
    });
  } finally {
    pending = null;
  }
};
