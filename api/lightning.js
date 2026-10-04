/*
=========================================================
 CLOrad — Lightning API

 ВАЖНО:

   Здесь НЕ генерируются молнии.

   Пока подтверждённый публичный источник
   lightning data для CLOrad не подключён,
   API возвращает пустой слой с понятным статусом.

   Никаких случайных точек.
=========================================================
*/

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
        "no-store"
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


    /*
    -------------------------------------------------------
     Пока источник молний не подключён.

     Возвращаем валидный GeoJSON,
     но с нулём объектов.

     Поэтому Leaflet не сломается.
    -------------------------------------------------------
    */

    res.status(200).json({

        type: "FeatureCollection",

        source:
            "lightning-source-not-connected",

        observationTime:
            new Date().toISOString(),

        features: []
    });
};
