// DreamCanvas API — a single small Worker behind the static GitHub Pages app.
// Endpoints:
//   POST /api/ai              { prompt, system } -> { text }   (Anthropic key stays server-side)
//   POST /api/feedback        { message, contact?, version? } -> { ok }
//   GET  /api/feedback        Bearer ADMIN_TOKEN -> { entries: [...] }
//   PUT  /api/backup/:code    board JSON -> { ok, savedAt }
//   GET  /api/backup/:code    -> board JSON (+ x-saved-at header)
//
// All state lives in KV (binding DC_KV). No accounts, no cookies: backups are
// addressed by a client-generated random sync code, which is the secret.

const JSON_HEADERS = { "content-type": "application/json" };

const MAX_PROMPT_CHARS = 8000;
const MAX_FEEDBACK_CHARS = 2000;
const MAX_BACKUP_BYTES = 2 * 1024 * 1024; // matches the app's localStorage-scale boards
const SYNC_CODE_RE = /^[A-Za-z0-9-]{16,64}$/;

// Per-IP daily caps. KV counters are eventually consistent, so treat these as
// coarse abuse brakes, not billing-grade metering.
const LIMITS = { ai: 50, feedback: 10, backupWrite: 30 };

const corsHeaders = (origin, env) => {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok =
    origin &&
    (allowed.includes(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin));
  return {
    "access-control-allow-origin": ok ? origin : allowed[0] || "",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
};

const json = (body, status, extraHeaders = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });

// Returns null when under the limit, or a 429 Response when over it.
const rateLimit = async (env, bucket, ip, cap) => {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:${bucket}:${ip}:${day}`;
  const n = parseInt((await env.DC_KV.get(key)) || "0", 10);
  if (n >= cap) return json({ error: "rate_limited" }, 429);
  await env.DC_KV.put(key, String(n + 1), { expirationTtl: 172800 });
  return null;
};

const handleAi = async (request, env, ip) => {
  const limited = await rateLimit(env, "ai", ip, LIMITS.ai);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, MAX_PROMPT_CHARS) : "";
  const system = typeof body.system === "string" ? body.system.slice(0, MAX_PROMPT_CHARS) : undefined;
  if (!prompt.trim()) return json({ error: "empty_prompt" }, 400);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    // Don't leak provider error bodies (they can include key hints) — status is enough.
    return json({ error: "upstream_error", status: res.status }, 502);
  }
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "text");
  return json({ text: block ? block.text : null }, 200);
};

const handleFeedbackPost = async (request, env, ip) => {
  const limited = await rateLimit(env, "feedback", ip, LIMITS.feedback);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_FEEDBACK_CHARS) : "";
  if (!message) return json({ error: "empty_message" }, 400);

  const entry = {
    message,
    contact: typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "",
    version: typeof body.version === "string" ? body.version.slice(0, 40) : "",
    ua: (request.headers.get("user-agent") || "").slice(0, 200),
    ts: new Date().toISOString(),
  };
  const key = `fb:${entry.ts}:${crypto.randomUUID().slice(0, 8)}`;
  await env.DC_KV.put(key, JSON.stringify(entry));
  return json({ ok: true }, 200);
};

const handleFeedbackList = async (request, env) => {
  const auth = request.headers.get("authorization") || "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: "unauthorized" }, 401);
  }
  const list = await env.DC_KV.list({ prefix: "fb:", limit: 1000 });
  const entries = await Promise.all(
    list.keys.map(async (k) => {
      try {
        return JSON.parse(await env.DC_KV.get(k.name));
      } catch {
        return null;
      }
    })
  );
  return json({ entries: entries.filter(Boolean).sort((a, b) => (a.ts < b.ts ? 1 : -1)) }, 200);
};

const handleBackup = async (request, env, ip, code) => {
  if (!SYNC_CODE_RE.test(code)) return json({ error: "bad_code" }, 400);
  const key = `bk:${code}`;

  if (request.method === "GET") {
    const stored = await env.DC_KV.get(key);
    if (!stored) return json({ error: "not_found" }, 404);
    const { savedAt, data } = JSON.parse(stored);
    return json(data, 200, { "x-saved-at": savedAt });
  }

  // PUT
  const limited = await rateLimit(env, "backupWrite", ip, LIMITS.backupWrite);
  if (limited) return limited;
  const raw = await request.text();
  if (raw.length > MAX_BACKUP_BYTES) return json({ error: "too_large" }, 413);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!Array.isArray(data.items)) return json({ error: "not_a_board" }, 400);
  const savedAt = new Date().toISOString();
  await env.DC_KV.put(key, JSON.stringify({ savedAt, data }));
  return json({ ok: true, savedAt }, 200);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    let res;
    try {
      if (url.pathname === "/api/ai" && request.method === "POST") {
        res = await handleAi(request, env, ip);
      } else if (url.pathname === "/api/feedback" && request.method === "POST") {
        res = await handleFeedbackPost(request, env, ip);
      } else if (url.pathname === "/api/feedback" && request.method === "GET") {
        res = await handleFeedbackList(request, env);
      } else if (url.pathname.startsWith("/api/backup/") && ["GET", "PUT"].includes(request.method)) {
        res = await handleBackup(request, env, ip, url.pathname.slice("/api/backup/".length));
      } else {
        res = json({ error: "not_found" }, 404);
      }
    } catch (e) {
      res = json({ error: "internal", detail: String(e && e.message).slice(0, 200) }, 500);
    }

    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};
