
/* =========================================================
   Quantum Meteo — Meteoinfo Phenomena API
   Source: Meteoinfo phenomena.gif
   Server-side GIF decoding and transparency processing.
   ========================================================= */

const SOURCE =
  "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
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

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("image/gif")) {
      throw new Error("Meteoinfo did not return a GIF");
    }

    const input = Buffer.from(await response.arrayBuffer());

    if (
      input.length < 100 ||
      input.toString("ascii", 0, 3) !== "GIF"
    ) {
      throw new Error("Invalid GIF");
    }

    // Decode each GIF frame and process the pixels.
    // sharp is installed through package.json.
    const sharp = require("sharp");

    const decoded = sharp(input, {
      animated: true,
      pages: -1,
      failOn: "error"
    });

    const metadata = await decoded.metadata();

    if (
      !metadata.width ||
      !metadata.height ||
      !metadata.pages
    ) {
      throw new Error("Could not decode GIF frames");
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
    const height = info.height;
    const channels = info.channels;
    const frameHeight = height;
    const frameCount = metadata.pages;
    const frameSize = width * frameHeight * channels;

    if (
      frameCount < 1 ||
      frameSize * frameCount > data.length
    ) {
      throw new Error("Unexpected GIF frame layout");
    }

    /*
     * Return transparent PNG frames as a vertical sprite sheet.
     *
     * Important:
     * - Only clearly neutral pixels are removed.
     * - Saturated meteorological colors are retained.
     * - This does not claim to remove every map label or boundary.
     * - Original georeferencing must be calibrated separately.
     */
    const processed = Buffer.from(data);

    for (let i = 0; i < processed.length; i += channels) {
      const r = processed[i];
      const g = processed[i + 1];
      const b = processed[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const difference = max - min;

      // Neutral map background only. Preserve colored phenomena.
      if (difference < 12 && max > 125 && max < 244) {
        processed[i + 3] = 0;
      }
    }

    const output = await sharp(processed, {
      raw: {
        width,
        height,
        channels
      }
    })
      .png()
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=30"
    );
    res.setHeader("X-QuantumMeteo-Source", "meteoinfo.ru");

    if (req.method === "HEAD") {
      return res.status(200).end();
    }

    return res.status(200).send(output);
  } catch (error) {
    console.error("[Quantum Meteo Phenomena]", error);

    res.setHeader("Cache-Control", "no-store");

    return res.status(502).json({
      ok: false,
      error: "Could not process Meteoinfo phenomena",
      details: error.message || "Unknown error"
    });
  }
};
