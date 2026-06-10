import Anthropic from "@anthropic-ai/sdk";
import { calculateStreak, isFreezeActive, normalizeDayData, safeContent, todayKey } from "../utils/helpers";

const BYOK_STORAGE_KEY = "dreamcanvas_byok";

const envAnthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY;
const anthropicModel = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-opus-4-8";
const geminiModel = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

const DEFAULT_SYSTEM =
  "You are a warm, aesthetic-focused Vision Board Coach. Keep responses concise (under 150 words). Focus on feelings, not just things.";

// ─── BYOK: user-provided key, stored only in this browser ───
export const getStoredKey = () => {
  try {
    return localStorage.getItem(BYOK_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export const setStoredKey = (key) => {
  try {
    const k = (key || "").trim();
    if (k) localStorage.setItem(BYOK_STORAGE_KEY, k);
    else localStorage.removeItem(BYOK_STORAGE_KEY);
  } catch {}
};

// Env keys (local dev) take precedence; otherwise the user's stored key.
// Provider is inferred from the key prefix: sk-ant-* → Anthropic, else Gemini.
const resolve = () => {
  if (envAnthropicKey) return { provider: "claude", key: envAnthropicKey, source: "env" };
  if (envGeminiKey) return { provider: "gemini", key: envGeminiKey, source: "env" };
  const stored = getStoredKey();
  if (stored.startsWith("sk-ant-")) return { provider: "claude", key: stored, source: "byok" };
  if (stored) return { provider: "gemini", key: stored, source: "byok" };
  return { provider: null, key: null, source: null };
};

export const getAiProvider = () => resolve().provider;
export const getAiSource = () => resolve().source;

const callAnthropic = async (key, prompt, systemPrompt) => {
  // Browser-direct call: acceptable because the key is the user's own,
  // stored in their browser — it never touches a server of ours.
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const res = await client.messages.create({
    model: anthropicModel,
    max_tokens: 1000,
    system: systemPrompt || DEFAULT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content.find((b) => b.type === "text");
  return block ? block.text : null;
};

const callGemini = async (key, prompt, systemPrompt) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt || DEFAULT_SYSTEM }] },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
};

// Returns the model's text, or null on any failure — callers all have local fallbacks.
export const callAI = async (prompt, systemPrompt) => {
  try {
    const { provider, key } = resolve();
    if (provider === "claude") return await callAnthropic(key, prompt, systemPrompt);
    if (provider === "gemini") return await callGemini(key, prompt, systemPrompt);
    return null;
  } catch (e) {
    console.error("AI error:", e);
    return null;
  }
};

// ─── Board context: a compact serialization the coach can actually use ───
export const buildBoardContext = (items, profile) => {
  const lines = [];
  const key7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return todayKey(d);
  });

  const trackers = items.filter((i) => i.type === "tracker");
  if (trackers.length) {
    lines.push("HABITS:");
    trackers.forEach((t) => {
      let td = {};
      try {
        td = JSON.parse(safeContent(t.content) || "{}");
      } catch {}
      const done7 = key7.filter((k) => normalizeDayData(td[k]).status === "done").length;
      const streak = calculateStreak(t.content);
      const frozen = isFreezeActive(t.content) ? ", freeze active (missed yesterday)" : "";
      lines.push(`- "${t.title || "Untitled"}": ${done7}/7 days this week, ${streak}-day streak${frozen}`);
    });
  }

  const goals = items.find((i) => i.type === "goals");
  if (goals) {
    try {
      const g = JSON.parse(goals.content || "{}");
      if (g.short?.trim()) lines.push(`SHORT-TERM GOALS: ${g.short.trim().replace(/\n/g, "; ")}`);
      if (g.medium?.trim()) lines.push(`MEDIUM-TERM: ${g.medium.trim().replace(/\n/g, "; ")}`);
      if (g.long?.trim()) lines.push(`LONG-TERM: ${g.long.trim().replace(/\n/g, "; ")}`);
      if (g.obstacle?.trim() || g.plan?.trim()) lines.push(`IF-THEN PLAN: obstacle="${g.obstacle?.trim() || "(none)"}" plan="${g.plan?.trim() || "(none yet)"}"`);
      else lines.push("IF-THEN PLAN: none written yet");
    } catch {}
  }

  const texts = items.filter((i) => i.type === "text").slice(0, 5);
  if (texts.length) lines.push(`BOARD STATEMENTS: ${texts.map((t) => `"${safeContent(t.content).slice(0, 60)}"`).join(", ")}`);

  const journal = items.find((i) => i.type === "journal");
  if (journal && safeContent(journal.content).trim().length > 10) {
    lines.push(`LATEST JOURNAL (excerpt): ${safeContent(journal.content).trim().slice(0, 250)}`);
  }

  if (profile) lines.push(`LEVEL: ${profile.level} (${profile.xp} XP)`);
  return lines.join("\n").slice(0, 2000);
};

export const COACH_SYSTEM_WITH_BOARD = (context) =>
  `You are a warm, evidence-minded Vision Board Coach inside the user's DreamCanvas app. You can see their actual board state below — reference it specifically (habit names, streaks, goals) instead of speaking generically. Favor process over outcome fantasy: if-then plans, small next actions, never-miss-twice framing. Keep responses under 120 words.\n\nUSER'S BOARD:\n${context || "(empty board)"}`;
