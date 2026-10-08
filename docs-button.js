<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">

<title>Quantum Meteo — Документация</title>

<style>
*{
    box-sizing:border-box;
    -webkit-tap-highlight-color:transparent;
}

html,body{
    margin:0;
    min-height:100%;
    background:#080a0e;
    color:#e8edf5;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
}

body{
    padding-bottom:40px;
}

a{
    color:inherit;
    text-decoration:none;
}

/* =========================
   HEADER
========================= */

header{
    position:sticky;
    top:0;
    z-index:100;
    height:64px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 18px;
    background:rgba(8,10,14,.94);
    border-bottom:1px solid #20252d;
    backdrop-filter:blur(14px);
    -webkit-backdrop-filter:blur(14px);
}

.logo{
    display:flex;
    align-items:center;
    gap:10px;
    font-weight:700;
    letter-spacing:.3px;
}

.logo-mark{
    width:34px;
    height:34px;
    border:2px solid #fff;
    border-radius:50%;
    position:relative;
}

.logo-mark:before{
    content:"";
    position:absolute;
    left:7px;
    top:7px;
    width:16px;
    height:16px;
    border:2px solid #fff;
    border-radius:50%;
}

.logo-mark:after{
    content:"";
    position:absolute;
    width:7px;
    height:2px;
    background:#fff;
    right:-5px;
    top:15px;
    transform:rotate(-35deg);
}

.logo-text{
    font-size:16px;
}

.back{
    padding:9px 13px;
    border:1px solid #303640;
    border-radius:9px;
    color:#cbd2dc;
    font-size:13px;
    transition:.15s;
}

.back:hover{
    background:#151922;
    border-color:#4a5260;
}

/* =========================
   MAIN
========================= */

main{
    width:min(940px,calc(100% - 28px));
    margin:0 auto;
}

.hero{
    padding:54px 0 35px;
}

.hero h1{
    margin:0 0 12px;
    font-size:clamp(30px,6vw,48px);
    line-height:1.05;
    letter-spacing:-1.5px;
}

.hero p{
    margin:0;
    max-width:700px;
    color:#9da6b4;
    font-size:16px;
    line-height:1.65;
}

/* =========================
   SECTIONS
========================= */

section{
    margin:18px 0;
    padding:24px;
    background:#0e1117;
    border:1px solid #20252d;
    border-radius:15px;
}

section h2{
    margin:0 0 14px;
    font-size:21px;
}

section h3{
    margin:22px 0 8px;
    font-size:16px;
}

section p{
    margin:9px 0;
    color:#b7bfca;
    line-height:1.65;
}

section ul{
    margin:10px 0 0;
    padding-left:21px;
    color:#b7bfca;
    line-height:1.75;
}

code{
    padding:2px 5px;
    border-radius:5px;
    background:#171b22;
    color:#dce3ed;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
    font-size:.9em;
}

/* =========================
   RADAR DEMO
========================= */

.radar-demo{
    position:relative;
    height:260px;
    margin-top:18px;
    overflow:hidden;
    border:1px solid #282e38;
    border-radius:12px;
    background:
        linear-gradient(45deg,#10141a 25%,transparent 25%),
        linear-gradient(-45deg,#10141a 25%,transparent 25%),
        linear-gradient(45deg,transparent 75%,#10141a 75%),
        linear-gradient(-45deg,transparent 75%,#10141a 75%);
    background-size:32px 32px;
    background-position:0 0,0 16px,16px -16px,-16px 0;
}

.coverage{
    position:absolute;
    left:50%;
    top:50%;
    width:190px;
    height:190px;
    transform:translate(-50%,-50%);
    border-radius:50%;
    background:rgba(120,120,120,.16);
    border:1px solid rgba(160,160,160,.25);
}

.radar-point{
    position:absolute;
    left:50%;
    top:50%;
    width:15px;
    height:15px;
    transform:translate(-50%,-50%);
    border-radius:50%;
    background:#fff;
    border:2px solid #000;
    box-shadow:0 0 0 2px rgba(255,255,255,.08);
}

.radar-label{
    position:absolute;
    left:calc(50% + 15px);
    top:calc(50% - 9px);
    color:#fff;
    font-size:12px;
}

/* =========================
   TABLE
========================= */

.table-wrap{
    overflow-x:auto;
    margin-top:14px;
}

table{
    width:100%;
    min-width:500px;
    border-collapse:collapse;
}

th,td{
    padding:11px 12px;
    text-align:left;
    border-bottom:1px solid #252a33;
    font-size:13px;
}

th{
    color:#e8edf5;
    background:#13171e;
}

td{
    color:#aeb7c4;
}

/* =========================
   TAGS
========================= */

.tags{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top:14px;
}

.tag{
    padding:7px 10px;
    border:1px solid #2c333e;
    border-radius:8px;
    background:#12161d;
    color:#bfc7d2;
    font-size:12px;
}

/* =========================
   FOOTER
========================= */

footer{
    width:min(940px,calc(100% - 28px));
    margin:30px auto 0;
    padding-top:20px;
    border-top:1px solid #20252d;
    color:#697382;
    font-size:12px;
    line-height:1.6;
}

/* =========================
   MOBILE
========================= */

@media(max-width:600px){

    header{
        height:58px;
        padding:0 12px;
    }

    .logo-text{
        font-size:14px;
    }

    .logo-mark{
        width:30px;
        height:30px;
    }

    .logo-mark:before{
        left:6px;
        top:6px;
        width:14px;
        height:14px;
    }

    .logo-mark:after{
        top:13px;
    }

    .back{
        padding:8px 10px;
        font-size:12px;
    }

    .hero{
        padding:38px 0 25px;
    }

    .hero h1{
        font-size:32px;
    }

    .hero p{
        font-size:14px;
    }

    section{
        padding:18px;
        border-radius:12px;
    }

    section h2{
        font-size:19px;
    }

    section p,
    section ul{
        font-size:14px;
    }

    .radar-demo{
        height:220px;
    }
}
</style>
</head>

<body>

<header>
    <a class="logo" href="./index.html" aria-label="Вернуться на карту">
        <div class="logo-mark"></div>
        <div class="logo-text">Quantum Meteo</div>
    </a>

    <a class="back" href="./index.html">
        ← Карта
    </a>
</header>

<main>

    <div class="hero">
        <h1>Документация</h1>
        <p>
            Quantum Meteo — интерактивная метеорологическая карта
            с радиолокационными данными, временной шкалой и
            дополнительными инструментами анализа.
        </p>
    </div>

    <section>
        <h2>О проекте</h2>

        <p>
            Quantum Meteo предназначен для визуализации метеорологической
            информации на интерактивной карте.
        </p>

        <p>
            Основной интерфейс построен на Leaflet. Карта позволяет
            перемещаться по территории, изменять масштаб и включать
            доступные метеорологические слои.
        </p>

        <div class="tags">
            <span class="tag">Leaflet</span>
            <span class="tag">Метеорология</span>
            <span class="tag">РЛС</span>
            <span class="tag">Радиолокация</span>
            <span class="tag">Nowcasting</span>
        </div>
    </section>

    <section>
        <h2>РЛС и покрытие</h2>

        <p>
            Слой <code>РЛС и покрытие</code> отображает расположение
            радиолокационных пунктов и условную область их покрытия.
        </p>

        <div class="radar-demo">
            <div class="coverage"></div>
            <div class="radar-point"></div>
            <div class="radar-label">Радиолокационный пункт</div>
        </div>

        <h3>Обозначения</h3>

        <ul>
            <li>Белый круг с чёрной обводкой — радиолокационный пункт.</li>
            <li>Серая полупрозрачная область — область покрытия.</li>
            <li>Нажатие на точку РЛС открывает информацию о ней.</li>
        </ul>
    </section>

    <section>
        <h2>Слой «РЛС и покрытие»</h2>

        <p>
            Слой управляется непосредственно из панели слоёв карты.
            При отключении слоя точки РЛС и области покрытия скрываются.
        </p>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Элемент</th>
                        <th>Назначение</th>
                    </tr>
                </thead>

                <tbody>
                    <tr>
                        <td>РЛС</td>
                        <td>Показывает положение радиолокационного пункта.</td>
                    </tr>

                    <tr>
                        <td>Покрытие</td>
                        <td>Показывает условную область наблюдения.</td>
                    </tr>

                    <tr>
                        <td>Popup</td>
                        <td>Показывает сведения о выбранной РЛС.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <section>
        <h2>Управление картой</h2>

        <ul>
            <li>Перемещение карты выполняется свайпом.</li>
            <li>Масштаб изменяется жестом двумя пальцами.</li>
            <li>На компьютере используются колесо мыши и перетаскивание.</li>
            <li>Дополнительные элементы управления находятся непосредственно на карте.</li>
        </ul>
    </section>

    <section>
        <h2>Временная шкала</h2>

        <p>
            Временная шкала используется для переключения доступных
            временных кадров метеорологических данных.
        </p>

        <p>
            При выборе другого кадра карта должна отображать данные,
            соответствующие выбранному времени.
        </p>

        <div class="tags">
            <span class="tag">Время</span>
            <span class="tag">Кадры</span>
            <span class="tag">Анимация</span>
        </div>
    </section>

    <section>
        <h2>Точки и информация</h2>

        <p>
            Интерактивные объекты карты могут реагировать на нажатие.
            Для радиолокационных пунктов отображается информационное окно
            с названием и координатами.
        </p>
    </section>

    <section>
        <h2>Легенда</h2>

        <p>
            Цветовая шкала конкретного метеорологического слоя зависит
            от используемого типа данных.
        </p>

        <p>
            Для радиолокационной отражаемости обычно используется шкала
            интенсивности в dBZ. Чем выше значение отражаемости, тем
            интенсивнее радиолокационный сигнал от гидрометеоров.
        </p>
    </section>

    <section>
        <h2>Ограничения</h2>

        <ul>
            <li>Положение РЛС не следует воспринимать как точное местоположение каждого радиолокационного оборудования без подтверждения источником.</li>
            <li>Область покрытия является визуализацией и не гарантирует одинаковое качество данных во всей зоне.</li>
            <li>Отсутствие отражения на карте не обязательно означает отсутствие осадков.</li>
            <li>Радиолокационные данные могут иметь задержку или временные пропуски.</li>
        </ul>
    </section>

    <section>
        <h2>Структура проекта</h2>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Файл</th>
                        <th>Назначение</th>
                    </tr>
                </thead>

                <tbody>
                    <tr>
                        <td><code>index.html</code></td>
                        <td>Основная карта Quantum Meteo.</td>
                    </tr>

                    <tr>
                        <td><code>radars.js</code></td>
                        <td>Радиолокационные пункты и слой покрытия.</td>
                    </tr>

                    <tr>
                        <td><code>docs.html</code></td>
                        <td>Документация проекта.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

</main>

<footer>
    Quantum Meteo — документация проекта.
    <br>
    Для возврата к карте нажмите «Карта» в верхней части страницы.
</footer>

</body>
</html>
