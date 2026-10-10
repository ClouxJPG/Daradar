/* =========================================================
   Daradar — MeteoRadar Login UI
   Авторизация: 12 часов
   ========================================================= */

(() => {
  "use strict";

  const API = "/api/auth";
  const source = document.getElementById("app-source");

  if (!source) {
    document.body.innerHTML =
      "<p style='color:white;padding:24px'>Ошибка: app-source не найден.</p>";
    return;
  }

  const appHTML = source.textContent;

  const style = document.createElement("style");
  style.textContent = `
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #050b12;
      color: #e9f4ff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    /* Фон радиолокационной станции */

    .mr-background {
      position: fixed;
      inset: 0;
      overflow: hidden;
      background:
        radial-gradient(ellipse at 50% 42%, #10302c 0%, transparent 38%),
        radial-gradient(ellipse at 50% 100%, #0a1c2c 0%, transparent 55%),
        #050b12;
      z-index: -1;
    }

    .mr-grid {
      position: absolute;
      inset: -50%;
      opacity: .2;
      background-image:
        linear-gradient(#2a786a 1px, transparent 1px),
        linear-gradient(90deg, #2a786a 1px, transparent 1px);
      background-size: 42px 42px;
      transform: perspective(600px) rotateX(8deg);
      mask-image: linear-gradient(to bottom, transparent, black 30%, black 75%, transparent);
    }

    .mr-glow {
      position: absolute;
      width: 500px;
      height: 500px;
      left: 50%;
      top: 43%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: #00d5a018;
      filter: blur(75px);
    }

    /* Главная панель */

    .mr-wrap {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 18px;
    }

    .mr-card {
      position: relative;
      width: 100%;
      max-width: 410px;
      padding: 32px 27px 25px;
      overflow: hidden;
      border-radius: 23px;
      border: 1px solid #28483f;
      background:
        linear-gradient(145deg, #14231ff2, #0b131cf7 60%, #0a111afc);
      box-shadow:
        0 0 0 1px #ffffff05,
        0 25px 90px #0009,
        0 0 45px #00e0a00b;
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
    }

    .mr-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 13%;
      right: 13%;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        #55ffbd,
        #69d9ff,
        transparent
      );
      box-shadow: 0 0 16px #28e8ad80;
    }

    .mr-card::after {
      content: "";
      position: absolute;
      width: 180px;
      height: 180px;
      right: -120px;
      top: -120px;
      border-radius: 50%;
      background: #29ffc414;
      filter: blur(20px);
      pointer-events: none;
    }

    /* Логотип и радар */

    .mr-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .mr-radar {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto 20px;
      border-radius: 50%;
      overflow: hidden;
      border: 1px solid #40d9a65c;
      background:
        radial-gradient(circle, transparent 18%, #38d9a625 19%, transparent 20%),
        radial-gradient(circle, transparent 38%, #38d9a625 39%, transparent 40%),
        radial-gradient(circle, transparent 59%, #38d9a625 60%, transparent 61%),
        radial-gradient(circle, transparent 79%, #38d9a625 80%, transparent 81%),
        #081a19;
      box-shadow:
        0 0 25px #00f0a014,
        inset 0 0 22px #00f0a00a;
    }

    .mr-radar::before,
    .mr-radar::after {
      content: "";
      position: absolute;
      background: #43e7b52a;
    }

    .mr-radar::before {
      width: 1px;
      top: 0;
      bottom: 0;
      left: 50%;
    }

    .mr-radar::after {
      height: 1px;
      left: 0;
      right: 0;
      top: 50%;
    }

    .mr-sweep {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        transparent 270deg,
        #19e8a000 300deg,
        #19e8a018 325deg,
        #4dffc180 359deg,
        #4dffc180 360deg
      );
      animation: mr-rotate 4s linear infinite;
    }

    .mr-sweep::after {
      content: "";
      position: absolute;
      width: 5px;
      height: 5px;
      top: 27%;
      left: 67%;
      border-radius: 50%;
      background: #8dffcf;
      box-shadow: 0 0 9px #8dffcf;
    }

    .mr-center {
      position: absolute;
      width: 5px;
      height: 5px;
      left: calc(50% - 2.5px);
      top: calc(50% - 2.5px);
      border-radius: 50%;
      background: #8dffcf;
      box-shadow: 0 0 10px #8dffcf;
    }

    @keyframes mr-rotate {
      to { transform: rotate(360deg); }
    }

    .mr-title {
      margin: 0;
      font-size: 31px;
      line-height: 1.1;
      font-weight: 850;
      letter-spacing: 2.5px;
      color: #f0fff9;
      text-shadow: 0 0 24px #55ffbd12;
    }

    .mr-title span {
      color: #55edb0;
    }

    .mr-subtitle {
      margin-top: 10px;
      color: #8daaa5;
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .mr-divider {
      height: 1px;
      margin: 25px 0 23px;
      background: linear-gradient(
        90deg,
        transparent,
        #31594e,
        #31594e,
        transparent
      );
    }

    .mr-access {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 9px;
      color: #e2f5ee;
      font-size: 15px;
      font-weight: 700;
    }

    .mr-access-icon {
      width: 29px;
      height: 29px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      color: #64f0b8;
      background: #1b4c3d70;
      border: 1px solid #3b9c7850;
      font-size: 15px;
    }

    .mr-description {
      margin: 0 0 20px;
      color: #82959a;
      font-size: 13px;
      line-height: 1.55;
    }

    /* Поле пароля */

    .mr-label {
      display: block;
      margin-bottom: 9px;
      color: #b3c9c7;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .5px;
    }

    .mr-password-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      height: 54px;
      padding: 0 14px;
      border: 1px solid #29463f;
      border-radius: 12px;
      background: #060e14;
      transition: border-color .18s, box-shadow .18s;
    }

    .mr-password-wrap:focus-within {
      border-color: #42dca5;
      box-shadow: 0 0 0 3px #42dca510;
    }

    .mr-lock {
      flex-shrink: 0;
      color: #54d9a7;
      font-size: 18px;
    }

    .mr-input {
      min-width: 0;
      width: 100%;
      height: 100%;
      padding: 0;
      color: #edfff8;
      background: transparent;
      border: 0;
      outline: 0;
      font: inherit;
      font-size: 15px;
    }

    .mr-input::placeholder {
      color: #52676b;
    }

    .mr-eye {
      flex-shrink: 0;
      padding: 5px;
      color: #78958d;
      border: 0;
      background: transparent;
      cursor: pointer;
      font-size: 17px;
    }

    .mr-eye:active {
      color: #65efb5;
    }

    /* Кнопка */

    .mr-button {
      position: relative;
      width: 100%;
      min-height: 53px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 15px;
      overflow: hidden;
      border: 1px solid #7bffd0;
      border-radius: 12px;
      color: #04160f;
      background: linear-gradient(105deg, #52e9ad, #8af6c9);
      box-shadow: 0 5px 24px #2bf0a21b;
      font-size: 14px;
      font-weight: 850;
      letter-spacing: .6px;
      cursor: pointer;
      transition: filter .15s, transform .15s;
    }

    .mr-button:active {
      transform: scale(.985);
    }

    .mr-button:hover {
      filter: brightness(1.08);
    }

    .mr-button:disabled {
      cursor: wait;
      opacity: .65;
    }

    .mr-arrow {
      font-size: 18px;
    }

    .mr-error {
      min-height: 19px;
      margin-top: 11px;
      color: #ff8585;
      font-size: 12px;
      text-align: center;
    }

    .mr-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      margin-top: 17px;
      color: #77958c;
      font-size: 11px;
    }

    .mr-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #45e6a8;
      box-shadow: 0 0 9px #45e6a8;
    }

    .mr-footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #ffffff0b;
      color: #50656a;
      font-size: 10px;
      text-align: center;
      letter-spacing: 1px;
    }

    @media (max-width: 420px) {
      .mr-card {
        padding: 28px 22px 22px;
        border-radius: 20px;
      }

      .mr-radar {
        width: 88px;
        height: 88px;
      }

      .mr-title {
        font-size: 28px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mr-sweep {
        animation: none;
      }

      .mr-password-wrap,
      .mr-button {
        transition: none;
      }
    }
  `;

  document.head.appendChild(style);

  function showLogin(message = "") {
    document.body.innerHTML = `
      <div class="mr-background" aria-hidden="true">
        <div class="mr-grid"></div>
        <div class="mr-glow"></div>
      </div>

      <main class="mr-wrap">
        <section class="mr-card">
          <div class="mr-brand">
            <div class="mr-radar" aria-hidden="true">
              <div class="mr-sweep"></div>
              <div class="mr-center"></div>
            </div>

            <h1 class="mr-title">DARA<span>DAR</span></h1>
            <div class="mr-subtitle">Weather radar system</div>
          </div>

          <div class="mr-divider"></div>

          <div class="mr-access">
            <div class="mr-access-icon">⌑</div>
            <span>Закрытый доступ</span>
          </div>

          <p class="mr-description">
            Введите персональный пароль, чтобы открыть
            метеорологическую радиолокационную карту.
          </p>

          <form id="auth-form">
            <label class="mr-label" for="auth-password">
              ПАРОЛЬ ДОСТУПА
            </label>

            <div class="mr-password-wrap">
              <span class="mr-lock" aria-hidden="true">⌑</span>

              <input
                class="mr-input"
                id="auth-password"
                type="password"
                placeholder="Введите ваш пароль"
                autocomplete="current-password"
                required
              >

              <button
                class="mr-eye"
                id="auth-eye"
                type="button"
                aria-label="Показать пароль"
              >◉</button>
            </div>

            <button
              class="mr-button"
              id="auth-submit"
              type="submit"
            >
              <span id="auth-button-text">ОТКРЫТЬ КАРТУ</span>
              <span class="mr-arrow" aria-hidden="true">→</span>
            </button>

            <div class="mr-error" id="auth-error" role="status"></div>
          </form>

          <div class="mr-status">
            <span class="mr-status-dot"></span>
            СИСТЕМА ДОСТУПА
          </div>

          <div class="mr-footer">
            DARA DAR · METEOROLOGICAL MONITORING
          </div>
        </section>
      </main>
    `;

    document.getElementById("auth-error").textContent = message;

    document.getElementById("auth-form")
      .addEventListener("submit", login);

    document.getElementById("auth-eye")
      .addEventListener("click", () => {
        const input = document.getElementById("auth-password");
        const visible = input.type === "text";

        input.type = visible ? "password" : "text";
        document.getElementById("auth-eye").textContent =
          visible ? "◉" : "◎";
        document.getElementById("auth-eye").setAttribute(
          "aria-label",
          visible ? "Показать пароль" : "Скрыть пароль"
        );
      });
  }

  async function login(event) {
    event.preventDefault();

    const input = document.getElementById("auth-password");
    const button = document.getElementById("auth-submit");
    const buttonText = document.getElementById("auth-button-text");
    const error = document.getElementById("auth-error");

    button.disabled = true;
    buttonText.textContent = "ПРОВЕРКА ПАРОЛЯ...";
    error.textContent = "";

    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "login",
          password: input.value
        })
      });

      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        error.textContent = data.error || "Неверный пароль";
        return;
      }

      location.reload();
    } catch {
      error.textContent = "Сервер недоступен. Попробуйте ещё раз.";
    } finally {
      if (document.getElementById("auth-submit")) {
        button.disabled = false;
        buttonText.textContent = "ОТКРЫТЬ КАРТУ";
      }
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(
        new Error("Не удалось загрузить " + src)
      );
      document.body.appendChild(script);
    });
  }

  async function openApp() {
    document.body.innerHTML = appHTML;

    try {
      await loadScript("./radars.js");
      await loadScript("./docs-button.js");
      await loadScript("/radar-cleaner.js");
    } catch (error) {
      console.error("Daradar: ошибка загрузки приложения", error);
    }
  }

  async function init() {
    try {
      const response = await fetch(API, {
        credentials: "same-origin",
        cache: "no-store"
      });

      const data = await response.json();

      if (response.ok && data.authenticated) {
        await openApp();
      } else {
        showLogin();
      }
    } catch {
      showLogin("Не удалось подключиться к серверу авторизации.");
    }
  }

  init();
})();
