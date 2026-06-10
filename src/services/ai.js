import Anthropic from "@anthropic-ai/sdk";

const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
const anthropicModel = import.meta.env.VITE_ANTHROPIC_MODEL || "claude-opus-4-8";
const geminiModel = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

const DEFAULT_SYSTEM =
  "You are a warm, aesthetic-focused Vision Board Coach. Keep responses concise (under 150 words). Focus on feelings, not just things.";

// This app runs entirely in the browser, so the key is exposed to whoever runs it.
// Acceptable for personal/local use only — see .env.example.
const anthropic = anthropicKey
  ? new Anthropic({ apiKey: anthropicKey, dangerouslyAllowBrowser: true })
  : null;

const callAnthropic = async (prompt, systemPrompt) => {
  const res = await anthropic.messages.create({
    model: anthropicModel,
    max_tokens: 1000,
    system: systemPrompt || DEFAULT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content.find((b) => b.type === "text");
  return block ? block.text : null;
};

const callGemini = async (prompt, systemPrompt) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
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

export const aiProvider = anthropic ? "claude" : geminiKey ? "gemini" : null;

// Returns the model's text, or null on any failure — callers all have local fallbacks.
export const callAI = async (prompt, systemPrompt) => {
  try {
    if (anthropic) return await callAnthropic(prompt, systemPrompt);
    if (geminiKey) return await callGemini(prompt, systemPrompt);
    return null;
  } catch (e) {
    console.error("AI error:", e);
    return null;
  }
};
