const crypto = require("crypto");
const SESSION_HOURS = 12;
const COOKIE_NAME = "daradar_session";
function secret() {
  return process.env.AUTH_SECRET || "";
}
function users() {
  const result = {};
  for (let i = 1; i <= 20; i++) {
    const id = `U${i}`;
    const password = process.env[id];
    if (typeof password === "string" && password.length > 0) {
      result[id] = {
        name: id,
        password,
        active: true
      };
    }
  }
  return result;
}
function sign(value) {
  return crypto
    .createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length &&
    crypto.timingSafeEqual(x, y);
}
function createSession(id, name, role = "user") {
  const payload = Buffer.from(JSON.stringify({
    id: String(id),
    name: String(name),
    role: role === "admin" ? "admin" : "user",
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function readSession(token) {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    if (!data.id || !data.exp || data.exp < Date.now()) {
      return null;
    }
    if (data.id === "__admin__") {
      if (
        data.role !== "admin" ||
        !process.env.DARADAR_ADMIN_PASSWORD
      ) {
        return null;
      }
      return {
        id: "__admin__",
        name: "Администратор",
        role: "admin",
        exp: data.exp
      };
    }
    if (String(data.id).startsWith("sb_")) {
      return {
        id: String(data.id),
        name: String(data.name || "Пользователь"),
        role: data.role === "admin" ? "admin" : "user",
        exp: data.exp
      };
    }
    const user = users()[data.id];
    if (!user || user.active !== true) return null;
    return {
      id: data.id,
      name: user.name,
      role: "user",
      exp: data.exp
    };
  } catch {
    return null;
  }
}
function cookieHeader(value, maxAge) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ].join("; ");
}
function getCookies(req) {
  const result = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}
function logEvent(event, id) {
  console.log(JSON.stringify({
    event,
    userId: id || null,
    time: new Date().toISOString()
  }));
}
async function supabaseRequest(path) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  const response = await fetch(
    `${url.replace(/\/+$/, "")}/rest/v1/${path}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      }
    }
  );
  if (!response.ok) {
    throw new Error("Supabase request failed");
  }
  return response.json();
}
function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = parts[1];
  const expected = parts[2];
  if (!/^[a-f0-9]{32}$/i.test(salt)) return false;
  if (!/^[a-f0-9]{128}$/i.test(expected)) return false;
  const actual = crypto.scryptSync(
    password,
    Buffer.from(salt, "hex"),
    64
  ).toString("hex");
  return safeEqual(actual, expected);
}
function send(res, status, data) {
  return res.status(status).json(data);
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!secret() || secret().length < 32) {
    return send(res, 500, {
      ok: false,
      error: "AUTH_SECRET не настроен или слишком короткий"
    });
  }
  const cookies = getCookies(req);
  if (req.method === "GET") {
    const session = readSession(cookies[COOKIE_NAME]);
    if (!session) {
      return send(res, 200, {
        ok: true,
        authenticated: false
      });
    }
    return send(res, 200, {
      ok: true,
      authenticated: true,
      user: {
        id: session.id,
        name: session.name,
        role: session.role
      },
      expiresAt: session.exp
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, {
      ok: false,
      error: "Method not allowed"
    });
  }
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};
  if (body.action === "logout") {
    const session = readSession(cookies[COOKIE_NAME]);
    if (session) logEvent("logout", session.id);
    res.setHeader("Set-Cookie", cookieHeader("", 0));
    return send(res, 200, {
      ok: true,
      authenticated: false
    });
  }
  if (
    body.action !== "login" ||
    typeof body.password !== "string"
  ) {
    return send(res, 400, {
      ok: false,
      error: "Некорректный запрос"
    });
  }
  const password = body.password;
  if (!password || password.length > 1024) {
    return send(res, 400, {
      ok: false,
      error: "Некорректный пароль"
    });
  }
  // Вход администратора сохраняется.
  const adminPassword = process.env.DARADAR_ADMIN_PASSWORD;
  if (adminPassword && safeEqual(password, adminPassword)) {
    const token = createSession(
      "__admin__",
      "Администратор",
      "admin"
    );
    res.setHeader(
      "Set-Cookie",
      cookieHeader(token, SESSION_HOURS * 60 * 60)
    );
    logEvent("admin_login_success", "__admin__");
    return send(res, 200, {
      ok: true,
      authenticated: true,
      user: {
        id: "__admin__",
        name: "Администратор",
        role: "admin"
      },
      expiresAt: Date.now() +
        SESSION_HOURS * 60 * 60 * 1000
    });
  }
  // Вход через Supabase сохраняется.
  const username = typeof body.username === "string"
    ? body.username.trim()
    : "";
  if (username) {
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      return send(res, 401, {
        ok: false,
        error: "Неверный логин или пароль"
      });
    }
    try {
      const result = await supabaseRequest(
        `daradar_users?username=eq.${encodeURIComponent(username)}&select=id,username,display_name,password_hash,role,active`
      );
      const user = result && result[0];
      if (
        !user ||
        user.active !== true ||
        !verifyPassword(password, user.password_hash)
      ) {
        logEvent("login_failed", null);
        return send(res, 401, {
          ok: false,
          error: "Неверный логин или пароль"
        });
      }
      const role = user.role === "admin" ? "admin" : "user";
      const id = `sb_${user.id}`;
      const token = createSession(
        id,
        user.display_name,
        role
      );
      res.setHeader(
        "Set-Cookie",
        cookieHeader(token, SESSION_HOURS * 60 * 60)
      );
      logEvent("login_success", id);
      return send(res, 200, {
        ok: true,
        authenticated: true,
        user: {
          id,
          name: user.display_name,
          role
        },
        expiresAt: Date.now() +
          SESSION_HOURS * 60 * 60 * 1000
      });
    } catch {
      return send(res, 503, {
        ok: false,
        error: "Сервис авторизации Supabase временно недоступен"
      });
    }
  }
  // Проверка паролей из переменных U1 — U20.
  const allUsers = users();
  for (const [id, user] of Object.entries(allUsers)) {
    if (
      user.active === true &&
      safeEqual(password, user.password)
    ) {
      const token = createSession(id, user.name, "user");
      res.setHeader(
        "Set-Cookie",
        cookieHeader(token, SESSION_HOURS * 60 * 60)
      );
      logEvent("login_success", id);
      return send(res, 200, {
        ok: true,
        authenticated: true,
        user: {
          id,
          name: user.name,
          role: "user"
        },
        expiresAt: Date.now() +
          SESSION_HOURS * 60 * 60 * 1000
      });
    }
  }
  logEvent("login_failed", null);
  return send(res, 401, {
    ok: false,
    error: "Неверный логин или пароль"
  });
};
