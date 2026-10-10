/* =========================================================
   Quantum — авторизация и MeteoRadar Login
   Сессия: 12 часов, проверка через /api/auth
   Кнопка выхода + защита от повторного запуска карты
   Контакт для получения ключа: @github_creator
   ========================================================= */
(() => {
  "use strict";
  const API = "/api/auth";
  const source = document.getElementById("app-source");
  if (!source) {
    document.body.style.visibility = "visible";
    document.body.innerHTML =
      "<div style='padding:24px;color:white;background:#080d16'>Ошибка: app-source не найден в index.html.</div>";
    return;
  }
  const appCode = source.textContent;
  const originalNodes = [...document.body.children];
  const originalVisibility = new Map(
    originalNodes.map(node => [node, node.style.visibility])
  );
  let overlay = null;
  let appStarted = false;
  let appInitialized = false;
  let logoutInProgress = false;
  const style = document.createElement("style");
  style.textContent = `
    .mr-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      overflow-y: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 22px 16px;
      background:
        radial-gradient(ellipse at 50% 40%, #10372e 0%, transparent 43%),
        radial-gradient(ellipse at 100% 100%, #10283b 0%, transparent 55%),
        #050b12;
      color: #e9f4ff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .mr-overlay * {
      box-sizing: border-box;
    }
    .mr-grid {
      position: fixed;
      inset: -30%;
      pointer-events: none;
      opacity: .16;
      background-image:
        linear-gradient(#37b997 1px, transparent 1px),
        linear-gradient(90deg, #37b997 1px, transparent 1px);
      background-size: 38px 38px;
      transform: perspective(600px) rotateX(8deg);
      mask-image: linear-gradient(transparent, black 30%, black 75%, transparent);
    }
    .mr-card {
      position: relative;
      width: 100%;
      max-width: 400px;
      padding: 30px 25px 23px;
      border: 1px solid #31564a;
      border-radius: 22px;
      overflow: hidden;
      background: linear-gradient(145deg, #14251ff5, #09121bf9);
      box-shadow: 0 25px 90px #000a, 0 0 40px #00d99a0c;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .mr-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 12%;
      right: 12%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #55ffbd, #65dfff, transparent);
      box-shadow: 0 0 15px #55ffbd80;
    }
    .mr-brand {
      text-align: center;
    }
    .mr-radar {
      position: relative;
      width: 94px;
      height: 94px;
      margin: 0 auto 18px;
      overflow: hidden;
      border: 1px solid #43d9a675;
      border-radius: 50%;
      background:
        radial-gradient(circle, transparent 24%, #3ee7b530 25%, transparent 26%),
        radial-gradient(circle, transparent 49%, #3ee7b530 50%, transparent 51%),
        radial-gradient(circle, transparent 74%, #3ee7b530 75%, transparent 76%),
        #071b18;
      box-shadow: 0 0 28px #00f0a01a;
    }
    .mr-radar::before {
      content: "";
      position: absolute;
      inset: 0 50%;
      width: 1px;
      background: #43e7b545;
    }
    .mr-radar::after {
      content: "";
      position: absolute;
      inset: 50% 0;
      height: 1px;
      background: #43e7b545;
    }
    .mr-sweep {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        transparent 280deg,
        #35ffc00c 315deg,
        #35ffc078 359deg,
        #35ffc078 360deg
      );
      animation: mr-rotate 4s linear infinite;
    }
    /* Убрана светящаяся точка на анимированном радаре. */
    @keyframes mr-rotate {
      to { transform: rotate(360deg); }
    }
    .mr-title {
      margin: 0;
      color: #f0fff9;
      font-size: 30px;
      font-weight: 850;
      letter-spacing: 2px;
    }
    .mr-title span {
      color: #55edb0;
    }
    .mr-subtitle {
      margin-top: 9px;
      color: #8daaa5;
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 2.5px;
      text-transform: uppercase;
    }
    .mr-divider {
      height: 1px;
      margin: 24px 0 22px;
      background: linear-gradient(90deg, transparent, #31594e, transparent);
    }
    .mr-heading {
      margin-bottom: 8px;
      color: #e2f5ee;
      font-size: 15px;
      font-weight: 750;
    }
    .mr-description {
      margin: 0 0 20px;
      color: #82959a;
      font-size: 13px;
      line-height: 1.55;
    }
    .mr-label {
      display: block;
      margin-bottom: 9px;
      color: #b3c9c7;
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 1px;
    }
    .mr-password {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 53px;
      padding: 0 13px;
      border: 1px solid #29463f;
      border-radius: 11px;
      background: #060e14;
    }
    .mr-password:focus-within {
      border-color: #42dca5;
      box-shadow: 0 0 0 3px #42dca510;
    }
    .mr-lock {
      color: #54d9a7;
      font-size: 19px;
    }
    .mr-input {
      width: 100%;
      min-width: 0;
      height: 100%;
      padding: 0;
      outline: none;
      border: 0;
      color: #edfff8;
      background: transparent;
      font-size: 15px;
    }
    .mr-input::placeholder {
      color: #52676b;
    }
    .mr-eye {
      padding: 5px;
      border: 0;
      color: #80a397;
      background: transparent;
      font-size: 17px;
      cursor: pointer;
    }
    .mr-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      min-height: 52px;
      margin-top: 15px;
      border: 1px solid #7bffd0;
      border-radius: 11px;
      color: #04160f;
      background: linear-gradient(105deg, #52e9ad, #8af6c9);
      font-size: 13px;
      font-weight: 850;
      letter-spacing: .7px;
      cursor: pointer;
    }
    .mr-button:disabled {
      opacity: .65;
      cursor: wait;
    }
    .mr-error {
      min-height: 20px;
      margin-top: 10px;
      color: #ff8585;
      font-size: 12px;
      text-align: center;
    }
    /* Информация о получении ключа — исходное оформление */
    .mr-key-info {
      margin-top: 12px;
      padding: 12px 10px;
      border: 1px solid #29463f;
      border-radius: 10px;
      background: #081710;
      color: #82959a;
      font-size: 12px;
      line-height: 1.6;
      text-align: center;
    }
    .mr-key-info a {
      display: inline-block;
      margin-top: 3px;
      color: #55edb0;
      font-weight: 750;
      text-decoration: none;
    }
    .mr-key-info a:active {
      color: #8af6c9;
    }
    .mr-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      margin-top: 13px;
      color: #77958c;
      font-size: 10px;
      letter-spacing: 1px;
    }
    .mr-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #45e6a8;
      box-shadow: 0 0 9px #45e6a8;
    }
    .mr-footer {
      margin-top: 22px;
      padding-top: 15px;
      border-top: 1px solid #ffffff0b;
      color: #50656a;
      font-size: 9px;
      text-align: center;
      letter-spacing: 1px;
    }
    /* Изменена только кнопка выхода */
    #mr-logout {
      position: fixed;
      z-index: 99990;
      top: max(82px, calc(env(safe-area-inset-top) + 72px));
      right: 12px;
      display: none;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 0 14px;
      border: 0;
      border-radius: 0;
      color: #fff;
      background: #111;
      box-shadow: none;
      font: 650 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background .15s, color .15s;
    }
    #mr-logout:active {
      color: #000;
      background: #eee;
    }
    #mr-logout:disabled {
      opacity: .6;
      cursor: wait;
    }
    @media (max-width: 420px) {
      .mr-card {
        padding: 27px 21px 22px;
      }
      .mr-title {
        font-size: 28px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .mr-sweep {
        animation: none;
      }
    }
  `;
  document.head.appendChild(style);
  const logoutButton = document.createElement("button");
  logoutButton.id = "mr-logout";
  logoutButton.type = "button";
  logoutButton.textContent = "Выйти";
  logoutButton.addEventListener("click", logout);
  document.body.appendChild(logoutButton);
  function showLogin(message = "") {
    logoutButton.style.display = "none";
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "mr-overlay";
    overlay.innerHTML = `
      <div class="mr-grid"></div>
      <section class="mr-card">
        <header class="mr-brand">
          <div class="mr-radar" aria-hidden="true">
            <div class="mr-sweep"></div>
          </div>
          <h1 class="mr-title">QUAN<span>TUM</span></h1>
          <div class="mr-subtitle">Weather Radar System</div>
        </header>
        <div class="mr-divider"></div>
        <div class="mr-heading">Закрытый доступ</div>
        <p class="mr-description">
          Введите персональный пароль, чтобы открыть
          метеорологическую радиолокационную карту.
        </p>
        <form id="mr-form">
          <label class="mr-label" for="mr-password">
            ПАРОЛЬ ДОСТУПА
          </label>
          <div class="mr-password">
            <span class="mr-lock" aria-hidden="true">⌑</span>
            <input
              class="mr-input"
              id="mr-password"
              type="password"
              placeholder="Введите ваш пароль"
              autocomplete="current-password"
              required
            >
            <button
              class="mr-eye"
              id="mr-eye"
              type="button"
              aria-label="Показать пароль"
            >◉</button>
          </div>
          <button class="mr-button" id="mr-submit" type="submit">
            <span id="mr-submit-text">ОТКРЫТЬ КАРТУ</span>
            <span aria-hidden="true">→</span>
          </button>
          <div class="mr-error" id="mr-error" role="status"></div>
          <div class="mr-key-info">
            Купить ключ или договориться о его получении:
            <a
              href="https://t.me/github_creator"
              target="_blank"
              rel="noopener noreferrer"
            >@github_creator</a>
          </div>
        </form>
        <div class="mr-status">
          <span class="mr-dot"></span>
          СИСТЕМА ДОСТУПА
        </div>
        <div class="mr-footer">
          QUANTUM · METEOROLOGICAL MONITORING
        </div>
      </section>
    `;
    document.body.appendChild(overlay);
    document.body.style.visibility = "visible";
    for (const node of originalNodes) {
      node.style.visibility = "hidden";
    }
    overlay.style.visibility = "visible";
    document.getElementById("mr-eye").addEventListener("click", () => {
      const input = document.getElementById("mr-password");
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      document.getElementById("mr-eye").textContent =
        visible ? "◉" : "◎";
    });
    document.getElementById("mr-form").addEventListener("submit", login);
    document.getElementById("mr-error").textContent = message;
  }
  async function login(event) {
    event.preventDefault();
    const input = document.getElementById("mr-password");
    const button = document.getElementById("mr-submit");
    const buttonText = document.getElementById("mr-submit-text");
    const error = document.getElementById("mr-error");
    button.disabled = true;
    buttonText.textContent = "ПРОВЕРКА ПАРОЛЯ...";
    error.textContent = "";
    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
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
      await startApp();
    } catch (e) {
      console.error("Quantum login:", e);
      error.textContent = "Ошибка соединения с сервером";
    } finally {
      if (button.isConnected) {
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
  async function startApp() {
    if (appStarted) return;
    appStarted = true;
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    document.body.style.visibility = "visible";
    for (const node of originalNodes) {
      node.style.visibility = originalVisibility.get(node) || "";
    }
    try {
      if (!appInitialized) {
        const script = document.createElement("script");
        script.textContent = appCode;
        document.body.appendChild(script);
        await loadScript("./radars.js");
        await loadScript("./docs-button.js");
        await loadScript("/radar-cleaner.js");
        appInitialized = true;
      }
      logoutButton.style.display = "flex";
    } catch (error) {
      console.error("Quantum: ошибка запуска приложения", error);
      appStarted = false;
      showLogin(
        "Не удалось загрузить файл карты или дополнение. Проверьте файлы проекта."
      );
    }
  }
  async function logout() {
    if (logoutInProgress) return;
    logoutInProgress = true;
    logoutButton.disabled = true;
    logoutButton.textContent = "Выход...";
    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Не удалось завершить сессию");
      }
      appStarted = false;
      showLogin();
    } catch (error) {
      console.error("Quantum logout:", error);
      logoutButton.textContent = "Ошибка выхода";
      alert("Не удалось выйти. Проверь подключение и попробуй ещё раз.");
    } finally {
      logoutInProgress = false;
      logoutButton.disabled = false;
      if (!overlay) {
        logoutButton.textContent = "Выйти";
      }
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
        await startApp();
      } else {
        showLogin();
      }
    } catch (error) {
      console.error("Quantum auth check:", error);
      showLogin(
        "Сервер авторизации недоступен. Проверьте настройки Vercel."
      );
    }
  }
  init();
})();
