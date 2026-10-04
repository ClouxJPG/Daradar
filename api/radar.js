/*
=========================================================
 CLOrad — Real Radar API
 Источник:
   - BALTRAD / BUFR radar observations
   - реальные наблюдения, НЕ прогноз
   - transport: Nowcast vector endpoint

 Поддерживаемые продукты:
   reflectivity -> BUFR reflectivity
   velocity     -> BUFR radial velocity

 ВАЖНО:
   Данные не генерируются искусственно.
   Если источник недоступен — API возвращает ошибку.
=========================================================
*/

const https = require("https");

const HOST = "www.nowcast.ru";
const PATH = "/vector_wsgi";

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(
            url,
            {
                headers: {
                    "User-Agent": "CLOrad/1.0 radar client",
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
                    if (response.statusCode < 200 || response.statusCode >= 300) {
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
                new Error("Radar source request timeout")
            );
        });

        request.on("error", reject);
    });
}


/*
---------------------------------------------------------
 Получаем время.
 Если time передан с фронтенда — используем его.
 Если нет — берём текущее UTC-время.
---------------------------------------------------------
*/

function getTime(req) {
    const value = req.query && req.query.time;

    if (!value) {
        return new Date();
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }

    return parsed;
}


/*
---------------------------------------------------------
 BALTRAD BUFR products

 reflectivity:
   dbz

 velocity:
   velocity

 spectrum:
   пока не запрашиваем выдуманные данные.
---------------------------------------------------------
*/

function getTitles(product) {
    switch (product) {
        case "reflectivity":
            return [
                "bufr_dbz1",
                "bufr_novosib_dbz1",
                "bufr_vlad_dbz1"
            ];

        case "velocity":
            return [
                "bufr_vel2",
                "bufr_novosib_vel2",
                "bufr_vlad_vel2"
            ];

        default:
            return null;
    }
}


/*
---------------------------------------------------------
 Преобразование ответа vector_wsgi

 Формат источника:

 [
   [lat, lon, value, direction],
   ...
 ]

 В GeoJSON:

 {
   type: "FeatureCollection",
   features: [...]
 }
---------------------------------------------------------
*/

function toGeoJSON(data, product) {
    if (!Array.isArray(data)) {
        throw new Error("Unexpected radar data format");
    }

    const features = [];

    for (const item of data) {
        if (!Array.isArray(item) || item.length < 3) {
            continue;
        }

        const lat = Number(item[0]);
        const lon = Number(item[1]);
        const value = Number(item[2]);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            !Number.isFinite(value)
        ) {
            continue;
        }

        if (lat < -90 || lat > 90) {
            continue;
        }

        if (lon < -180 || lon > 180) {
            continue;
        }

        const direction =
            item.length >= 4 && Number.isFinite(Number(item[3]))
                ? Number(item[3])
                : null;

        features.push({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [lon, lat]
            },
            properties: {
                value,
                dbz:
                    product === "reflectivity"
                        ? value
                        : null,
                velocity:
                    product === "velocity"
                        ? value
                        : null,
                direction
            }
        });
    }

    return {
        type: "FeatureCollection",
        features
    };
}


/*
=========================================================
 API HANDLER
=========================================================
*/

module.exports = async (req, res) => {
    /*
    -----------------------------------------------------
     CORS
    -----------------------------------------------------
    */

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
        "public, max-age=30, s-maxage=30"
    );

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );


    /*
    -----------------------------------------------------
     OPTIONS
    -----------------------------------------------------
    */

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }


    /*
    -----------------------------------------------------
     Только GET
    -----------------------------------------------------
    */

    if (req.method !== "GET") {
        res.status(405).json({
            error: "Method Not Allowed"
        });

        return;
    }


    try {
        const product =
            req.query?.product || "reflectivity";

        const source =
            req.query?.source || "rgmc";

        /*
        -------------------------------------------------
         Источник
        -------------------------------------------------

         rgmc / baltrad здесь не означают разные
         выдуманные наборы данных.

         Оба режима используют реальные BUFR
         radar observations, доступные через vector
         transport.
        -------------------------------------------------
        */

        if (
            source !== "rgmc" &&
            source !== "baltrad"
        ) {
            res.status(400).json({
                error: "Unsupported radar source"
            });

            return;
        }


        /*
        -------------------------------------------------
         Product
        -------------------------------------------------
        */

        if (
            product !== "reflectivity" &&
            product !== "velocity"
        ) {
            res.status(400).json({
                error:
                    "Unsupported radar product. " +
                    "Available: reflectivity, velocity"
            });

            return;
        }


        const titles = getTitles(product);

        if (!titles) {
            res.status(400).json({
                error: "Radar product is unavailable"
            });

            return;
        }


        /*
        -------------------------------------------------
         Время

         Источник работает по временным срезам.
         Округляем к ближайшим 10 минутам.
        -------------------------------------------------
        */

        const requestedTime = getTime(req);

        const rounded =
            Math.floor(
                requestedTime.getTime() /
                (10 * 60 * 1000)
            ) *
            (10 * 60 * 1000);

        const time =
            new Date(rounded).toISOString();


        /*
        -------------------------------------------------
         Запрос реального radar vector data
        -------------------------------------------------
        */

        const params = new URLSearchParams();

        params.set(
            "time",
            time
        );

        params.set(
            "title",
            titles.join(",")
        );


        const url =
            `https://${HOST}${PATH}?${params.toString()}`;


        /*
        -------------------------------------------------
         Получаем данные
        -------------------------------------------------
        */

        const raw =
            await fetchJSON(url);


        /*
        -------------------------------------------------
         Преобразуем реальные точки в GeoJSON
        -------------------------------------------------
        */

        const geojson =
            toGeoJSON(
                raw,
                product
            );


        /*
        -------------------------------------------------
         Не отдаём пустой "успешный" слой как будто
         данные есть.
        -------------------------------------------------
        */

        if (
            !geojson.features ||
            geojson.features.length === 0
        ) {
            res.status(204).end();
            return;
        }


        /*
        -------------------------------------------------
         Ответ CLOrad
        -------------------------------------------------
        */

        res.status(200).json({
            type: "geojson",

            source:
                source === "baltrad"
                    ? "BALTRAD · BUFR"
                    : "РГМЦ · ДМРЛ",

            product,

            observationTime:
                time,

            featureCount:
                geojson.features.length,

            data:
                geojson
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
