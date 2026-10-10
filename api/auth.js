/* =========================================================
   Daradar — авторизация и запуск приложения
   Проверка пароля: /api/auth
   Код радара запускается только после авторизации
   ========================================================= */

(() => {
  "use strict";

  const source = document.getElementById("app-source");

  const style = document.createElement("style");

  style.textContent = `
    #login-screen {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 22px;
      background: #080d18;
      color: #eef4ff;
      font: 16px Arial, sans-serif;
      box-sizing: border-box;
    }

    #login-card {
      width: 100%;
      max-width: 360px;
      padding: 28px 22px;
      border: 1px solid #283750;
      border-radius: 18px;
      background: #101a2b;
      box-shadow: 0 20px 70px #0008;
      box-sizing: border-box;
    }

    #login-card h1 {
      margin: 0 0 8px;
      font-size: 27px;
      letter-spacing: .3px;
    }

    #login-card p {
      margin: 0 0 20px;
      color: #9eafc8;
      line-height: 1.5;
    }

    #login-password,
    #login-submit {
      display: block;
      width: 100%;
      min-height: 49px;
      box-sizing: border-box;
      border-radius: 10px;
      font-size: 16px;
    }

    #login-password {
      padding: 0 14px;
      color: #fff;
      background: #080f1d;
      border: 1px solid #344967;
      outline: none;
    }

    #login-password:focus {
      border-color: #4285ff;
    }

    #login-submit {
      margin-top: 12px;
      border: 0;
      color: white;
      background: #2468d8;
      font-weight: bold;
      cursor: pointer;
    }

    #login-submit:disabled {
      opacity: .6;
      cursor: wait;
    }

    #login-error {
      min-height: 20px;
      margin-top: 12px;
      color: #ff8c98;
      font-size: 14px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    #login-error:empty {
      display: none;
    }
  `;

  document.head.appendChild(style);

  const screen = document.createElement("div");

  screen.id = "login-screen";

  screen.innerHTML = `
    <form id="login-card">
      <h1>Daradar</h1>

      <p>
        Введите пароль для доступа
        к метеорадару.
      </p>

      <input
        id="login-password"
        type="password"
        placeholder="Пароль"
        autocomplete="current-password"
        required
      >

      <button
        id="login-submit"
        type="submit"
      >
        Войти
      </button>

      <div
        id="login-error"
        role="status"
        aria-live="polite"
      ></div>
    </form>
  `;

  document.body.appendChild(screen);

  const form =
    document.getElementById("login-card");

  const input =
    document.getElementById("login-password");

  const button =
    document.getElementById("login-submit");

  const error =
    document.getElementById("login-error");

  let started = false;

  /* =======================================================
     ЗАПРОС К СЕРВЕРУ АВТОРИЗАЦИИ
     ======================================================= */

  async function requestAuth(options = {}) {
    const response = await fetch("/api/auth", {
      method: options.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: options.headers || {},
      body: options.body
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Сервер вернул некорректный ответ."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        `Ошибка сервера: ${response.status}`
      );
    }

    return data;
  }

  /* =======================================================
     ЗАГРУЗКА ДОПОЛНИТЕЛЬНЫХ JS-ФАЙЛОВ
     ======================================================= */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script =
        document.createElement("script");

      script.src = src;

      script.onload = () => resolve();

      script.onerror = () => {
        script.remove();

        reject(
          new Error(
            "Не удалось загрузить файл: " + src
          )
        );
      };

      document.body.appendChild(script);
    });
  }

  /* =======================================================
     ЗАПУСК ОСНОВНОГО ПРИЛОЖЕНИЯ
     ======================================================= */

  async function startApp() {
    if (started) return;

    if (!source) {
      error.textContent =
        "Не найден код приложения. Проверь index.html.";

      return;
    }

    started = true;
    button.disabled = true;
    input.disabled = true;

    error.textContent =
      "Загрузка метеорадара…";

    try {
      /*
       * Выполняем основной код, сохранённый
       * в index.html внутри #app-source.
       */

      const appScript =
        document.createElement("script");

      appScript.textContent =
        source.textContent;

      document.body.appendChild(appScript);

      /*
       * Загружаем остальные модули
       * в исходном порядке.
       */

      await loadScript("./radars.js");

      await loadScript("./docs-button.js");

      await loadScript("/radar-cleaner.js");

      /*
       * Авторизация пройдена, приложение загружено.
       */

      screen.remove();
      style.remove();

    } catch (e) {
      started = false;
      button.disabled = false;
      input.disabled = false;

      error.textContent =
        e.message ||
        "Не удалось загрузить приложение.";
    }
  }

  /* =======================================================
     ПРОВЕРКА ВВЕДЁННОГО ПАРОЛЯ
     ======================================================= */

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if (started) return;

      button.disabled = true;

      error.textContent =
        "Проверка пароля…";

      try {
        await requestAuth({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            password: input.value
          })
        });

        input.value = "";

        await startApp();

      } catch (e) {
        button.disabled = false;

        error.textContent =
          e.message ||
          "Ошибка соединения с сервером.";

        input.focus();
        input.select();
      }
    }
  );

  /* =======================================================
     ВОССТАНОВЛЕНИЕ СЕССИИ
     ======================================================= */

  requestAuth()
    .then(data => {
      if (data.authenticated) {
        startApp();
      }
    })
    .catch(() => {
      error.textContent =
        "Не удалось проверить сессию. Проверь соединение.";
    });

})();
