// Daradar — серверная авторизация
// Пароль и секрет хранятся только в переменных окружения Vercel.
// Не добавляй реальные пароли и секреты в этот файл.
const crypto = require("crypto");
const COOKIE_NAME = "daradar_session";
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 дней
function sign(value, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}
function safeEqual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}
function createSession(secret) {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_DURATION
    })
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}
function verifySession(token, secret) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!safeEqual(signature, sign(payload, secret))) return false;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    return Number.isFinite(data.exp) &&
      data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
function getCookies(req) {
  const result = {};
  const header = req.headers.cookie || "";
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    result[key] = value;
  }
  return result;
}
function setSessionCookie(res, value, maxAge) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}
function send(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(data);
}
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return send(res, 500, {
      ok: false,
      error: "Авторизация не настроена в Vercel"
    });
  }
  // GET: проверить действительность сессии
  if (req.method === "GET") {
    const token = getCookies(req)[COOKIE_NAME];
    return send(res, 200, {
      authenticated: verifySession(token, secret)
    });
  }
  // POST: вход или выход
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return send(res, 400, { ok: false, error: "Invalid request" });
  }
  // Выход
  if (body.action === "logout") {
    setSessionCookie(res, "", 0);
    return send(res, 200, { ok: true });
  }
  // Вход
  if (typeof body.password !== "string") {
    return send(res, 400, { ok: false, error: "Введите пароль" });
  }
  if (!safeEqual(body.password, password)) {
    return send(res, 401, { ok: false, error: "Неверный пароль" });
  }
  const token = createSession(secret);
  setSessionCookie(res, token, SESSION_DURATION);
  return send(res, 200, { ok: true });
};
