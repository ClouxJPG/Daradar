/*
=========================================================
 CLOrad — Radar Stations API

 Пока источник списка ДМРЛ-станций не подключён.
 Никаких выдуманных координат.
=========================================================
*/

module.exports = async (req, res) => {

    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
    );

    res.setHeader(
        "Cache-Control",
        "public, max-age=300, s-maxage=300"
    );

    res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
    );


    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }


    if (req.method !== "GET") {

        res.status(405).json({
            error: "Method Not Allowed"
        });

        return;
    }


    res.status(200).json({

        type: "FeatureCollection",

        features: []

    });
};
