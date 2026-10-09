(function () {
    "use strict";

    function init() {
        if (document.getElementById("qmDocsButton")) return;

        const logo = document.getElementById("logo");

        if (!logo) {
            setTimeout(init, 100);
            return;
        }

        // КНОПКА ДОКУМЕНТАЦИИ
        const button = document.createElement("button");
        button.id = "qmDocsButton";
        button.type = "button";
        button.title = "Документация";
        button.setAttribute("aria-label", "Открыть документацию");

        button.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20"
                 fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 3.5h7l4 4V20H7z"/>
                <path d="M14 3.5v4h4"/>
                <path d="M10 12h5M10 15.5h5"/>
            </svg>
        `;

        Object.assign(button.style, {
            position: "absolute",
            right: "calc(190px + var(--sar))",
            top: "calc(18px + var(--sat))",
            width: "36px",
            height: "36px",
            padding: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: "10px",
            background: "#fff",
            color: "#111",
            boxShadow: "0 2px 10px rgba(0,0,0,.25)",
            cursor: "pointer",
            pointerEvents: "auto",
            zIndex: "1001",
            WebkitTapHighlightColor: "transparent"
        });

        logo.parentElement.appendChild(button);

        // СТИЛИ ОКНА
        const style = document.createElement("style");

        style.textContent = `
            #qmDocsOverlay {
                position: fixed;
                inset: 0;
                z-index: 20000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 16px;
                background: rgba(0,0,0,.7);
                backdrop-filter: blur(7px);
                -webkit-backdrop-filter: blur(7px);
                font-family: -apple-system, BlinkMacSystemFont,
                    "Segoe UI", Arial, sans-serif;
            }

            #qmDocsOverlay.qm-docs-open {
                display: flex;
            }

            #qmDocsWindow {
                width: min(540px, 100%);
                max-height: 86dvh;
                overflow-y: auto;
                overscroll-behavior: contain;
                background: #0d1118;
                color: #e8edf5;
                border: 1px solid #29313d;
                border-radius: 17px;
                box-shadow: 0 20px 70px rgba(0,0,0,.5);
            }

            #qmDocsHeader {
                position: sticky;
                top: 0;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 17px 19px;
                background: rgba(13,17,24,.97);
                border-bottom: 1px solid #252d38;
            }

            #qmDocsHeader strong {
                font-size: 17px;
            }

            #qmDocsClose {
                width: 35px;
                height: 35px;
                flex-shrink: 0;
                border: 1px solid #343c48;
                border-radius: 9px;
                background: #171d26;
                color: #fff;
                font-size: 23px;
                cursor: pointer;
            }

            #qmDocsContent {
                padding: 20px;
            }

            #qmDocsContent h2 {
                margin: 0 0 10px;
                font-size: 25px;
                letter-spacing: -.5px;
            }

            #qmDocsContent h3 {
                margin: 23px 0 8px;
                font-size: 15px;
                color: #fff;
            }

            #qmDocsContent p,
            #qmDocsContent li {
                color: #b1bbc9;
                font-size: 14px;
                line-height: 1.7;
            }

            #qmDocsContent p {
                margin: 8px 0;
            }

            #qmDocsContent ul {
                padding-left: 20px;
                margin: 8px 0;
            }

            #qmDocsContent .qm-docs-card {
                margin-top: 13px;
                padding: 14px;
                border: 1px solid #28313d;
                border-radius: 11px;
                background: #121822;
            }

            #qmDocsContent .qm-docs-card h3 {
                margin-top: 0;
            }

            #qmDocsContent .qm-docs-note {
                color: #8793a4;
                font-size: 12px;
            }

            @media (max-width: 480px) {
                #qmDocsOverlay {
                    padding: 12px;
                }

                #qmDocsWindow {
                    max-height: 90dvh;
                    border-radius: 14px;
                }

                #qmDocsContent {
                    padding: 16px;
                }
            }
        `;

        document.head.appendChild(style);

        // СОДЕРЖИМОЕ ДОКУМЕНТАЦИИ
        const overlay = document.createElement("div");
        overlay.id = "qmDocsOverlay";

        overlay.innerHTML = `
            <div id="qmDocsWindow" role="dialog"
                 aria-modal="true" aria-labelledby="qmDocsTitle">

                <div id="qmDocsHeader">
                    <strong id="qmDocsTitle">Quantum Meteo · Справка</strong>
                    <button id="qmDocsClose" type="button"
                            aria-label="Закрыть">×</button>
                </div>

                <div id="qmDocsContent">
                    <h2>Документация</h2>

                    <p>
                        Краткое руководство по использованию карты
                        Quantum Meteo.
                    </p>

                    <div class="qm-docs-card">
                        <h3>Управление картой</h3>
                        <p>
                            Перемещайте карту пальцем или мышью.
                            Используйте жест двумя пальцами для изменения
                            масштаба на телефоне либо колесо мыши на компьютере.
                        </p>
                    </div>

                    <h3>РЛС и покрытие</h3>
                    <ul>
                        <li>Белый круг с чёрной обводкой обозначает точку РЛС.</li>
                        <li>Серая полупрозрачная область обозначает условную зону покрытия.</li>
                        <li>Нажмите на точку, чтобы открыть информацию о станции.</li>
                        <li>Слой можно включать и отключать в панели слоёв.</li>
                    </ul>

                    <h3>Метеорологические слои</h3>
                    <p>
                        В панели слоёв выбираются доступные визуализации.
                        Отображение слоя не гарантирует, что данные актуальны:
                        это зависит от источника и времени последнего обновления.
                    </p>

                    <h3>Временная шкала</h3>
                    <p>
                        Если для слоя доступны временные кадры, перемещайте
                        ползунок для выбора времени. Кнопка воспроизведения
                        запускает последовательное переключение кадров.
                    </p>

                    <div class="qm-docs-card">
                        <h3>Радиолокационная отражаемость</h3>
                        <p>
                            Отражаемость обычно измеряется в dBZ. Она описывает
                            мощность сигнала, отражённого от гидрометеоров,
                            и не является прямым измерением количества осадков
                            у поверхности.
                        </p>
                    </div>

                    <h3>Почему осадки могут быть не видны?</h3>
                    <ul>
                        <li>Данные могут временно не поступать.</li>
                        <li>Последний кадр может быть устаревшим.</li>
                        <li>Радиолокационный луч может проходить выше осадков у поверхности.</li>
                        <li>Дальность, рельеф и технические ограничения влияют на качество наблюдений.</li>
                    </ul>

                    <h3>Зоны покрытия</h3>
                    <p>
                        Отображаемая область покрытия является ориентировочной.
                        Она не гарантирует одинаковое качество наблюдений
                        во всех точках внутри круга.
                    </p>

                    <div class="qm-docs-card">
                        <h3>Важно</h3>
                        <p>
                            Quantum Meteo предназначен для визуализации
                            метеорологических данных. При угрозе опасных
                            явлений проверяйте официальные предупреждения
                            метеорологических служб.
                        </p>
                        <p class="qm-docs-note">
                            Доступные функции и данные зависят от текущей
                            версии сайта и подключённых источников.
                        </p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeButton = overlay.querySelector("#qmDocsClose");
        const modal = overlay.querySelector("#qmDocsWindow");

        function openDocs() {
            overlay.classList.add("qm-docs-open");
            document.body.style.overflow = "hidden";
            closeButton.focus({ preventScroll: true });
        }

        function closeDocs() {
            overlay.classList.remove("qm-docs-open");
            document.body.style.overflow = "";
            button.focus({ preventScroll: true });
        }

        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            openDocs();
        });

        closeButton.addEventListener("click", closeDocs);

        overlay.addEventListener("click", function (event) {
            if (!modal.contains(event.target)) {
                closeDocs();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (
                event.key === "Escape" &&
                overlay.classList.contains("qm-docs-open")
            ) {
                closeDocs();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
