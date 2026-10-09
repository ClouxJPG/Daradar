/* =========================================================
   Quantum Meteo — radar-gif-cleaner.js

   Смысл:
   - берёт радарную GIF/кадровую последовательность
   - оставляет только пиксели, которые принадлежат легенде РГМЦ
   - всё остальное (молнии, подписи, города, артефакты) заполняет
     соседними корректными пикселями без заметной "заплатки"
   - при нажатии кнопки S активирует чистку
   - в таймлайне показываются кадры и возможен переход между ними
   ========================================================= */

(function () {
    "use strict";

    const LEGEND_COLORS = [
        '#9caab1', '#a2c6ff', '#46ff93', '#00c25a', '#009800',
        '#ffff80', '#3e88ff', '#0138ff', '#000074', '#ffaa7f',
        '#ff557f', '#ff0000', '#cc6600', '#884400', '#5f0000',
        '#ffaaff', '#ff55ff', '#c700c7', '#3f3f5f'
    ];

    const PALETTE = LEGEND_COLORS.map(hexToRgb);
    const BACKGROUND = { r: 177, g: 177, b: 177 };
    const COLOR_TOLERANCE = 24;

    let active = false;
    let currentRadarId = null;
    let frames = [];
    let currentFrame = 0;
    let currentOverlay = null;
    let lastBounds = null;

    function hexToRgb(hex) {
        const value = hex.replace('#', '');
        return {
            r: parseInt(value.substring(0, 2), 16),
            g: parseInt(value.substring(2, 4), 16),
            b: parseInt(value.substring(4, 6), 16)
        };
    }

    function colorDistance(a, b) {
        const dr = a.r - b.r;
        const dg = a.g - b.g;
        const db = a.b - b.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function isLegendPixel(r, g, b) {
        const pixel = { r, g, b };
        for (let i = 0; i < PALETTE.length; i++) {
            if (colorDistance(pixel, PALETTE[i]) <= COLOR_TOLERANCE) {
                return true;
            }
        }
        return colorDistance(pixel, BACKGROUND) <= COLOR_TOLERANCE;
    }

    function nearestLegend(r, g, b) {
        let best = PALETTE[0];
        let bestDist = Infinity;

        for (let i = 0; i < PALETTE.length; i++) {
            const dist = colorDistance({ r, g, b }, PALETTE[i]);
            if (dist < bestDist) {
                bestDist = dist;
                best = PALETTE[i];
            }
        }

        return best;
    }

    function getNeighborPixels(data, width, height, x, y, radius) {
        const colors = [];

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                const idx = (ny * width + nx) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                if (isLegendPixel(r, g, b)) {
                    colors.push({ r, g, b });
                }
            }
        }

        return colors;
    }

    function cleanCanvasImageData(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const mask = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                if (a < 128 || !isLegendPixel(r, g, b)) {
                    mask[y * width + x] = 1;
                }
            }
        }

        for (let pass = 0; pass < 4; pass++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (!mask[idx]) continue;

                    const neigh = getNeighborPixels(data, width, height, x, y, 4);
                    if (neigh.length === 0) continue;

                    let sumR = 0, sumG = 0, sumB = 0;
                    for (let i = 0; i < neigh.length; i++) {
                        sumR += neigh[i].r;
                        sumG += neigh[i].g;
                        sumB += neigh[i].b;
                    }

                    const avg = {
                        r: Math.round(sumR / neigh.length),
                        g: Math.round(sumG / neigh.length),
                        b: Math.round(sumB / neigh.length)
                    };

                    const nearest = nearestLegend(avg.r, avg.g, avg.b);
                    const pixelIndex = idx * 4;
                    data[pixelIndex] = nearest.r;
                    data[pixelIndex + 1] = nearest.g;
                    data[pixelIndex + 2] = nearest.b;
                    data[pixelIndex + 3] = 255;
                    mask[idx] = 0;
                }
            }
        }

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const nearest = nearestLegend(r, g, b);
            data[i] = nearest.r;
            data[i + 1] = nearest.g;
            data[i + 2] = nearest.b;
            data[i + 3] = 255;
        }

        return imageData;
    }

    function drawProcessedImageToDataUrl(imageUrl, onDone) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const cleaned = cleanCanvasImageData(src);
            ctx.putImageData(cleaned, 0, 0);
            onDone(canvas.toDataURL('image/png'));
        };
        img.onerror = function () {
            onDone(null);
        };
        img.src = imageUrl;
    }

    async function fetchJson(url) {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    }

    async function getRadarList() {
        const radars = await fetchJson('/api/radars');
        return Array.isArray(radars) ? radars : [];
    }

    async function getFrames(radarId) {
        const list = await fetchJson('/api/frames/' + radarId);
        if (!Array.isArray(list)) return [];
        return list;
    }

    function buildTimeline() {
        const hrs = document.getElementById('hrs');
        if (!hrs) return;
        hrs.innerHTML = '';

        frames.forEach((ts, index) => {
            const item = document.createElement('div');
            item.textContent = String(index + 1).padStart(2, '0');
            item.title = ts;
            item.className = index === currentFrame ? 'c' : '';
            item.style.cursor = 'pointer';
            item.addEventListener('click', function () {
                currentFrame = index;
                renderCurrentFrame();
                updateTimelineSelection();
            });
            hrs.appendChild(item);
        });
    }

    function updateTimelineSelection() {
        const hrs = document.getElementById('hrs');
        if (!hrs) return;
        const items = hrs.children;
        for (let i = 0; i < items.length; i++) {
            items[i].classList.toggle('c', i === currentFrame);
        }
    }

    function getRadarBounds(radar) {
        if (!radar) return [[50, 30], [65, 45]];
        const latPad = Math.max(1.2, Number(radar.range_km || 250) / 90);
        const lonPad = Math.max(1.2, Number(radar.range_km || 250) / 90);
        return [
            [radar.lat - latPad, radar.lon - lonPad],
            [radar.lat + latPad, radar.lon + lonPad]
        ];
    }

    async function renderCurrentFrame() {
        if (!active || !currentRadarId || frames.length === 0) return;

        const timestamp = frames[currentFrame];
        const url = '/api/img/' + currentRadarId + '/' + timestamp + '?p=4&m=S';

        drawProcessedImageToDataUrl(url, function (processedUrl) {
            const map = window.map || window.L && window.L.map ? window.L.map : null;
            if (!map) return;
            if (!processedUrl) {
                console.warn('Не удалось обработать кадр', timestamp);
                return;
            }

            const radar = (window.__daradar_last_radars || []).find(r => String(r.id) === String(currentRadarId));
            const bounds = getRadarBounds(radar);

            if (currentOverlay) {
                map.removeLayer(currentOverlay);
            }

            currentOverlay = L.imageOverlay(processedUrl, bounds, {
                opacity: 1,
                interactive: false,
                zIndex: 500
            });
            currentOverlay.addTo(map);
            lastBounds = bounds;
        });
    }

    async function activateForRadar(radarId) {
        active = true;
        currentRadarId = radarId;
        currentFrame = 0;
        frames = await getFrames(radarId);

        const btn = document.querySelector('[data-m="S"]');
        if (btn) btn.classList.add('on');

        if (!frames.length) {
            const msg = document.getElementById('msg');
            if (msg) msg.textContent = 'Нет кадров для очистки';
            return;
        }

        buildTimeline();
        renderCurrentFrame();
    }

    function deactivate() {
        active = false;
        currentRadarId = null;
        currentFrame = 0;
        frames = [];

        if (currentOverlay && window.map) {
            window.map.removeLayer(currentOverlay);
            currentOverlay = null;
        }

        const hrs = document.getElementById('hrs');
        if (hrs) hrs.innerHTML = '';

        const btn = document.querySelector('[data-m="S"]');
        if (btn) btn.classList.remove('on');
    }

    async function bindLayerButton() {
        const btn = document.querySelector('[data-m="S"]');
        if (!btn) {
            setTimeout(bindLayerButton, 100);
            return;
        }

        btn.addEventListener('click', async function () {
            if (active) {
                deactivate();
                return;
            }

            const radars = await getRadarList();
            if (!radars.length) {
                console.warn('Нет доступных радаров');
                return;
            }
            window.__daradar_last_radars = radars;
            await activateForRadar(String(radars[0].id));
        });

        document.addEventListener('keydown', function (e) {
            if (!active) return;
            if (e.key === 'ArrowRight') {
                currentFrame = (currentFrame + 1) % frames.length;
                updateTimelineSelection();
                renderCurrentFrame();
            }
            if (e.key === 'ArrowLeft') {
                currentFrame = (currentFrame - 1 + frames.length) % frames.length;
                updateTimelineSelection();
                renderCurrentFrame();
            }
        });
    }

    window.RadarGifCleaner = {
        activateForRadar,
        deactivate,
        isActive: function () { return active; },
        renderCurrentFrame,
        getRadarList
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindLayerButton);
    } else {
        bindLayerButton();
    }
})();
