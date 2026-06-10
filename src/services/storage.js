const KEY = "vision_board_v3_5_db";
const DB_NAME = "dreamcanvas_backups";
const DB_VERSION = 2; // v2 adds the "meta" store (reminder mirror for the SW)
const STORE = "snapshots";
const MAX_SNAPSHOTS = 20;

export const StorageService = {
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return { success: true };
    } catch (e) {
      console.error("Save failed (storage may be full):", e);
      return { success: false };
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

// ─── Snapshot layer (IndexedDB) ───
// Rolling backups that survive accidental clears of the main board state.
// Snapshots are taken daily and before destructive operations.

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = (db, mode, fn) =>
  new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out?.result !== undefined ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });

export const SnapshotService = {
  // reason: "daily" | "before-clear" | "before-import" | "before-template"
  async take(data, reason) {
    try {
      if (!data?.items?.length) return; // nothing worth backing up
      const db = await openDb();
      const all = await new Promise((res, rej) => {
        const r = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      // At most one daily snapshot per calendar day.
      if (reason === "daily") {
        const today = new Date().toDateString();
        if (all.some((s) => s.reason === "daily" && new Date(s.ts).toDateString() === today)) {
          db.close();
          return;
        }
      }
      await tx(db, "readwrite", (store) => {
        store.add({ ts: Date.now(), reason, itemCount: data.items.length, data });
        // Prune oldest beyond the cap (all is pre-add, so allow MAX-1 existing).
        const excess = all.length - (MAX_SNAPSHOTS - 1);
        if (excess > 0) {
          all
            .sort((a, b) => a.ts - b.ts)
            .slice(0, excess)
            .forEach((s) => store.delete(s.id));
        }
      });
      db.close();
    } catch (e) {
      console.error("Snapshot failed:", e);
    }
  },

  async list() {
    try {
      const db = await openDb();
      const all = await new Promise((res, rej) => {
        const r = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      db.close();
      return all.sort((a, b) => b.ts - a.ts).map(({ id, ts, reason, itemCount }) => ({ id, ts, reason, itemCount }));
    } catch {
      return [];
    }
  },

  async get(id) {
    try {
      const db = await openDb();
      const snap = await new Promise((res, rej) => {
        const r = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      db.close();
      return snap?.data ?? null;
    } catch {
      return null;
    }
  },
};

// Small key-value records shared with the service worker (which cannot read
// localStorage). Currently holds the reminder mirror.
export const MetaService = {
  async set(id, value) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const t = db.transaction("meta", "readwrite");
        t.objectStore("meta").put({ ...value, id });
        t.oncomplete = resolve;
        t.onerror = () => reject(t.error);
      });
      db.close();
    } catch (e) {
      console.error("Meta write failed:", e);
    }
  },
  async get(id) {
    try {
      const db = await openDb();
      const val = await new Promise((resolve, reject) => {
        const r = db.transaction("meta", "readonly").objectStore("meta").get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return val;
    } catch {
      return null;
    }
  },
  // Read-merge-write in a single transaction — concurrent writers (the SW, the
  // reminder interval, the auto-save mirror) can't clobber each other's fields.
  async merge(id, partial) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const t = db.transaction("meta", "readwrite");
        const store = t.objectStore("meta");
        const r = store.get(id);
        r.onsuccess = () => store.put({ ...(r.result || {}), ...partial, id });
        t.oncomplete = resolve;
        t.onerror = () => reject(t.error);
      });
      db.close();
    } catch (e) {
      console.error("Meta merge failed:", e);
    }
  },
};

// Ask the browser not to evict our storage under pressure. Best-effort:
// Chrome grants based on engagement, Safari/Firefox may prompt or ignore.
export const requestPersistence = async () => {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch {
    /* non-fatal */
  }
};
