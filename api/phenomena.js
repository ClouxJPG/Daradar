// Daradar — Meteoinfo Phenomena GIF API
// Путь: api/phenomena.js
// Источник: https://meteoinfo.ru/hmc-output/rmap/phenomena.gif
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
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Daradar/1.0)",
        "Accept": "image/gif,image/*;q=0.9,*/*;q=0.5"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!upstream.ok) {
      console.error(
        "[Daradar Phenomena] Upstream HTTP:",
        upstream.status
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({
        ok: false,
        error: "Meteoinfo source unavailable",
        upstreamStatus: upstream.status
      });
    }
    const contentType =
      upstream.headers.get("content-type") || "";
    if (
      !contentType.toLowerCase().includes("image/gif")
    ) {
      console.error(
        "[Daradar Phenomena] Unexpected content type:",
        contentType
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({
        ok: false,
        error: "Meteoinfo did not return a GIF",
        upstreamContentType: contentType
      });
    }
    const bytes = Buffer.from(
      await upstream.arrayBuffer()
    );
    const validGif =
      bytes.length >= 100 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61;
    if (!validGif) {
      console.error(
        "[Daradar Phenomena] Invalid GIF, bytes:",
        bytes.length
      );
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
    if (req.method === "HEAD") {
      return res.status(200).end();
    }
    return res.status(200).send(bytes);
  } catch (error) {
    console.error(
      "[Daradar Phenomena] Error:",
      error && error.stack
        ? error.stack
        : String(error)
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      ok: false,
      error: "Could not fetch Meteoinfo GIF",
      details:
        error && error.name
          ? error.name
          : "UnknownError"
    });
  }
};
