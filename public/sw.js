/* DreamCanvas service worker: offline caching + background habit reminders. */
const CACHE = "dreamcanvas-v1";
const DB_NAME = "dreamcanvas_backups";
const DB_VERSION = 2;

self.addEventListener("install", (e) => {
  // Precache the app shell so the offline navigation fallback always exists.
  e.waitUntil(caches.open(CACHE).then((c) => c.add("./index.html")).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // The update check must always hit the network — never serve it from cache.
  if (url.pathname.endsWith("/version.json")) return;

  // Navigations: network-first so deploys land immediately; cache fallback offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // Never cache error pages — a deploy-window 404 must not become the shell.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(e.request, { ignoreSearch: true })
            .then((m) => m || caches.match("./index.html"))
        )
    );
    return;
  }

  // Assets: stale-while-revalidate (hashed filenames make staleness harmless).
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});

// ─── Background reminder (periodic sync; Chrome/Android installed PWAs) ───
// The page mirrors reminder state into IndexedDB because the SW can't read
// localStorage. Stale data means "user hasn't opened the app today" — which
// is exactly when a reminder matters.

const readReminderMeta = () =>
  new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) {
          db.close();
          resolve(null);
          return;
        }
        const r = db.transaction("meta", "readonly").objectStore("meta").get("reminder");
        r.onsuccess = () => {
          db.close();
          resolve(r.result || null);
        };
        r.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

// Read-merge-write inside ONE transaction so we can't clobber concurrent page writes.
const mergeReminderMeta = (partial) =>
  new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction("meta", "readwrite");
        const store = t.objectStore("meta");
        const r = store.get("reminder");
        r.onsuccess = () => store.put({ ...(r.result || {}), ...partial, id: "reminder" });
        t.oncomplete = () => {
          db.close();
          resolve();
        };
        t.onerror = () => {
          db.close();
          resolve();
        };
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function checkReminder() {
  const meta = await readReminderMeta();
  if (!meta || !meta.enabled || !meta.time) return;
  const today = localDateKey();
  if (meta.lastNotifiedDay === today) return;
  // Habits already all done today (page told us) — nothing to nag about.
  if (meta.dateStamp === today && meta.allDone) return;
  const [hh, mm] = meta.time.split(":").map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;
  await self.registration.showNotification("DreamCanvas ✨", {
    body: "Your habits are waiting — even one counts. Never miss twice!",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: "habit-reminder",
  });
  await mergeReminderMeta({ lastNotifiedDay: today });
}

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "habit-reminder") e.waitUntil(checkReminder());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => "focus" in w);
      return win ? win.focus() : self.clients.openWindow("./");
    })
  );
});
