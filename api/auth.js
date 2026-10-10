const crypto = require("crypto");

const SESSION_HOURS = 12;
const COOKIE_NAME = "daradar_session";

function secret() {
  return process.env.AUTH_SECRET || "";
}

function users() {
  try {
    return JSON.parse(process.env.DARADAR_USERS_JSON || "{}");
  } catch {
    return {};
  }
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

function createSession(id) {
  const payload = Buffer.from(JSON.stringify({
    id,
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

    const user = users()[data.id];

    if (!user || user.active !== true) return null;

    return {
      id: data.id,
      name: user.name || data.id,
      exp: data.exp
    };
  } catch {
    return null;
  }
}

function cookieHeader(value, maxAge) {
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ].join("; ");
}

function logEvent(event, id) {
  console.log(JSON.stringify({
    event,
    userId: id || null,
    time: new Date().toISOString()
  }));
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!secret() || secret().length < 32) {
    return res.status(500).json({
      ok: false,
      error: "AUTH_SECRET не настроен или слишком короткий"
    });
  }

  const cookies = Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        return [
          part.slice(0, index),
          part.slice(index + 1)
        ];
      })
  );

  if (req.method === "GET") {
    const session = readSession(cookies[COOKIE_NAME]);

    if (!session) {
      return res.status(200).json({
        ok: true,
        authenticated: false
      });
    }

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: {
        id: session.id,
        name: session.name
      },
      expiresAt: session.exp
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
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

    return res.status(200).json({
      ok: true,
      authenticated: false
    });
  }

  if (body.action !== "login" || typeof body.password !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Некорректный запрос"
    });
  }

  const password = body.password;
  const allUsers = users();

  for (const [id, user] of Object.entries(allUsers)) {
    if (
      user &&
      user.active === true &&
      typeof user.password === "string" &&
      safeEqual(password, user.password)
    ) {
      const token = createSession(id);

      logEvent("login_success", id);

      res.setHeader(
        "Set-Cookie",
        cookieHeader(token, SESSION_HOURS * 60 * 60)
      );

      return res.status(200).json({
        ok: true,
        authenticated: true,
        user: {
          id,
          name: user.name || id
        },
        expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000
      });
    }
  }

  logEvent("login_failed", null);

  return res.status(401).json({
    ok: false,
    error: "Неверный пароль"
  });
};
