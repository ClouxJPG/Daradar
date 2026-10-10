const crypto = require("crypto");

const COOKIE_NAME = "daradar_session";

function send(res, status, data) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(data);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));

  return x.length === y.length &&
    crypto.timingSafeEqual(x, y);
}

function verifyAdminSession(req) {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) return false;

  const cookies = {};

  for (const part of (req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");

    if (index < 0) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  const token = cookies[COOKIE_NAME];
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (!safeEqual(signature, expected)) return false;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    // Старая авторизация не содержит подтверждённой роли admin.
    // Поэтому обычный пользователь не может вызвать админские операции.
    return (
      session.id === "__admin__" &&
      session.role === "admin" &&
      Number(session.exp) > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

function validateUsername(value) {
  return typeof value === "string" &&
    /^[a-zA-Z0-9_.-]{3,32}$/.test(value);
}

function makePasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(
    password,
    Buffer.from(salt, "hex"),
    64
  ).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

async function supabase(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  const response = await fetch(
    `${url.replace(/\/+$/, "")}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  if (!response.ok) {
    const error = new Error("Supabase request failed");
    error.status = response.status;
    throw error;
  }

  return text ? JSON.parse(text) : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed" });
  }

  if (!verifyAdminSession(req)) {
    return send(res, 401, {
      error: "Доступ только для администратора"
    });
  }

  if (req.method === "GET") {
    try {
      const users = await supabase(
        "daradar_users?select=id,username,display_name,role,active,created_at&order=created_at.desc"
      );

      return send(res, 200, {
        ok: true,
        users: users || []
      });
    } catch {
      return send(res, 503, {
        error: "Не удалось загрузить пользователей из Supabase"
      });
    }
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

  try {
    if (body.action === "create") {
      const username = typeof body.username === "string"
        ? body.username.trim()
        : "";

      const displayName = typeof body.display_name === "string"
        ? body.display_name.trim()
        : "";

      const password = typeof body.password === "string"
        ? body.password
        : "";

      if (!validateUsername(username)) {
        return send(res, 400, {
          error: "Логин: 3–32 символа, латинские буквы, цифры, точка, дефис или подчёркивание"
        });
      }

      if (!displayName || displayName.length > 80) {
        return send(res, 400, {
          error: "Укажи имя длиной от 1 до 80 символов"
        });
      }

      if (password.length < 10 || password.length > 256) {
        return send(res, 400, {
          error: "Пароль должен содержать от 10 до 256 символов"
        });
      }

      const role = body.role === "admin" ? "admin" : "user";

      const created = await supabase("daradar_users", {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          username,
          display_name: displayName,
          password_hash: makePasswordHash(password),
          role,
          active: true
        })
      });

      return send(res, 201, {
        ok: true,
        user: created && created[0]
          ? {
              id: created[0].id,
              username: created[0].username,
              display_name: created[0].display_name,
              role: created[0].role,
              active: created[0].active
            }
          : null
      });
    }

    if (body.action === "set-active") {
      const id = Number(body.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return send(res, 400, { error: "Некорректный ID пользователя" });
      }

      if (typeof body.active !== "boolean") {
        return send(res, 400, { error: "Поле active должно быть true или false" });
      }

      const updated = await supabase(
        `daradar_users?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            active: body.active
          })
        }
      );

      if (!updated || updated.length === 0) {
        return send(res, 404, { error: "Пользователь не найден" });
      }

      return send(res, 200, {
        ok: true,
        user: updated[0]
      });
    }

    return send(res, 400, {
      error: "Неизвестное действие"
    });
  } catch (error) {
    if (error.status === 409) {
      return send(res, 409, {
        error: "Такой логин уже существует"
      });
    }

    return send(res, 503, {
      error: "Ошибка Supabase. Проверь настройки и таблицу daradar_users."
    });
  }
};
