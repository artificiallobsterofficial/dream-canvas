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

export const calculateStreak = (content) => {
  let td = {};
  try {
    td = JSON.parse(safeContent(content) || "{}");
  } catch {
    return 0;
  }
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const st = normalizeDayData(td[todayKey(d)]).status;
    if (st === "done") streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
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
