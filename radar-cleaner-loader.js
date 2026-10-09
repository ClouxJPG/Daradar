(function () {
    "use strict";

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-radar-cleaner-loader="1"]');
            if (existing) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.setAttribute('data-radar-cleaner-loader', '1');
            script.src = src + '?v=' + Date.now();
            script.onload = function () {
                resolve();
            };
            script.onerror = function () {
                reject(new Error('Failed to load radar cleaner script: ' + src));
            };
            document.head.appendChild(script);
        });
    }

    async function bootstrap() {
        const candidates = [
            '/radar-cleaner-v2.js',
            '/radar-cleaner.js',
            'https://raw.githubusercontent.com/ClouxJPG/Daradar/main/radar-cleaner-v2.js'
        ];

        for (const url of candidates) {
            try {
                await loadScript(url);
                console.log('[RadarCleaner] Loaded:', url);
                return;
            } catch (e) {
                console.warn('[RadarCleaner] Failed to load:', url, e);
            }
        }

        console.error('[RadarCleaner] Could not load cleaner script from any source.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
})();
