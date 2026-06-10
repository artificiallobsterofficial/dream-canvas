import { calculateStreak, isFreezeActive, normalizeDayData, safeContent, todayKey } from "../utils/helpers";
import { callAI, buildBoardContext, getAiProvider } from "./ai";

// Deterministic stats over the last 7 days — works with zero AI.
export const computeWeekStats = (items) => {
  const key7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return todayKey(d);
  });

  const habits = items
    .filter((i) => i.type === "tracker")
    .map((t) => {
      let td = {};
      try {
        td = JSON.parse(safeContent(t.content) || "{}");
      } catch {}
      return {
        title: t.title || "Untitled habit",
        done7: key7.filter((k) => normalizeDayData(td[k]).status === "done").length,
        streak: calculateStreak(t.content),
        frozen: isFreezeActive(t.content),
      };
    });

  let goals = null;
  const goalItem = items.find((i) => i.type === "goals");
  if (goalItem) {
    try {
      const g = JSON.parse(goalItem.content || "{}");
      goals = {
        shortCount: (g.short || "").split("\n").filter((l) => l.trim()).length,
        hasPlan: !!(g.obstacle?.trim() && g.plan?.trim()),
      };
    } catch {}
  }

  const journal = items.find((i) => i.type === "journal");
  return {
    habits,
    goals,
    journaled: !!journal && safeContent(journal.content).trim().length >= 30,
    best: habits.length ? habits.reduce((a, b) => (b.done7 > a.done7 ? b : a)) : null,
    worst: habits.length > 1 ? habits.reduce((a, b) => (b.done7 < a.done7 ? b : a)) : null,
  };
};

// Plain-language review with no AI — also the fallback when a call fails.
export const buildLocalReview = (stats) => {
  const lines = [];
  if (!stats.habits.length) {
    return "No habit trackers yet — add one in Vision mode and your weekly review will start tracking real progress. **One small habit, done most days, beats five perfect intentions.**";
  }
  lines.push("**Your week in review:**\n");
  stats.habits.forEach((h) => {
    const bar = "▰".repeat(h.done7) + "▱".repeat(7 - h.done7);
    lines.push(`${bar}  ${h.title}: ${h.done7}/7${h.streak >= 2 ? ` — 🔥 ${h.streak}-day streak` : ""}${h.frozen ? " (🧊 freeze active — do it today!)" : ""}`);
  });
  lines.push("");
  if (stats.best && stats.best.done7 >= 5) lines.push(`**Win:** "${stats.best.title}" is genuinely sticking — ${stats.best.done7}/7 days.`);
  if (stats.worst && stats.worst.done7 <= 2 && stats.worst !== stats.best)
    lines.push(`**Watch:** "${stats.worst.title}" got ${stats.worst.done7}/7. Shrink it until it's too easy to skip.`);
  if (stats.goals && !stats.goals.hasPlan)
    lines.push("**Tip:** Your goals don't have an if-then plan yet — open your goal list and fill in the obstacle + plan row. It's the single best-proven goal technique.");
  if (!stats.journaled) lines.push("**Tip:** One journal line a day sharpens the whole board.");
  return lines.join("\n");
};

// AI narration over the deterministic stats; falls back to the local review.
export const generateWeeklyReview = async (items, profile) => {
  const stats = computeWeekStats(items);
  const local = buildLocalReview(stats);
  if (!getAiProvider()) return { text: local, source: "local" };

  const context = buildBoardContext(items, profile);
  const aiText = await callAI(
    `Write my weekly review based on this data:\n\n${JSON.stringify(stats, null, 1)}\n\nFULL BOARD:\n${context}\n\nFormat: 1) one-line headline about the week, 2) the win, 3) what slipped and ONE specific suggestion tied to my if-then plan or a smaller version of the habit, 4) one encouraging closer that references my actual goals. Use **bold** sparingly. Under 160 words. No preamble.`,
    "You are a perceptive, warm habit coach reviewing a user's real weekly data. Be specific to their numbers and names; never invent data. Favor process over outcome talk."
  );
  return { text: aiText || local, source: aiText ? "ai" : "local" };
};
