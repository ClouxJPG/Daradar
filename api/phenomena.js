const SOURCE = "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";
const CACHE_MS = 60_000;
const MAX_FRAMES = 30;

let cache = null;
let cacheTime = 0;
let pending = null;

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

  if (hue < 0) hue += 360;

  return (
    (hue >= 75 && hue <= 175) ||
    (hue > 175 && hue <= 225) ||
    (hue > 225 && hue <= 260) ||
    (hue >= 35 && hue < 75) ||
    hue < 35 ||
    (hue >= 260 && hue <= 330)
  );
}

function cleanFrame(raw, width, height) {
  const output = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      const a = raw[i + 3];

      // Удаляем легенду слева сверху.
      if (x < 138 && y < 350) continue;

      // Удаляем логотипы слева снизу.
      if (x < 115 && y > 1040) continue;

      if (!a || !keepRadarPixel(r, g, b)) continue;

      output[i] = r;
      output[i + 1] = g;
      output[i + 2] = b;
      output[i + 3] = a;
    }
  }

  return output;
}

async function fetchSource() {
  const response = await fetch(SOURCE, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; QuantumMeteo/1.0)",
      Accept: "image/gif,image/*,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Meteoinfo вернул HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (
    buffer.length < 10 ||
    buffer[0] !== 0x47 ||
    buffer[1] !== 0x49 ||
    buffer[2] !== 0x46
  ) {
    throw new Error("Источник не вернул GIF");
  }

  return buffer;
}

async function processGif(sharp, input) {
  const metadata = await sharp(input, {
    animated: true,
    pages: -1,
    failOn: "none"
  }).metadata();

  const width = metadata.width;
  const height = metadata.pageHeight || metadata.height;
  const pageCount = Math.min(
    Math.max(1, metadata.pages || 1),
    MAX_FRAMES
  );

  if (!width || !height || width < 100 || height < 100) {
    throw new Error("Некорректный размер GIF");
  }

  const delays = Array.isArray(metadata.delay)
    ? metadata.delay
    : [];

  const frames = [];

  for (let index = 0; index < pageCount; index++) {
    try {
      const raw = await sharp(input, {
        page: index,
        pages: 1,
        failOn: "none"
      })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      if (
        raw.info.width !== width ||
        raw.info.height !== height ||
        raw.data.length < width * height * 4
      ) {
        continue;
      }

      const cleaned = cleanFrame(raw.data, width, height);

      const png = await sharp(cleaned, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
        .png()
        .toBuffer();

      const delay = Number(delays[index]);

      frames.push({
        index,
        delay: Number.isFinite(delay) && delay > 0 ? delay : 700,
        png: png.toString("base64")
      });
    } catch (error) {
      console.error(
        `Quantum Meteo: кадр ${index} пропущен`,
        error.message
      );
    }
  }

  if (!frames.length) {
    throw new Error("Не удалось декодировать кадры GIF");
  }

  return {
    width,
    height,
    loop: metadata.loop ?? 0,
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (cache && Date.now() - cacheTime < CACHE_MS) {
    return res.status(200).json(cache);
  }

  if (pending) {
    try {
      return res.status(200).json(await pending);
    } catch (error) {
      return res.status(502).json({ error: error.message });
    }
  }

  pending = (async () => {
    const sharp = require("sharp");
    const input = await fetchSource();
    return processGif(sharp, input);
  })();

  try {
    const result = await pending;
    cache = result;
    cacheTime = Date.now();

    return res.status(200).json(result);
  } catch (error) {
    console.error("Quantum Meteo phenomena API:", error);

    return res.status(502).json({
      error: "Не удалось обработать GIF Meteoinfo",
      details: error.message
    });
  } finally {
    pending = null;
  }
};
