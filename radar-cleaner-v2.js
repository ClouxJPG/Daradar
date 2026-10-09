(function () {
    "use strict";

    const LEGEND = [
        '#9caab1','#a2c6ff','#46ff93','#00c25a','#009800','#ffff80',
        '#3e88ff','#0138ff','#000074','#ffaa7f','#ff557f','#ff0000',
        '#cc6600','#884400','#5f0000','#ffaaff','#ff55ff','#c700c7','#3f3f5f'
    ];

    const RGB = LEGEND.map(hex => ({
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
    }));

    const BG = { r: 177, g: 177, b: 177 };
    const TOL = 20;

    const state = {
        on: false,
        rid: null,
        radar: null,
        frames: [],
        idx: 0,
        overlay: null,
        map: null,
        initialized: false
    };

    function dist(a, b) {
        const dr = a.r - b.r;
        const dg = a.g - b.g;
        const db = a.b - b.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function isLegend(r, g, b) {
        const p = { r, g, b };
        for (let i = 0; i < RGB.length; i++) {
            if (dist(p, RGB[i]) <= TOL) return true;
        }
        return dist(p, BG) <= TOL;
    }

    function best(r, g, b) {
        let winner = RGB[0];
        let bestDist = Infinity;
        const p = { r, g, b };
        for (let i = 0; i < RGB.length; i++) {
            const d = dist(p, RGB[i]);
            if (d < bestDist) {
                bestDist = d;
                winner = RGB[i];
            }
        }
        return winner;
    }

    function cleanFrameData(data, width, height) {
        const mask = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 180 || !isLegend(r, g, b)) {
                mask[i / 4] = 1;
            }
        }

        for (let pass = 0; pass < 4; pass++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (!mask[idx]) continue;

                    let sr = 0, sg = 0, sb = 0, cnt = 0;
                    for (let dy = -4; dy <= 4; dy++) {
                        for (let dx = -4; dx <= 4; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                            const nidx = ny * width + nx;
                            if (!mask[nidx]) {
                                const p = nidx * 4;
                                sr += data[p];
                                sg += data[p + 1];
                                sb += data[p + 2];
                                cnt++;
                            }
                        }
                    }

                    if (cnt > 0) {
                        const q = best(sr / cnt, sg / cnt, sb / cnt);
                        const p = idx * 4;
                        data[p] = q.r;
                        data[p + 1] = q.g;
                        data[p + 2] = q.b;
                        data[p + 3] = 255;
                        mask[idx] = 0;
                    }
                }
            }
        }

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const q = best(r, g, b);
            data[i] = q.r;
            data[i + 1] = q.g;
            data[i + 2] = q.b;
            data[i + 3] = 255;
        }
    }

    function drawCleanFrame(sourceUrl, callback) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            cleanFrameData(data.data, canvas.width, canvas.height);
            ctx.putImageData(data, 0, 0);
            callback(canvas.toDataURL('image/png'));
        };
        img.onerror = function () {
            callback(null);
        };
        img.src = sourceUrl;
    }

    function currentMap() {
        if (window.map && window.map instanceof L.Map) return window.map;
        if (window.L && window.L.map && window.L.map._container) return window.L.map;
        return null;
    }

    function getBounds(radar) {
        if (!radar) {
            return [[55, 37], [56, 38]];
        }
        const lat = Number(radar.lat) || 55;
        const lon = Number(radar.lon) || 37;
        const km = Number(radar.range_km) || 250;
        const dlat = km / 111.32;
        const dlon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
        return [
            [lat - dlat, lon - dlon],
            [lat + dlat, lon + dlon]
        ];
    }

    async function fetchJson(url) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    }

    async function loadRadarList() {
        const list = await fetchJson('/api/radars');
        return Array.isArray(list) ? list : [];
    }

    async function loadFrames(rid) {
        const list = await fetchJson('/api/frames/' + rid);
        return Array.isArray(list) ? list : [];
    }

    function updateTimelineSelection() {
        const hrs = document.getElementById('hrs');
        if (!hrs) return;
        Array.from(hrs.children).forEach((el, index) => {
            el.classList.toggle('c', index === state.idx);
        });
    }

    function buildTimeline() {
        const hrs = document.getElementById('hrs');
        if (!hrs) return;
        hrs.innerHTML = '';

        state.frames.forEach((ts, index) => {
            const el = document.createElement('div');
            el.textContent = String(index + 1).padStart(2, '0');
            el.title = ts;
            el.className = (index === state.idx) ? 'c' : '';
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                state.idx = index;
                renderCurrentFrame();
            });
            hrs.appendChild(el);
        });
    }

    function renderCurrentFrame() {
        if (!state.on || !state.rid || state.frames.length === 0) return;

        const map = currentMap();
        if (!map) {
            setTimeout(renderCurrentFrame, 150);
            return;
        }

        const ts = state.frames[state.idx];
        const url = '/api/img/' + state.rid + '/' + ts + '?p=4&m=S';

        drawCleanFrame(url, function (dataUrl) {
            if (!dataUrl) return;
            if (state.overlay) {
                map.removeLayer(state.overlay);
            }

            state.overlay = L.imageOverlay(dataUrl, getBounds(state.radar), {
                opacity: 0.98,
                interactive: false,
                zIndex: 500
            });
            state.overlay.addTo(map);

            updateTimelineSelection();
        });
    }

    function turnOff() {
        state.on = false;
        state.idx = 0;

        const map = currentMap();
        if (map && state.overlay) {
            map.removeLayer(state.overlay);
            state.overlay = null;
        }

        const btn = document.querySelector('[data-m="S"]');
        if (btn) btn.classList.remove('on');

        const hrs = document.getElementById('hrs');
        if (hrs) hrs.innerHTML = '';
    }

    async function turnOn(rid) {
        const list = await loadRadarList();
        const radar = list.find(r => String(r.id) === String(rid)) || list[0];
        if (!radar) return;

        state.radar = radar;
        state.rid = String(radar.id);
        state.frames = await loadFrames(state.rid);
        state.idx = 0;
        state.on = true;

        const btn = document.querySelector('[data-m="S"]');
        if (btn) btn.classList.add('on');

        if (!state.frames.length) {
            const msg = document.getElementById('msg');
            if (msg) msg.textContent = 'Нет кадров для очистки';
            return;
        }

        buildTimeline();
        renderCurrentFrame();
    }

    function bindSButton() {
        const btn = document.querySelector('[data-m="S"]');
        if (!btn) {
            setTimeout(bindSButton, 100);
            return;
        }

        btn.addEventListener('click', async function () {
            const map = currentMap();
            if (!map) {
                console.warn('[RadarCleaner] Map not ready yet. Retry pending.');
                setTimeout(bindSButton, 100);
                return;
            }

            if (state.on) {
                turnOff();
                return;
            }

            const list = await loadRadarList();
            if (list.length === 0) {
                console.warn('[RadarCleaner] No radars available.');
                return;
            }

            await turnOn(String(list[0].id));
        });

        document.addEventListener('keydown', function (e) {
            if (!state.on || !state.frames.length) return;
            if (e.key === 'ArrowRight') {
                state.idx = (state.idx + 1) % state.frames.length;
                renderCurrentFrame();
            }
            if (e.key === 'ArrowLeft') {
                state.idx = (state.idx - 1 + state.frames.length) % state.frames.length;
                renderCurrentFrame();
            }
        });

        state.initialized = true;
        console.log('[RadarCleaner] ready');
    }

    function init() {
        if (!window.L) {
            setTimeout(init, 150);
            return;
        }

        if (!document.querySelector('[data-m="S"]')) {
            setTimeout(init, 150);
            return;
        }

        bindSButton();
    }

    window.RadarCleaner = {
        turnOn,
        turnOff,
        isOn: () => state.on,
        getFrameCount: () => state.frames.length,
        getCurrentFrame: () => state.idx
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
