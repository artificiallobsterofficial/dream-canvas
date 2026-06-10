export const generateId = () => Math.random().toString(36).substr(2, 9);

export const normalizeDayData = (val) => {
  if (!val) return { status: null, event: "" };
  if (typeof val === "object") return { status: val.status || null, event: val.event || "" };
  if (val === true) return { status: "done", event: "" };
  return { status: val, event: "" };
};

export const safeContent = (c) => {
  if (c === null || c === undefined) return "";
  if (typeof c === "string") return c;
  if (typeof c === "object") return JSON.stringify(c);
  return String(c);
};

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "Never miss twice": a single missed day is forgiven (a streak freeze);
// only two consecutive missed days end the streak. Today doesn't count as
// a miss while it's still in progress.
export const calculateStreak = (content) => {
  let td = {};
  try {
    td = JSON.parse(safeContent(content) || "{}");
  } catch {
    return 0;
  }
  const today = new Date();
  let streak = 0;
  let misses = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const st = normalizeDayData(td[todayKey(d)]).status;
    if (st === "done") {
      streak++;
      misses = 0;
    } else if (i === 0) {
      continue;
    } else {
      misses++;
      if (misses >= 2) break;
    }
  }
  return streak;
};

// True when yesterday was missed but the streak survived via never-miss-twice —
// used to tell the user a freeze saved them (and not to miss today).
export const isFreezeActive = (content) => {
  let td = {};
  try {
    td = JSON.parse(safeContent(content) || "{}");
  } catch {
    return false;
  }
  const doneOn = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return normalizeDayData(td[todayKey(d)]).status === "done";
  };
  return !doneOn(1) && doneOn(2) && calculateStreak(content) >= 1;
};

// True if any tracker ever had a done→miss→done pattern in the last 60 days,
// i.e. a streak freeze was actually used at some point.
export const hasEverUsedFreeze = (content) => {
  let td = {};
  try {
    td = JSON.parse(safeContent(content) || "{}");
  } catch {
    return false;
  }
  const doneOn = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return normalizeDayData(td[todayKey(d)]).status === "done";
  };
  for (let i = 0; i < 58; i++) {
    if (doneOn(i) && !doneOn(i + 1) && doneOn(i + 2)) return true;
  }
  return false;
};

// Downscale an image file to keep localStorage usage manageable.
// Returns a Promise<string> resolving to a data URL.
export const fileToDataUrl = (file, maxDim = 1200) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Not a valid image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 300 * 1024) {
          resolve(reader.result);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const isPng = file.type === "image/png";
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
