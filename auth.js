/* =========================================================
   Daradar — авторизация, выход и админ-панель
   Вход: только пароль, без поля логина
   ========================================================= */

(() => {
  "use strict";

  const API = "/api/auth";
  const ADMIN_API = "/api/admin";

  const source = document.getElementById("app-source");
  const appCode = source ? source.textContent : "";

  let appStarted = false;
  let currentUser = null;
  let adminOverlay = null;

  const style = document.createElement("style");
  style.textContent = `
    #daradarLoginOverlay,
    #daradarAdminOverlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: #080d18;
      color: #edf4ff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .dd-panel {
      box-sizing: border-box;
      width: 100%;
      max-width: 390px;
      padding: 24px;
      border: 1px solid #263650;
      border-radius: 18px;
      background: #111b2b;
      box-shadow: 0 20px 70px #0008;
    }

    .dd-title {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 800;
    }

    .dd-muted {
      color: #91a5c2;
      font-size: 13px;
      line-height: 1.5;
    }

    .dd-input, .dd-select {
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      margin-top: 10px;
      padding: 11px 12px;
      border: 1px solid #344966;
      border-radius: 10px;
      outline: none;
      background: #0b1422;
      color: #fff;
      font-size: 15px;
    }

    .dd-input:focus, .dd-select:focus {
      border-color: #4895ff;
    }

    .dd-button {
      min-height: 40px;
      padding: 9px 13px;
      border: 1px solid #345985;
      border-radius: 10px;
      background: #183b66;
      color: #fff;
      font-size: 14px;
      font-weight: 650;
      cursor: pointer;
    }

    .dd-button:disabled {
      opacity: .55;
      cursor: wait;
    }

    .dd-primary {
      width: 100%;
      margin-top: 14px;
      background: #2676e8;
      border-color: #2676e8;
    }

    .dd-error {
      margin-top: 12px;
      color: #ff8888;
      font-size: 13px;
      white-space: pre-wrap;
    }

    #daradarUserControls {
      position: fixed;
      z-index: 10010;
      top: calc(62px + env(safe-area-inset-top));
      right: calc(10px + env(safe-area-inset-right));
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: calc(100vw - 20px);
    }

    #daradarUserControls .dd-button {
      min-height: 36px;
      padding: 7px 10px;
      font-size: 12px;
      background: #111d2d;
      border-color: #334c6b;
    }

    #daradarAdminOverlay {
      overflow: auto;
      align-items: flex-start;
      padding-top: max(20px, env(safe-area-inset-top));
      padding-bottom: max(20px, env(safe-area-inset-bottom));
      background: #060b13ed;
    }

    .dd-admin-panel {
      width: 100%;
      max-width: 680px;
      margin: auto;
      padding: 20px;
      border: 1px solid #293c56;
      border-radius: 16px;
      background: #101a29;
      box-sizing: border-box;
    }

    .dd-admin-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .dd-admin-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .dd-admin-grid .dd-input,
    .dd-admin-grid .dd-select {
      margin: 0;
      min-width: 0;
    }

    .dd-admin-create {
      margin-top: 10px;
    }

    .dd-user-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
      border-top: 1px solid #28384e;
    }

    .dd-user-info {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .dd-user-name {
      font-weight: 700;
      font-size: 14px;
    }

    .dd-user-meta {
      margin-top: 4px;
      color: #91a5c2;
      font-size: 12px;
    }

    @media (max-width: 440px) {
      #daradarUserControls {
        top: calc(58px + env(safe-area-inset-top));
      }

      #daradarUserControls .dd-button {
        padding: 6px 8px;
        font-size: 11px;
      }

      .dd-admin-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);

  function makeButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dd-button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function makeError(className = "dd-error") {
    const node = document.createElement("div");
    node.className = className;
    return node;
  }

  function hideApp() {
    document.querySelectorAll("body > *").forEach((node) => {
      if (node.id !== "daradarLoginOverlay" && node.tagName !== "SCRIPT") {
        node.dataset.ddPreviousDisplay = node.style.display;
        node.style.display = "none";
      }
    });
  }

  function restoreApp() {
    document.querySelectorAll("[data-dd-previous-display]").forEach((node) => {
      node.style.display = node.dataset.ddPreviousDisplay || "";
      delete node.dataset.ddPreviousDisplay;
    });

    document.querySelectorAll("body > *").forEach((node) => {
      if (node.dataset.ddPreviousDisplay !== undefined) {
        node.style.display = node.dataset.ddPreviousDisplay;
        delete node.dataset.ddPreviousDisplay;
      }
    });
  }

  function showLogin(message = "") {
    let overlay = document.getElementById("daradarLoginOverlay");

    if (overlay) overlay.remove();

    hideApp();

    overlay = document.createElement("div");
    overlay.id = "daradarLoginOverlay";

    const panel = document.createElement("form");
    panel.className = "dd-panel";

    const title = document.createElement("h1");
    title.className = "dd-title";
    title.textContent = "Daradar";

    const subtitle = document.createElement("div");
    subtitle.className = "dd-muted";
    subtitle.textContent = "Введите пароль для входа.";

    const password = document.createElement("input");
    password.className = "dd-input";
    password.type = "password";
    password.placeholder = "Пароль";
    password.autocomplete = "current-password";
    password.required = true;

    const submit = document.createElement("button");
    submit.className = "dd-button dd-primary";
    submit.type = "submit";
    submit.textContent = "Войти";

    const error = makeError();
    error.textContent = message;

    panel.append(title, subtitle, password, submit, error);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    panel.addEventListener("submit", async (event) => {
      event.preventDefault();

      submit.disabled = true;
      submit.textContent = "Проверка…";
      error.textContent = "";

      try {
        const response = await fetch(API, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login",
            password: password.value
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Неверный пароль.");
        }

        currentUser = data.user || null;
        overlay.remove();
        restoreApp();
        await startApp();
      } catch (err) {
        error.textContent = err.message || "Не удалось войти.";
        password.value = "";
        password.focus();
      } finally {
        submit.disabled = false;
        submit.textContent = "Войти";
      }
    });

    setTimeout(() => password.focus(), 100);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Не удалось загрузить " + src));
      document.body.appendChild(script);
    });
  }

  async function startApp() {
    if (appStarted) {
      addUserControls();
      return;
    }

    appStarted = true;

    try {
      if (appCode.trim()) {
        const script = document.createElement("script");
        script.textContent = appCode;
        document.body.appendChild(script);
      }

      await loadScript("./radars.js");
      await loadScript("./docs-button.js");
      await loadScript("/radar-cleaner.js");

      addUserControls();
    } catch (err) {
      appStarted = false;
      console.error("[Daradar]", err);
      alert("Ошибка загрузки приложения: " + err.message);
    }
  }

  function addUserControls() {
    let controls = document.getElementById("daradarUserControls");

    if (controls) controls.remove();

    controls = document.createElement("div");
    controls.id = "daradarUserControls";

    if (currentUser && currentUser.role === "admin") {
      controls.appendChild(
        makeButton("Админ-панель", openAdminPanel)
      );
    }

    controls.appendChild(makeButton("Выйти", logout));
    document.body.appendChild(controls);
  }

  async function logout() {
    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      });

      if (!response.ok) {
        throw new Error("Сервер не подтвердил выход.");
      }

      window.location.reload();
    } catch (err) {
      alert("Не удалось выйти: " + err.message);
    }
  }

  async function adminRequest(method = "GET", body = null) {
    const options = {
      method,
      credentials: "same-origin",
      headers: {}
    };

    if (body !== null) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(ADMIN_API, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "Ошибка запроса к админ-панели.");
    }

    return data;
  }

  async function openAdminPanel() {
    if (!currentUser || currentUser.role !== "admin") {
      alert("Нет прав администратора.");
      return;
    }

    if (adminOverlay) adminOverlay.remove();

    adminOverlay = document.createElement("div");
    adminOverlay.id = "daradarAdminOverlay";

    const panel = document.createElement("div");
    panel.className = "dd-admin-panel";

    const header = document.createElement("div");
    header.className = "dd-admin-head";

    const title = document.createElement("h2");
    title.className = "dd-title";
    title.style.fontSize = "22px";
    title.textContent = "Админ-панель";

    const close = makeButton("Закрыть", () => {
      adminOverlay.remove();
      adminOverlay = null;
    });

    header.append(title, close);

    const description = document.createElement("div");
    description.className = "dd-muted";
    description.textContent =
      "Создание пользователей и управление доступом.";

    const formTitle = document.createElement("h3");
    formTitle.textContent = "Создать пользователя";
    formTitle.style.margin = "22px 0 10px";

    const form = document.createElement("form");
    const grid = document.createElement("div");
    grid.className = "dd-admin-grid";

    const username = document.createElement("input");
    username.className = "dd-input";
    username.placeholder = "Логин";
    username.autocomplete = "off";
    username.required = true;

    const displayName = document.createElement("input");
    displayName.className = "dd-input";
    displayName.placeholder = "Имя пользователя";
    displayName.required = true;

    const password = document.createElement("input");
    password.className = "dd-input";
    password.type = "password";
    password.placeholder = "Пароль (10+ символов)";
    password.autocomplete = "new-password";
    password.minLength = 10;
    password.required = true;

    const role = document.createElement("select");
    role.className = "dd-select";
    role.innerHTML =
      '<option value="user">Пользователь</option>' +
      '<option value="admin">Администратор</option>';

    grid.append(username, displayName, password, role);

    const create = document.createElement("button");
    create.className = "dd-button dd-primary dd-admin-create";
    create.type = "submit";
    create.textContent = "Создать пользователя";

    const formError = makeError();
    const formSuccess = makeError();
    formSuccess.style.color = "#7ee0a3";

    form.append(grid, create, formError, formSuccess);

    const usersTitle = document.createElement("h3");
    usersTitle.textContent = "Пользователи";
    usersTitle.style.margin = "24px 0 8px";

    const usersList = document.createElement("div");
    const listMessage = makeError();
    listMessage.style.color = "#91a5c2";

    panel.append(
      header,
      description,
      formTitle,
      form,
      usersTitle,
      listMessage,
      usersList
    );

    adminOverlay.appendChild(panel);
    document.body.appendChild(adminOverlay);

    async function refreshUsers() {
      listMessage.textContent = "Загрузка пользователей…";
      usersList.replaceChildren();

      try {
        const data = await adminRequest("GET");
        const users = Array.isArray(data.users) ? data.users : [];

        listMessage.textContent = users.length
          ? "Всего пользователей: " + users.length
          : "Пользователей пока нет.";

        users.forEach((user) => {
          const row = document.createElement("div");
          row.className = "dd-user-row";

          const info = document.createElement("div");
          info.className = "dd-user-info";

          const name = document.createElement("div");
          name.className = "dd-user-name";
          name.textContent =
            user.display_name || user.username || "Без имени";

          const meta = document.createElement("div");
          meta.className = "dd-user-meta";

          const active = user.active === true;
          const roleLabel = user.role === "admin"
            ? "Администратор"
            : "Пользователь";

          meta.textContent =
            (user.username ? "Логин: " + user.username + " · " : "") +
            roleLabel + " · " +
            (active ? "Активен" : "Отключён");

          info.append(name, meta);

          const toggle = makeButton(
            active ? "Отключить" : "Включить",
            async () => {
              toggle.disabled = true;

              try {
                await adminRequest("POST", {
                  action: "set-active",
                  id: user.id,
                  active: !active
                });

                await refreshUsers();
              } catch (err) {
                alert(err.message);
                toggle.disabled = false;
              }
            }
          );

          row.append(info, toggle);
          usersList.appendChild(row);
        });
      } catch (err) {
        listMessage.textContent = "Ошибка: " + err.message;
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      create.disabled = true;
      create.textContent = "Создание…";
      formError.textContent = "";
      formSuccess.textContent = "";

      try {
        await adminRequest("POST", {
          action: "create",
          username: username.value.trim(),
          display_name: displayName.value.trim(),
          password: password.value,
          role: role.value
        });

        form.reset();
        formSuccess.textContent = "Пользователь создан.";
        await refreshUsers();
      } catch (err) {
        formError.textContent = err.message;
      } finally {
        create.disabled = false;
        create.textContent = "Создать пользователя";
      }
    });

    adminOverlay.addEventListener("click", (event) => {
      if (event.target === adminOverlay) {
        adminOverlay.remove();
        adminOverlay = null;
      }
    });

    await refreshUsers();
  }

  async function init() {
    try {
      const response = await fetch(API, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.authenticated) {
        currentUser = data.user || null;
        await startApp();
      } else {
        showLogin();
      }
    } catch (err) {
      console.error("[Daradar auth]", err);
      showLogin("Не удалось проверить сессию. Попробуйте войти ещё раз.");
    }
  }

  init();
})();
