/*
=========================================================
 CLOrad — Real Radar API

 Источник:
   BALTRAD / BUFR radar observations
   transport: Nowcast vector endpoint

 ВАЖНО:
   - данные НЕ генерируются;
   - это наблюдения, а не прогноз;
   - если источник недоступен — возвращается ошибка.
=========================================================
*/

const https = require("https");

const HOST = "www.nowcast.ru";
const PATH = "/vector_wsgi";


// =======================================================
// HTTP GET JSON
// =======================================================

function fetchJSON(url) {
    return new Promise((resolve, reject) => {

        const request = https.get(
            url,
            {
                headers: {
                    "User-Agent": "CLOrad/1.0",
                    "Accept": "application/json"
                },

                timeout: 15000
            },

            response => {

                let body = "";

                response.setEncoding("utf8");

                response.on("data", chunk => {
                    body += chunk;
                });

                response.on("end", () => {

                    if (
                        response.statusCode < 200 ||
                        response.statusCode >= 300
                    ) {
                        reject(
                            new Error(
                                `Radar source HTTP ${response.statusCode}`
                            )
                        );

                        return;
                    }

                    try {

                        resolve(JSON.parse(body));

                    } catch (error) {

                        reject(
                            new Error(
                                "Radar source returned invalid JSON"
                            )
                        );
                    }
                });
            }
        );

        request.on("timeout", () => {

            request.destroy(
                new Error("Radar source timeout")
            );
        });

        request.on("error", reject);
    });
}


// =======================================================
// TIME
// =======================================================

function getRequestedTime(req) {

    const value =
        req.query &&
        req.query.time;

    if (!value) {
        return new Date();
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return new Date();
    }

    return date;
}


function roundToRadarTime(date) {

    const TEN_MINUTES =
        10 * 60 * 1000;

    return new Date(
        Math.floor(
            date.getTime() /
            TEN_MINUTES
        ) *
        TEN_MINUTES
    );
}


// =======================================================
// BALTRAD PRODUCTS
// =======================================================

function getTitles(product) {

    if (product === "reflectivity") {

        return [
            "bufr_dbz1",
            "bufr_novosib_dbz1",
            "bufr_vlad_dbz1"
        ];
    }

    if (product === "velocity") {

        return [
            "bufr_vel2",
            "bufr_novosib_vel2",
            "bufr_vlad_vel2"
        ];
    }

    return null;
}


// =======================================================
// VECTOR → CLOrad GeoJSON
// =======================================================

function convertToGeoJSON(raw, product) {

    /*
      Источник обычно отдаёт:

      [
        [lat, lon, value, direction],
        ...
      ]
    */

    if (!Array.isArray(raw)) {

        throw new Error(
            "Unexpected radar response format"
        );
    }

    const features = [];

    for (const point of raw) {

        if (
            !Array.isArray(point) ||
            point.length < 3
        ) {
            continue;
        }

        const lat =
            Number(point[0]);

        const lon =
            Number(point[1]);

        const value =
            Number(point[2]);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            !Number.isFinite(value)
        ) {
            continue;
        }

        if (
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            continue;
        }

        const direction =
            point.length >= 4
                ? Number(point[3])
                : null;

        const properties = {
            value: value,

            dbz:
                product === "reflectivity"
                    ? value
                    : null,

            velocity:
                product === "velocity"
                    ? value
                    : null,

            direction:
                Number.isFinite(direction)
                    ? direction
                    : null
        };

        features.push({

            type: "Feature",

            geometry: {
                type: "Point",

                coordinates: [
                    lon,
                    lat
                ]
            },

            properties
        });
    }

    return features;
}


// =======================================================
// API
// =======================================================

module.exports = async (req, res) => {

    // ----------------------------------------------------
    // CORS
    // ----------------------------------------------------

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    res.setHeader(
        "Cache-Control",
        "public, max-age=20, s-maxage=20"
    );

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );


    // ----------------------------------------------------
    // OPTIONS
    // ----------------------------------------------------

    if (req.method === "OPTIONS") {

        res.status(204).end();

        return;
    }


    // ----------------------------------------------------
    // GET ONLY
    // ----------------------------------------------------

    if (req.method !== "GET") {

        res.status(405).json({
            error: "Method Not Allowed"
        });

        return;
    }


    try {

        const product =
            req.query?.product ||
            "reflectivity";

        const source =
            req.query?.source ||
            "baltrad";


        // ------------------------------------------------
        // Source
        // ------------------------------------------------

        if (
            source !== "baltrad" &&
            source !== "rgmc"
        ) {

            res.status(400).json({
                error:
                    "Unsupported radar source"
            });

            return;
        }


        // ------------------------------------------------
        // Product
        // ------------------------------------------------

        if (
            product !== "reflectivity" &&
            product !== "velocity"
        ) {

            res.status(400).json({
                error:
                    "Unsupported radar product",
                available: [
                    "reflectivity",
                    "velocity"
                ]
            });

            return;
        }


        const titles =
            getTitles(product);

        if (!titles) {

            res.status(400).json({
                error:
                    "Radar product unavailable"
            });

            return;
        }


        // ------------------------------------------------
        // Time
        // ------------------------------------------------

        const requested =
            getRequestedTime(req);

        const radarTime =
            roundToRadarTime(
                requested
            );

        const isoTime =
            radarTime.toISOString();


        // ------------------------------------------------
        // Build source URL
        // ------------------------------------------------

        const params =
            new URLSearchParams();

        params.set(
            "time",
            isoTime
        );

        params.set(
            "title",
            titles.join(",")
        );


        const url =
            `https://${HOST}${PATH}?${params.toString()}`;


        // ------------------------------------------------
        // Request real observations
        // ------------------------------------------------

        const raw =
            await fetchJSON(url);


        // ------------------------------------------------
        // Convert
        // ------------------------------------------------

        const features =
            convertToGeoJSON(
                raw,
                product
            );


        // ------------------------------------------------
        // No data
        // ------------------------------------------------

        if (
            features.length === 0
        ) {

            res.status(204).end();

            return;
        }


        // ------------------------------------------------
        // CLOrad response
        //
        // ВАЖНО:
        // frontend ожидает:
        //
        // {
        //   type: "geojson",
        //   features: [...]
        // }
        // ------------------------------------------------

        res.status(200).json({

            type: "geojson",

            source:
                source === "baltrad"
                    ? "BALTRAD · BUFR"
                    : "РГМЦ · ДМРЛ",

            product,

            observationTime:
                isoTime,

            featureCount:
                features.length,

            features
        });

    } catch (error) {

        console.error(
            "CLOrad radar error:",
            error
        );

        res.status(502).json({

            error:
                "Radar observation source unavailable",

            details:
                error.message
        });
    }
};
