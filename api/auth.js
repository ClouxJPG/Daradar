const crypto = require("crypto");

const COOKIE_NAME = "daradar_session";
const SESSION_SECONDS = 12 * 60 * 60;

function getSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  }

  return secret;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  return left.length === right.length &&
    crypto.timingSafeEqual(left, right);
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

function createSession(user) {
  const payload = {
    id: String(user.id),
    name: String(user.name),
    role: user.role === "admin" ? "admin" : "user",
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

function verifySession(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;

  if (!safeEqual(sign(encoded), signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (!payload.id || !payload.name) return null;

    if (payload.role !== "admin" && payload.role !== "user") {
      return null;
    }

    if (payload.id === "__admin__" && payload.role !== "admin") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const result = {};
  const raw = req.headers.cookie || "";

  for (const part of raw.split(";")) {
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

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", chunk => {
      size += chunk.length;

      if (size > 10000) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function getLegacyUsers() {
  try {
    const users = JSON.parse(
      process.env.DARADAR_USERS_JSON || "{}"
    );

    return users && typeof users === "object" ? users : {};
  } catch {
    return {};
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = parts[1];
  const expected = parts[2];

  if (!/^[a-f0-9]{32}$/i.test(salt)) return false;
  if (!/^[a-f0-9]{128}$/i.test(expected)) return false;

  const actual = hashPassword(password, Buffer.from(salt, "hex"));
  return safeEqual(actual, expected);
}

async function supabaseRequest(path, options = {}) {
  const baseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error("Supabase environment variables are missing");
  }

  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  return text ? JSON.parse(text) : null;
}

async function validateSession(payload) {
  if (!payload) return null;

  if (payload.id === "__admin__") {
    if (
      payload.role !== "admin" ||
      !process.env.DARADAR_ADMIN_PASSWORD
    ) {
      return null;
    }

    return payload;
  }

  if (String(payload.id).startsWith("sb_")) {
    try {
      const id = String(payload.id).slice(3);

      if (!/^\d+$/.test(id)) return null;

      const users = await supabaseRequest(
        `daradar_users?id=eq.${encodeURIComponent(id)}&select=id,username,display_name,role,active`
      );

      const user = users && users[0];

      if (!user || !user.active) return null;

      return {
        id: `sb_${user.id}`,
        name: user.display_name,
        role: user.role === "admin" ? "admin" : "user",
        exp: payload.exp
      };
    } catch {
      return null;
    }
  }

  const legacyUsers = getLegacyUsers();
  const legacy = legacyUsers[payload.id];

  if (!legacy || legacy.active === false) return null;

  return {
    id: String(payload.id),
    name: String(legacy.name || payload.name),
    role: "user",
    exp: payload.exp
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "GET") {
    try {
      const cookies = parseCookies(req);
      const session = verifySession(cookies[COOKIE_NAME]);
      const user = await validateSession(session);

      if (!user) {
        clearSessionCookie(res);
        return send(res, 200, { authenticated: false });
      }

      return send(res, 200, {
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        }
      });
    } catch {
      return send(res, 500, {
        error: "Authentication service error"
      });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  let body;

  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, { error: "Invalid request body" });
  }

  if (body.action === "logout") {
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  if (body.action !== "login") {
    return send(res, 400, { error: "Unknown action" });
  }

  const password =
    typeof body.password === "string" ? body.password : "";

  const username =
    typeof body.username === "string"
      ? body.username.trim()
      : "";

  if (!password || password.length > 1024) {
    return send(res, 400, { error: "Enter a valid password" });
  }

  try {
    const adminPassword = process.env.DARADAR_ADMIN_PASSWORD;

    if (adminPassword && safeEqual(password, adminPassword)) {
      const token = createSession({
        id: "__admin__",
        name: "Администратор",
        role: "admin"
      });

      setSessionCookie(res, token);

      return send(res, 200, {
        ok: true,
        user: {
          id: "__admin__",
          name: "Администратор",
          role: "admin"
        }
      });
    }

    if (username) {
      if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
        return send(res, 401, { error: "Неверный логин или пароль" });
      }

      const users = await supabaseRequest(
        `daradar_users?username=eq.${encodeURIComponent(username)}&select=id,username,display_name,password_hash,role,active`
      );

      const user = users && users[0];

      if (
        !user ||
        !user.active ||
        !verifyPassword(password, user.password_hash)
      ) {
        return send(res, 401, {
          error: "Неверный логин или пароль"
        });
      }

      const token = createSession({
        id: `sb_${user.id}`,
        name: user.display_name,
        role: user.role
      });

      setSessionCookie(res, token);

      return send(res, 200, {
        ok: true,
        user: {
          id: `sb_${user.id}`,
          name: user.display_name,
          role: user.role === "admin" ? "admin" : "user"
        }
      });
    }

    const legacyUsers = getLegacyUsers();

    for (const [id, user] of Object.entries(legacyUsers)) {
      if (
        user &&
        user.active !== false &&
        typeof user.password === "string" &&
        safeEqual(password, user.password)
      ) {
        const token = createSession({
          id,
          name: user.name || id,
          role: "user"
        });

        setSessionCookie(res, token);

        return send(res, 200, {
          ok: true,
          user: {
            id,
            name: user.name || id,
            role: "user"
          }
        });
      }
    }

    return send(res, 401, {
      error: "Неверный логин или пароль"
    });
  } catch (error) {
    return send(res, 503, {
      error: "Ошибка сервиса авторизации. Попробуйте позже."
    });
  }
};
