/* =========================================================
   Daradar — авторизация
   Сессия: 12 часов
   API: /api/auth
   ========================================================= */

(() => {
  "use strict";

  const API = "/api/auth";
  const source = document.getElementById("app-source");

  if (!source) {
    document.body.innerHTML =
      "<p style='padding:24px;color:white;background:#080d16'>Ошибка: не найден app-source в index.html.</p>";
    return;
  }

  const appHTML = source.textContent;

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: #080d16;
      color: #eef4ff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .auth-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .auth-card {
      width: 100%;
      max-width: 380px;
      padding: 28px;
      background: #111a29;
      border: 1px solid #263650;
      border-radius: 18px;
      box-shadow: 0 18px 60px #0006;
    }

    .auth-logo {
      font-size: 30px;
      font-weight: 800;
      color: #70b7ff;
      text-align: center;
    }

    .auth-sub {
      text-align: center;
      color: #9cacc4;
      margin: 8px 0 24px;
    }

    .auth-input {
      width: 100%;
      padding: 14px;
      margin-bottom: 12px;
      color: white;
      background: #080f1c;
      border: 1px solid #30425e;
      border-radius: 10px;
      font-size: 16px;
      outline: none;
    }

    .auth-input:focus {
      border-color: #70b7ff;
    }

    .auth-button {
      width: 100%;
      padding: 14px;
      color: #07111f;
      background: #70b7ff;
      border: 0;
      border-radius: 10px;
      font-weight: 750;
      font-size: 16px;
      cursor: pointer;
    }

    .auth-button:disabled {
      opacity: .6;
    }

    .auth-error {
      min-height: 22px;
      margin-top: 12px;
      color: #ff8585;
      font-size: 14px;
      text-align: center;
    }
  `;

  document.head.appendChild(style);

  function showLogin(message = "") {
    document.body.innerHTML = `
      <main class="auth-wrap">
        <form class="auth-card" id="auth-form">
          <div class="auth-logo">Daradar</div>
          <div class="auth-sub">Закрытый доступ к радару</div>

          <input
            class="auth-input"
            id="auth-password"
            type="password"
            placeholder="Введите пароль доступа"
            autocomplete="current-password"
            required
          >

          <button class="auth-button" id="auth-submit" type="submit">
            Войти
          </button>

          <div class="auth-error" id="auth-error"></div>
        </form>
      </main>
    `;

    document.getElementById("auth-error").textContent = message;

    document
      .getElementById("auth-form")
      .addEventListener("submit", login);
  }

  async function login(event) {
    event.preventDefault();

    const input = document.getElementById("auth-password");
    const button = document.getElementById("auth-submit");
    const error = document.getElementById("auth-error");

    button.disabled = true;
    button.textContent = "Проверка...";
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
    } catch (e) {
      error.textContent = "Ошибка соединения с сервером";
    } finally {
      if (document.getElementById("auth-submit")) {
        button.disabled = false;
        button.textContent = "Войти";
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
      console.error(error);
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
      showLogin("Сервер авторизации недоступен");
    }
  }

  init();
})();
