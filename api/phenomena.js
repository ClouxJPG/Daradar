
/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena API
   GET /api/phenomena

   - Серверная обработка GIF через sharp
   - Отдельная обработка каждого кадра
   - Удаление подложки, подписей и серых зон
   - Сохранение цветных метеоявлений
   - Прозрачные PNG-кадры для Leaflet
   ========================================================= */

const SOURCE =
  "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";

const CACHE_MS = 60_000;
const FRAME_DELAY = 500;
const MAX_FRAMES = 30;

let cachedResult = null;
let cachedAt = 0;
let pending = null;

function sendJson(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function keepRadarPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (max < 45 || delta < 24) {
    return false;
  }

  const saturation = max === 0 ? 0 : (delta / max) * 255;

  if (saturation < 50) {
    return false;
  }

  let hue;

  if (delta === 0) {
    hue = 0;
  } else if (max === r) {
    hue = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    hue = 60 * ((b - r) / delta + 2);
  } else {
    hue = 60 * ((r - g) / delta + 4);
  }

  hue = (hue + 360) % 360;

  /*
   * Основные оттенки легенды Meteoinfo:
   * голубой, зелёный, жёлтый, оранжевый,
   * красный, розовый и фиолетовый.
   */
  return (
    (hue >= 75 && hue <= 175) ||
    (hue >= 175 && hue <= 225) ||
    (hue >= 225 && hue <= 260) ||
    (hue >= 35 && hue < 75) ||
    (hue >= 0 && hue < 35) ||
    (hue >= 260 && hue <= 330)
  );
}

async function fetchSource() {
  const upstream = await fetch(SOURCE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; QuantumMeteo/1.0)",
      "Accept": "image/gif,image/*;q=0.9,*/*;q=0.5"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!upstream.ok) {
    throw new Error("Meteoinfo HTTP " + upstream.status);
  }

  const input = Buffer.from(await upstream.arrayBuffer());

  if (
    input.length < 100 ||
    !["GIF87a", "GIF89a"].includes(input.toString("ascii", 0, 6))
  ) {
    throw new Error("Meteoinfo did not return a valid GIF");
  }

  return input;
}

async function processGif() {
  const sharp = require("sharp");
  const input = await fetchSource();

  const metadata = await sharp(input, {
    animated: true,
    pages: -1,
    failOn: "error"
  }).metadata();

  const width = metadata.width;
  const height = metadata.pageHeight || metadata.height;
  const pages = metadata.pages;

  if (
    !width ||
    !height ||
    !pages ||
    pages < 1 ||
    pages > MAX_FRAMES
  ) {
    throw new Error(
      "Unexpected GIF metadata: " +
      JSON.stringify({
        width,
        height,
        pages,
        pageHeight: metadata.pageHeight
      })
    );
  }

  const outputFrames = [];

  for (let page = 0; page < pages; page++) {
    /*
     * Запрашиваем один кадр декодера.
     * Не разрезаем общий буфер вручную.
     */
    const frameResult = await sharp(input, {
      page,
      pages: 1,
      failOn: "error"
    })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const frameWidth = frameResult.info.width;
    const frameHeight = frameResult.info.height;
    const channels = frameResult.info.channels;

    if (
      frameWidth !== width ||
      frameHeight !== height ||
      channels !== 4
    ) {
      throw new Error(
        "Unexpected dimensions for frame " + page +
        ": " + frameWidth + "x" + frameHeight +
        ", channels=" + channels
      );
    }

    const pixels = Buffer.from(frameResult.data);

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      if (!keepRadarPixel(r, g, b)) {
        pixels[i + 3] = 0;
      }
    }

    const png = await sharp(pixels, {
      raw: {
        width: frameWidth,
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
      delay: FRAME_DELAY,
      png: png.toString("base64")
    });
  }

  return {
    ok: true,
    width,
    height,
    frameCount: outputFrames.length,
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
        res.setHeader("Content-Type", "application/json; charset=utf-8");
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
      res.setHeader("Content-Type", "application/json; charset=utf-8");
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
