/*
=========================================================
 CLOrad — Radar Stations API

 ВАЖНО:
   Этот endpoint НЕ создаёт фиктивные ДМРЛ.

   Пока нет подтверждённого публичного API,
   отдающего актуальный список российских ДМРЛ,
   endpoint сообщает об отсутствии источника.

   Это лучше, чем показывать пользователю
   придуманные координаты радаров.
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
    // GET
    // ----------------------------------------------------

    if (req.method !== "GET") {

        res.status(405).json({
            error: "Method Not Allowed"
        });

        return;
    }


    /*
    -------------------------------------------------------
     Источник списка ДМРЛ пока не подключён.

     НЕ возвращаем fake stations.
    -------------------------------------------------------
    */

    res.status(503).json({

        error:
            "Radar station source is not connected",

        source:
            "Росгидромет / ДМРЛ",

        stations: [],

        message:
            "No verified public station API is configured."
    });
};
