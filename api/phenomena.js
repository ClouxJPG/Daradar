// =========================================================
// Daradar — Meteoinfo Phenomena GIF API
// Источник: https://meteoinfo.ru/hmc-output/rmap/phenomena.gif
//
// GET /api/phenomena — получить актуальный GIF
// HEAD /api/phenomena — проверить доступность источника
//
// ВАЖНО:
// Источник отдаёт анимацию метеоявлений за последние часы.
// Это не API архива отдельных кадров.
// =========================================================
module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }
  const SOURCE =
    "https://meteoinfo.ru/hmc-output/rmap/phenomena.gif";
  try {
    const upstream = await fetch(SOURCE, {
      method: req.method,
      headers: {
        "User-Agent": "Mozilla/5.0 Daradar Weather Radar",
        "Accept": "image/gif,image/*;q=0.9,*/*;q=0.5"
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({
        ok: false,
        error: "Meteoinfo source unavailable",
        upstreamStatus: upstream.status
      });
    }
    const contentType =
      upstream.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("image/gif")) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({
        ok: false,
        error: "Meteoinfo returned an unexpected content type",
        upstreamContentType: contentType
      });
    }
    if (req.method === "HEAD") {
      res.setHeader("Content-Type", "image/gif");
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=120, stale-while-revalidate=60"
      );
      res.setHeader("X-Daradar-Source", "meteoinfo.ru");
      return res.status(200).end();
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    // Проверяем сигнатуру GIF87a или GIF89a.
    const validGif =
      bytes.length >= 100 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61;
    if (!validGif) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({
        ok: false,
        error: "Invalid GIF received from Meteoinfo"
      });
    }
    res.setHeader("Content-Type", "image/gif");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=120, stale-while-revalidate=60"
    );
    res.setHeader("X-Daradar-Source", "meteoinfo.ru");
    res.setHeader("Content-Length", String(bytes.length));
    return res.status(200).send(bytes);
  } catch (error) {
    console.error(
      "[Daradar Phenomena API]",
      error && error.message
        ? error.message
        : "Unknown upstream error"
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      ok: false,
      error: "Could not fetch Meteoinfo GIF"
    });
  }
};
