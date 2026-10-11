
/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena API
   GET /api/phenomena
   Возвращает прозрачные PNG-кадры и метаданные в JSON.
   Требует sharp из package.json.
   ========================================================= */

const SOURCE =
  "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";

const CACHE_MS = 60_000;
let cachedResult = null;
let cachedAt = 0;
let pending = null;

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return json(res, 405, {
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
      return json(res, 200, cachedResult);
    }

    if (!pending) {
      pending = (async () => {
        const sharp = require("sharp");

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
          !["GIF87a", "GIF89a"].includes(
            input.toString("ascii", 0, 6)
          )
        ) {
          throw new Error("Meteoinfo did not return a valid GIF");
        }

        const decoder = sharp(input, {
          animated: true,
          pages: -1,
          failOn: "error"
        });

        const metadata = await decoder.metadata();

        if (
          !metadata.width ||
          !metadata.height ||
          !metadata.pages ||
          metadata.pages > 60
        ) {
          throw new Error("Unexpected GIF dimensions or frame count");
        }

        const { data, info } = await sharp(input, {
          animated: true,
          pages: -1,
          failOn: "error"
        })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const width = info.width;
        const totalHeight = info.height;
        const channels = info.channels;
        const frames = metadata.pages;
        const frameHeight = metadata.pageHeight || metadata.height;

        if (
          !width ||
          !frameHeight ||
          totalHeight < frameHeight * frames ||
          channels !== 4
        ) {
          throw new Error("Unsupported decoded GIF frame layout");
        }

        const frameBytes = width * frameHeight * channels;
        const outputFrames = [];

        for (let frame = 0; frame < frames; frame++) {
          const start = frame * frameBytes;
          const end = start + frameBytes;

          if (end > data.length) {
            throw new Error("Incomplete GIF frame data");
          }

          const pixels = Buffer.from(data.subarray(start, end));

          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const difference = max - min;

            /*
             * Conservative neutral-color removal.
             * Strongly colored precipitation remains visible.
             * Some gray coverage and map labels may remain.
             */
            if (
              difference < 12 &&
              max > 125 &&
              max < 244
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
            delay: 500,
            png: png.toString("base64")
          });
        }

        return {
          ok: true,
          width,
          height: frameHeight,
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
      })();
    }

    const result = await pending;
    cachedResult = result;
    cachedAt = Date.now();

    if (req.method === "HEAD") {
      res.setHeader("Content-Type", "application/json");
      return res.status(200).end();
    }

    return json(res, 200, result);
  } catch (error) {
    console.error("[Quantum Meteo Phenomena API]", error);

    return json(res, 502, {
      ok: false,
      error: "Не удалось обработать GIF Meteoinfo",
      details: error.message || "Unknown error"
    });
  } finally {
    pending = null;
  }
};
