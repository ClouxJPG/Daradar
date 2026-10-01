// api/radar.js (или код для твоего Node.js сервера)
const https = require('https');

module.exports = async (req, res) => {
    // Устанавливаем CORS-заголовки, чтобы твой HTML на GitHub Pages мог читать этот API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // Прямой скрытый WFS-эндпоинт Росгидромета, отдающий радарную сетку в GeoJSON
    const wfsUrl = 'https://meteoinfo.ru?' + new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: 'radar:composite', // Объединенный слой ДМРЛ-С России
        outputFormat: 'application/json', // Требуем строго GeoJSON массив
        srsName: 'EPSG:4326' // Проекция координат, которую понимает Leaflet
    }).toString();

    https.get(wfsUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Leaflet-Radar-Client',
            'Referer': 'https://meteoinfo.ru'
        }
    }, (proxyRes) => {
        let data = '';
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => {
            // Пересылаем реальный GeoJSON на фронтенд
            res.status(200).send(data);
        });
    }).on('error', (err) => {
        res.status(500).send(JSON.stringify({ error: err.message }));
    });
};
