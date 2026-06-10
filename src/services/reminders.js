import { MetaService } from "./storage";
import { normalizeDayData, safeContent, todayKey } from "../utils/helpers";

const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

export const allHabitsDoneToday = (items) => {
  const trackers = items.filter((i) => i.type === "tracker");
  if (!trackers.length) return true; // nothing to remind about
  const key = todayKey();
  return trackers.every((t) => {
    try {
      return normalizeDayData(JSON.parse(safeContent(t.content) || "{}")[key]).status === "done";
    } catch {
      return false;
    }
  });
};

// Mirror reminder state into IndexedDB so the service worker (no localStorage
// access) can decide whether to nag in the background. Merge, don't overwrite —
// lastNotifiedDay belongs to whoever sent the last notification.
export const mirrorReminderState = (items, reminder) =>
  MetaService.merge("reminder", {
    enabled: !!reminder?.enabled,
    time: reminder?.time || "20:00",
    dateStamp: todayKey(),
    allDone: allHabitsDoneToday(items),
  });

// Foreground reminder check — runs on an interval while the app is open.
export const maybeNotify = async (items, reminder) => {
  if (!reminder?.enabled || !reminder.time) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (allHabitsDoneToday(items)) return;
  const today = todayKey();
  const meta = await MetaService.get("reminder");
  if (meta?.lastNotifiedDay === today) return;
  const [hh, mm] = reminder.time.split(":").map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;

  const opts = {
    body: "Your habits are waiting — even one counts. Never miss twice!",
    icon: ICON,
    tag: "habit-reminder",
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification("DreamCanvas ✨", opts);
    else new Notification("DreamCanvas ✨", opts);
  } catch (e) {
    console.error("Notification failed:", e);
  }
  await MetaService.merge("reminder", { dateStamp: today, allDone: false, lastNotifiedDay: today });
};

// Ask for permission and (best-effort) register background periodic sync.
// Background delivery only works on installed Chromium PWAs; everywhere else
// the foreground interval covers it.
export const enableReminders = async () => {
  if (typeof Notification === "undefined") return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ("periodicSync" in reg) {
      const status = await navigator.permissions.query({ name: "periodic-background-sync" });
      if (status.state === "granted") {
        await reg.periodicSync.register("habit-reminder", { minInterval: 6 * 60 * 60 * 1000 });
      }
    }
  } catch {
    /* not supported — foreground checks still work */
  }
  return "granted";
};
