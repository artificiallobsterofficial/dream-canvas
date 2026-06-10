export const TEMPLATES = {
  wellness: {
    name: "That Girl / Wellness",
    items: [
      { type: "tracker", title: "Hydration", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#06b6d4", marker: "heart", zIndex: 1 },
      { type: "tracker", title: "Yoga / Movement", x: 400, y: 80, width: 280, height: 350, content: "{}", color: "#ec4899", marker: "fire", zIndex: 1 },
      { type: "note", content: "My body is a temple.\nI nourish myself with good food and positive thoughts.", x: 80, y: 460, width: 200, height: 200, backgroundColor: "#dcfce7", zIndex: 1 },
      { type: "text", content: "GLOW UP ERA", x: 350, y: 30, width: 400, height: 80, font: "font-serif", color: "#ec4899", zIndex: 1 },
      { type: "sticker", content: "🌿", x: 600, y: 400, width: 80, height: 80, zIndex: 2 },
    ],
    config: { backgroundColor: "#fdf2f8" },
  },
  founder: {
    name: "Tech Founder",
    items: [
      { type: "tracker", title: "Deep Work (4h)", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#3b82f6", marker: "check", zIndex: 1 },
      { type: "goals", content: '{"short":"- Launch MVP\\n- Get 10 users","medium":"- Product Hunt","long":"- $10k MRR","obstacle":"I open social media \\"for research\\" and lose an hour","plan":"close the tab and write one line of code first"}', x: 400, y: 80, width: 500, height: 340, zIndex: 1 },
      { type: "text", content: "BUILD. SHIP. REPEAT.", x: 350, y: 10, width: 500, height: 70, font: "font-mono", color: "#111827", zIndex: 1 },
    ],
    config: { backgroundColor: "#ffffff" },
  },
  student: {
    name: "4.0 Student",
    items: [
      { type: "tracker", title: "Study Session (2h)", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#8b5cf6", marker: "check", zIndex: 1 },
      { type: "goals", content: '{"short":"- Finish History Paper\\n- Math HW","medium":"- Ace Midterms","long":"- Dream College"}', x: 400, y: 80, width: 500, height: 300, zIndex: 1 },
      { type: "text", content: "KNOWLEDGE IS POWER", x: 300, y: 20, width: 400, height: 70, font: "font-sans", color: "#8b5cf6", zIndex: 1 },
    ],
    config: { backgroundColor: "#f5f3ff" },
  },
  travel: {
    name: "Wanderlust",
    items: [
      { type: "goals", content: '{"short":"- Save $500\\n- Book Flights","medium":"- Japan Trip","long":"- Visit 30 Countries"}', x: 80, y: 80, width: 500, height: 300, zIndex: 1 },
      { type: "note", content: "Packing List:\n- Camera\n- Passport\n- Adapter", x: 620, y: 80, width: 200, height: 250, backgroundColor: "#dbeafe", zIndex: 1 },
      { type: "text", content: "ADVENTURE AWAITS", x: 200, y: 10, width: 500, height: 70, font: "font-sans", color: "#0ea5e9", zIndex: 1 },
      { type: "sticker", content: "✈️", x: 50, y: 20, width: 80, height: 80, zIndex: 2 },
    ],
    config: { backgroundColor: "#f0f9ff" },
  },
  fitness: {
    name: "Iron Body",
    items: [
      { type: "tracker", title: "Gym Session", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#ef4444", marker: "gym", zIndex: 1 },
      { type: "note", content: "Macros:\nProtein: 180g\nCarbs: 200g\nFats: 60g", x: 400, y: 80, width: 250, height: 250, backgroundColor: "#fee2e2", zIndex: 1 },
      { type: "text", content: "NO PAIN NO GAIN", x: 400, y: 360, width: 400, height: 70, font: "font-mono", color: "#dc2626", zIndex: 1 },
    ],
    config: { backgroundColor: "#fef2f2" },
  },
};
