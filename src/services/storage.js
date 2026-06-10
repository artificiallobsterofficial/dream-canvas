const KEY = "vision_board_v3_5_db";

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
