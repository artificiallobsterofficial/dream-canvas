// Client for the DreamCanvas API worker (worker/ in this repo) — the optional
// serverless backend behind the static app. Everything here is proxy-gated:
// when VITE_AI_PROXY_URL isn't baked into the build, callers see null/false
// and the app behaves exactly like the pure-static version.

const SYNC_CODE_STORAGE_KEY = "dreamcanvas_sync_code";

export const getProxyUrl = () => {
  const url = (import.meta.env.VITE_AI_PROXY_URL || "").trim();
  return url ? url.replace(/\/+$/, "") : null;
};

export const hasProxy = () => !!getProxyUrl();

// ─── AI via proxy ───
// Same contract as the direct providers in ai.js: text or null, never throws.
export const proxyAI = async (prompt, systemPrompt) => {
  const base = getProxyUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, system: systemPrompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
  } catch (e) {
    console.error("Proxy AI error:", e);
    return null;
  }
};

// ─── Tester feedback ───
export const sendFeedback = async ({ message, contact }) => {
  const base = getProxyUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, contact, version: __APP_VERSION__ }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

// ─── Cloud backup by sync code ───
// The code is the secret: 20 random base32 chars (~100 bits), generated
// client-side, stored per-browser. Anyone with the code can read/write that
// backup — treat it like a password.

export const getSyncCode = () => {
  try {
    return localStorage.getItem(SYNC_CODE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export const setSyncCode = (code) => {
  try {
    const c = (code || "").trim();
    if (c) localStorage.setItem(SYNC_CODE_STORAGE_KEY, c);
    else localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
  } catch {}
};

// Crockford-ish base32 (no 0/O/1/I lookalikes), grouped for readability.
export const generateSyncCode = () => {
  const alphabet = "abcdefghjkmnpqrstvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join("")).join("-");
};

export const isValidSyncCode = (code) => /^[A-Za-z0-9-]{16,64}$/.test((code || "").trim());

export const saveCloudBackup = async (code, data) => {
  const base = getProxyUrl();
  if (!base) return { ok: false, error: "no_proxy" };
  try {
    const res = await fetch(`${base}/api/backup/${encodeURIComponent(code.trim())}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, savedAt: body.savedAt } : { ok: false, error: body.error || String(res.status) };
  } catch {
    return { ok: false, error: "network" };
  }
};

export const loadCloudBackup = async (code) => {
  const base = getProxyUrl();
  if (!base) return { ok: false, error: "no_proxy" };
  try {
    const res = await fetch(`${base}/api/backup/${encodeURIComponent(code.trim())}`);
    if (res.status === 404) return { ok: false, error: "not_found" };
    if (!res.ok) return { ok: false, error: String(res.status) };
    const data = await res.json();
    return { ok: true, data, savedAt: res.headers.get("x-saved-at") };
  } catch {
    return { ok: false, error: "network" };
  }
};
