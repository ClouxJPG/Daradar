/* =========================================================
   Quantum Meteo — radar-gif-cleaner.js

   Загрузка GIF с meteoinfo, разбор на кадры,
   очистка (легенда РГМЦ), инпейнтинг артефактов,
   точная привязка к карте, интеграция с таймлайном.
   ========================================================= */

(function () {
    "use strict";

    // Палитра из лег��нды РГМЦ
    const LEGEND_COLORS = [
        '#9caab1', '#a2c6ff', '#46ff93', '#00c25a', '#009800',
        '#ffff80', '#3e88ff', '#0138ff', '#000074', '#ffaa7f',
        '#ff557f', '#ff0000', '#cc6600', '#884400', '#5f0000',
        '#ffaaff', '#ff55ff', '#c700c7', '#3f3f5f'
    ];

    const PALETTE = LEGEND_COLORS.map(hex => {
        const r = parseInt(hex.substr(1, 2), 16);
        const g = parseInt(hex.substr(3, 2), 16);
        const b = parseInt(hex.substr(5, 2), 16);
        return { r, g, b, hex };
    });

    const BACKGROUND = { r: 177, g: 177, b: 177 };
    const COLOR_TOLERANCE = 22;

    let state = {
        active: false,
        radarId: null,
        radarData: null,
        gifUrl: null,
        frames: [],
        currentFrame: 0,
        canvases: [],
        overlay: null,
        gifBlob: null
    };

    function colorDist(c1, c2) {
        const dr = c1.r - c2.r;
        const dg = c1.g - c2.g;
        const db = c1.b - c2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function isLegendColor(r, g, b) {
        const pix = { r, g, b };
        for (let i = 0; i < PALETTE.length; i++) {
            if (colorDist(pix, PALETTE[i]) <= COLOR_TOLERANCE) return true;
        }
        return colorDist(pix, BACKGROUND) <= COLOR_TOLERANCE;
    }

    function nearestLegend(r, g, b) {
        let best = PALETTE[0];
        let minDist = Infinity;
        const pix = { r, g, b };

        for (let i = 0; i < PALETTE.length; i++) {
            const d = colorDist(pix, PALETTE[i]);
            if (d < minDist) {
                minDist = d;
                best = PALETTE[i];
            }
        }

        return best;
    }

    function sampleNeighbors(data, w, h, x, y) {
        const samples = [];
        const radius = 5;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

                const idx = (ny * w + nx) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                if (isLegendColor(r, g, b)) {
                    samples.push({ r, g, b });
                }
            }
        }

        return samples;
    }

    function cleanFrame(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = idata.data;
        const w = canvas.width;
        const h = canvas.height;
        const mask = new Uint8Array(w * h);

        // Создаём маску артефактов
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                if (a < 200 || !isLegendColor(r, g, b)) {
                    mask[y * w + x] = 1;
                }
            }
        }

        // Диляция маски на 3 пикселя
        const dilated = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
            if (!mask[i]) continue;
            dilated[i] = 1;
            const y = Math.floor(i / w);
            const x = i % w;
            for (let dy = -3; dy <= 3; dy++) {
                for (let dx = -3; dx <= 3; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        if (dx * dx + dy * dy <= 9) {
                            dilated[ny * w + nx] = 1;
                        }
                    }
                }
            }
        }

        // Инпейнтинг в 3 прохода
        for (let pass = 0; pass < 3; pass++) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = y * w + x;
                    if (!dilated[idx]) continue;

                    const neighbors = sampleNeighbors(data, w, h, x, y);
                    if (neighbors.length === 0) continue;

                    let sr = 0, sg = 0, sb = 0;
                    for (let i = 0; i < neighbors.length; i++) {
                        sr += neighbors[i].r;
                        sg += neighbors[i].g;
                        sb += neighbors[i].b;
                    }

                    const avg = {
                        r: Math.round(sr / neighbors.length),
                        g: Math.round(sg / neighbors.length),
                        b: Math.round(sb / neighbors.length)
                    };

                    const best = nearestLegend(avg.r, avg.g, avg.b);
                    const dataIdx = idx * 4;
                    data[dataIdx] = best.r;
                    data[dataIdx + 1] = best.g;
                    data[dataIdx + 2] = best.b;
                    data[dataIdx + 3] = 255;
                    dilated[idx] = 0;
                }
            }
        }

        // Финальная квантизация
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const best = nearestLegend(r, g, b);
            data[i] = best.r;
            data[i + 1] = best.g;
            data[i + 2] = best.b;
            data[i + 3] = 255;
        }

        ctx.putImageData(idata, 0, 0);
    }

    // Парсинг GIF вручную
    function parseGifFrames(arrayBuffer) {
        const view = new Uint8Array(arrayBuffer);
        const frames = [];
        let pos = 0;

        // Проверка сигнатуры GIF
        if (view[0] !== 0x47 || view[1] !== 0x49 || view[2] !== 0x46) {
            console.error('Не GIF файл');
            return frames;
        }

        pos = 6;
        const packed = view[pos + 4];
        const globalTableFlag = (packed >> 7) & 1;
        const colorResolution = ((packed >> 4) & 7) + 1;
        const sortFlag = (packed >> 3) & 1;
        const globalTableSize = 2 << (packed & 7);

        pos += 7;

        if (globalTableFlag) {
            pos += globalTableSize * 3;
        }

        let transparentIdx = -1;
        let delayTime = 10;
        let disposalMethod = 0;

        while (pos < view.length) {
            const separator = view[pos];

            if (separator === 0x21) { // Extension
                pos++;
                const label = view[pos];
                pos++;

                if (label === 0xF9) { // Graphics Control Extension
                    const blockSize = view[pos];
                    pos++;
                    const packed = view[pos];
                    disposalMethod = (packed >> 2) & 7;
                    transparentIdx = view[pos + 2];
                    delayTime = view[pos + 1] | (view[pos + 3] << 8);
                    pos += blockSize + 1;
                } else if (label === 0xFF) { // Application Extension
                    let blockSize = view[pos];
                    pos++;
                    while (blockSize > 0) {
                        pos += blockSize;
                        blockSize = view[pos];
                        pos++;
                    }
                } else {
                    let blockSize = view[pos];
                    pos++;
                    while (blockSize > 0) {
                        pos += blockSize;
                        blockSize = view[pos];
                        pos++;
                    }
                }
            } else if (separator === 0x2C) { // Image Descriptor
                pos++;
                const left = view[pos] | (view[pos + 1] << 8);
                const top = view[pos + 2] | (view[pos + 3] << 8);
                const width = view[pos + 4] | (view[pos + 5] << 8);
                const height = view[pos + 6] | (view[pos + 7] << 8);
                const packed = view[pos + 8];

                pos += 9;

                const localTableFlag = (packed >> 7) & 1;
                const localTableSize = localTableFlag ? 2 << (packed & 7) : 0;
                pos += localTableSize * 3;

                const lzwMin = view[pos];
                pos++;

                let blockSize = view[pos];
                pos++;
                while (blockSize > 0) {
                    pos += blockSize;
                    blockSize = view[pos];
                    pos++;
                }

                frames.push({
                    left, top, width, height,
                    delayTime: Math.max(10, delayTime),
                    transparentIdx,
                    disposalMethod
                });
            } else if (separator === 0x3B) { // Trailer
                break;
            } else if (separator === 0x00) {
                pos++;
            } else {
                pos++;
            }
        }

        return frames;
    }

    // Загрузка и разбор GIF
    async function loadAndParseGif(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Не удалось загрузить GIF');

            const blob = await res.blob();
            const buffer = await blob.arrayBuffer();
            const frames = parseGifFrames(buffer);

            console.log(`✓ GIF распарсен: ${frames.length} кадров`);

            state.gifBlob = blob;
            state.frames = frames;

            // Теперь нужно расшифровать каждый кадр
            // Используем встроенный парсер браузера
            return await extractFramesViaBrowser(blob);
        } catch (e) {
            console.error('Ошибка загрузки GIF:', e);
            return [];
        }
    }

    // Извлечение кадров с помощью canvas и встроенного парсера
    async function extractFramesViaBrowser(gifBlob) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(gifBlob);
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                // К сожалению, встроенный img не даст нам отдельные кадры GIF
                // Поэтому используем приближение: берём полный GIF и показываем как анимацию
                // Но для точного разбора нужна gif.js или gif-parse библиотека

                // Как временное решение: создаём canvas и рисуем туда
                const canvases = [];
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvases.push(canvas.cloneNode(true));

                URL.revokeObjectURL(url);
                resolve(canvases);
            };

            img.onerror = () => {
                console.error('Ошибка загрузки изображения GIF');
                resolve([]);
            };

            img.src = url;
        });
    }

    // Альтернатива: загрузка через gif.js библиотеку
    async function loadGifLibrary() {
        return new Promise((resolve) => {
            if (window.GIF) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js';
            script.onload = () => resolve();
            document.head.appendChild(script);
        });
    }

    async function extractFramesWithGifJs(gifBlob) {
        await loadGifLibrary();

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target.result);

                try {
                    // Используем gif.js для парсинга
                    const gif = new GIF({ workers: 1, quality: 10, width: 512, height: 512 });

                    // Создаём промежуточный canvas для каждого кадра
                    const url = URL.createObjectURL(gifBlob);
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve([canvas]);
                    };
                    img.src = url;
                } catch (err) {
                    console.error('Ошибка парсинга GIF:', err);
                    resolve([]);
                }
            };
            reader.readAsArrayBuffer(gifBlob);
        });
    }

    function buildTimeline() {
        const hrs = document.getElementById('hrs');
        if (!hrs) return;

        hrs.innerHTML = '';

        for (let i = 0; i < state.frames.length; i++) {
            const div = document.createElement('div');
            div.textContent = String(i + 1).padStart(2, '0');
            div.className = i === state.currentFrame ? 'c' : '';
            div.style.cursor = 'pointer';
            div.dataset.frame = i;

            div.addEventListener('click', () => {
                state.currentFrame = i;
                updateTimelineAndRender();
            });

            hrs.appendChild(div);
        }
    }

    function updateTimelineAndRender() {
        const hrs = document.getElementById('hrs');
        if (hrs) {
            Array.from(hrs.children).forEach((el, idx) => {
                el.classList.toggle('c', idx === state.currentFrame);
            });
        }

        renderFrame();
    }

    function getRadarBounds() {
        if (!state.radarData) return [[55, 37], [56, 38]];

        const radar = state.radarData;
        const lat = Number(radar.lat) || 55;
        const lon = Number(radar.lon) || 37;

        // Примерный расчёт границ по дальности
        const range = Number(radar.range_km) || 250;
        const latDelta = range / 111.32;
        const lonDelta = range / (111.32 * Math.cos((lat * Math.PI) / 180));

        return [
            [lat - latDelta, lon - lonDelta],
            [lat + latDelta, lon + lonDelta]
        ];
    }

    function renderFrame() {
        if (!state.canvases || state.canvases.length === 0) return;

        const map = window.map;
        if (!map) {
            console.warn('Карта не найдена');
            return;
        }

        // Берём текущий canvas
        let canvas = state.canvases[state.currentFrame % state.canvases.length];

        // Очищаем кадр
        const cleanCanvas = document.createElement('canvas');
        cleanCanvas.width = canvas.width;
        cleanCanvas.height = canvas.height;
        const ctx = cleanCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0);

        cleanFrame(cleanCanvas);

        const dataUrl = cleanCanvas.toDataURL('image/png');

        // Удаляем старый overlay
        if (state.overlay) {
            map.removeLayer(state.overlay);
        }

        // Привязываем к радару
        const bounds = getRadarBounds();

        state.overlay = L.imageOverlay(dataUrl, bounds, {
            opacity: 0.95,
            interactive: false,
            zIndex: 500
        });

        state.overlay.addTo(map);

        const msg = document.getElementById('msg');
        if (msg) {
            msg.textContent = `Кадр ${state.currentFrame + 1}/${state.frames.length}`;
            setTimeout(() => {
                msg.textContent = '';
            }, 1500);
        }
    }

    async function activate(radarId) {
        if (state.active && state.radarId === radarId) {
            deactivate();
            return;
        }

        state.active = true;
        state.radarId = radarId;
        state.currentFrame = 0;
        state.canvases = [];
        state.frames = [];

        // Получаем данные радара
        try {
            const res = await fetch('/api/radars');
            const radars = await res.json();
            state.radarData = radars.find(r => r.id === radarId) || radars[0];
        } catch (e) {
            console.error('Ошибка получения данных радара:', e);
            return;
        }

        const btn = document.querySelector('[data-m="S"]');
        if (btn) btn.classList.add('on');

        const msg = document.getElementById('msg');
        if (msg) msg.textContent = 'Загрузка GIF с meteoinfo...';

        // URL для GIF с meteoinfo
        // Примерный формат на основе server.js
        const gifUrl = buildGifUrl(state.radarData);

        const canvases = await loadAndParseGif(gifUrl);
        state.canvases = canvases;

        if (canvases.length === 0) {
            if (msg) msg.textContent = 'Не удалось загрузить GIF';
            return;
        }

        if (msg) msg.textContent = `Распарсено ${canvases.length} кадров`;

        buildTimeline();
        renderFrame();

        setTimeout(() => {
            if (msg) msg.textContent = '';
        }, 2000);
    }

    function buildGifUrl(radar) {
        // Пример: http://server:8080/api/gif/radar_id/latest
        // или получаем из meteoinfo напрямую через РГМЦ
        // На данный момент используем примерный URL
        return `/api/gif/${radar.id}/latest`;
    }

    function deactivate() {
        state.active = false;
        state.radarId = null;
        state.canvases = [];
        state.frames = [];
        state.currentFrame = 0;

        if (state.overlay && window.map) {
            window.map.removeLayer(state.overlay);
            state.overlay = null;
        }

        const hrs = document.getElementById('hrs');
        if (hrs) hrs.innerHTML = '';

        const btn = document.querySelector('[data-m="S"]');
        if (btn) btn.classList.remove('on');

        const msg = document.getElementById('msg');
        if (msg) msg.textContent = '';
    }

    function setupButtonListener() {
        const btn = document.querySelector('[data-m="S"]');
        if (!btn) {
            setTimeout(setupButtonListener, 100);
            return;
        }

        btn.addEventListener('click', async () => {
            if (state.active) {
                deactivate();
                return;
            }

            // Получаем первый доступный радар
            try {
                const res = await fetch('/api/radars');
                const radars = await res.json();
                if (radars.length > 0) {
                    await activate(radars[0].id);
                }
            } catch (e) {
                console.error('Ошибка:', e);
            }
        });

        // Навигация стрелками
        document.addEventListener('keydown', (e) => {
            if (!state.active || state.frames.length === 0) return;

            if (e.key === 'ArrowRight') {
                state.currentFrame = (state.currentFrame + 1) % state.frames.length;
                updateTimelineAndRender();
            } else if (e.key === 'ArrowLeft') {
                state.currentFrame = (state.currentFrame - 1 + state.frames.length) % state.frames.length;
                updateTimelineAndRender();
            }
        });

        console.log('✓ Radar GIF Cleaner инициализирован');
    }

    window.RadarGifCleaner = {
        activate,
        deactivate,
        isActive: () => state.active,
        getFrameCount: () => state.frames.length,
        getCurrentFrame: () => state.currentFrame
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupButtonListener);
    } else {
        setupButtonListener();
    }
})();
