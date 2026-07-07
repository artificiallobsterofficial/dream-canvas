import { Sprout, Flame, Zap, Trophy, Snowflake, Shield, PenLine, Star } from "lucide-react";
import { calculateStreak, hasEverUsedFreeze, normalizeDayData, safeContent, todayKey } from "../utils/helpers";

const trackers = (items) => items.filter((i) => i.type === "tracker");
const anyDoneDay = (items) =>
  trackers(items).some((t) => {
    try {
      const td = JSON.parse(safeContent(t.content) || "{}");
      return Object.values(td).some((v) => normalizeDayData(v).status === "done");
    } catch {
      return false;
    }
  });
const bestStreak = (items) => Math.max(0, ...trackers(items).map((t) => calculateStreak(t.content)));

// Achievements are derived live from board data — they recognize what the user
// actually did, rather than being purchased with XP.
// `icon` is a lucide-react component; `iconColor` tints it when unlocked.
export const ACHIEVEMENTS = [
  { id: "first-step", icon: Sprout, iconColor: "text-emerald-500", title: "First Step", desc: "Mark a habit done for the first time", test: (items) => anyDoneDay(items) },
  { id: "streak-3", icon: Flame, iconColor: "text-orange-500", title: "On a Roll", desc: "Reach a 3-day streak", test: (items) => bestStreak(items) >= 3 },
  { id: "streak-7", icon: Zap, iconColor: "text-yellow-500", title: "Week Strong", desc: "Reach a 7-day streak", test: (items) => bestStreak(items) >= 7 },
  { id: "streak-30", icon: Trophy, iconColor: "text-amber-500", title: "Habit Formed", desc: "Reach a 30-day streak", test: (items) => bestStreak(items) >= 30 },
  { id: "freeze", icon: Snowflake, iconColor: "text-sky-500", title: "Never Missed Twice", desc: "Come back the day after a miss", test: (items) => trackers(items).some((t) => hasEverUsedFreeze(t.content)) },
  { id: "planner", icon: Shield, iconColor: "text-indigo-500", title: "If-Then Planner", desc: "Write an obstacle and an if-then plan", test: (items) => items.some((i) => { if (i.type !== "goals") return false; try { const g = JSON.parse(i.content || "{}"); return !!(g.obstacle?.trim() && g.plan?.trim()); } catch { return false; } }) },
  { id: "reflector", icon: PenLine, iconColor: "text-purple-500", title: "Reflector", desc: "Write a journal entry", test: (items) => items.some((i) => i.type === "journal" && safeContent(i.content).trim().length >= 30) },
  { id: "perfect-day", icon: Star, iconColor: "text-yellow-500", title: "Perfect Day", desc: "Complete every habit in one day (2+ habits)", test: (items) => { const ts = trackers(items); if (ts.length < 2) return false; const key = todayKey(); return ts.every((t) => { try { return normalizeDayData(JSON.parse(safeContent(t.content) || "{}")[key]).status === "done"; } catch { return false; } }); } },
];
