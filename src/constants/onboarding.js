import { generateId } from "../utils/helpers";

// Life areas offered in the first-run wizard. Each carries everything the
// starter-board generator needs: a sticker, an accent color, a pale note
// background, and an evidence-flavored prompt (process goals beat outcome
// goals — so every prompt models that reframe).
export const LIFE_AREAS = [
  {
    id: "health",
    label: "Health",
    sticker: "💪",
    color: "#10b981",
    noteBg: "#dcfce7",
    prompt: "Health: what's one process goal? \"Walk after lunch\" beats \"lose 10 lbs\" — schedule the action, not the outcome.",
  },
  {
    id: "career",
    label: "Career",
    sticker: "💼",
    color: "#3b82f6",
    noteBg: "#dbeafe",
    prompt: "Career: name the next visible step. \"Ship the demo by Friday\" beats \"get promoted\" — momentum comes from finished things.",
  },
  {
    id: "learning",
    label: "Learning",
    sticker: "📚",
    color: "#8b5cf6",
    noteBg: "#ede9fe",
    prompt: "Learning: \"20 minutes of the course before email\" beats \"learn Spanish\" — attach the habit to a moment you already have.",
  },
  {
    id: "relationships",
    label: "Relationships",
    sticker: "💞",
    color: "#ec4899",
    noteBg: "#fce7f3",
    prompt: "Relationships: \"Call Mom on my Sunday walk\" beats \"be more present\" — put the person on the calendar, not the intention.",
  },
  {
    id: "money",
    label: "Money",
    sticker: "💰",
    color: "#f59e0b",
    noteBg: "#fef3c7",
    prompt: "Money: \"Auto-transfer $50 every payday\" beats \"save more\" — automate the behavior so willpower isn't in the loop.",
  },
  {
    id: "travel",
    label: "Travel",
    sticker: "✈️",
    color: "#0ea5e9",
    noteBg: "#e0f2fe",
    prompt: "Travel: \"Price flights this Saturday\" beats \"see the world\" — a trip becomes real one booking step at a time.",
  },
  {
    id: "creativity",
    label: "Creativity",
    sticker: "🎨",
    color: "#f97316",
    noteBg: "#ffedd5",
    prompt: "Creativity: \"One rough sketch before bed\" beats \"become an artist\" — volume first, quality follows.",
  },
  {
    id: "wellness",
    label: "Wellness",
    sticker: "🌿",
    color: "#06b6d4",
    noteBg: "#ccfbf1",
    prompt: "Wellness: \"Lights out by 11\" beats \"get healthier\" — pick a cue you control and let the rest compound.",
  },
];

// Cluster geometry: each chosen area becomes a left-to-right column with
// breathing room — header on top, sticker beside it, prompt note below,
// and (first area only) a habit tracker pre-titled to that area.
const CLUSTER_SPACING = 440;
const CLUSTER_X0 = 80;

export const buildStarterBoard = (areaIds) => {
  const areas = areaIds.map((id) => LIFE_AREAS.find((a) => a.id === id)).filter(Boolean);
  const items = [];
  areas.forEach((area, i) => {
    const x0 = CLUSTER_X0 + i * CLUSTER_SPACING;
    items.push({
      id: generateId(),
      type: "text",
      content: area.label.toUpperCase(),
      x: x0,
      y: 40,
      width: 320,
      height: 64,
      font: "font-serif",
      color: area.color,
      rotation: 0,
      zIndex: 1,
    });
    items.push({
      id: generateId(),
      type: "sticker",
      content: area.sticker,
      x: x0 + 244,
      y: 130,
      width: 80,
      height: 80,
      rotation: (i % 2 === 0 ? 1 : -1) * 8,
      zIndex: 2,
    });
    items.push({
      id: generateId(),
      type: "note",
      content: area.prompt,
      x: x0,
      y: 130,
      width: 224,
      height: 216,
      backgroundColor: area.noteBg,
      rotation: 0,
      zIndex: 1,
    });
    if (i === 0) {
      items.push({
        id: generateId(),
        type: "tracker",
        title: area.label,
        content: "{}",
        x: x0,
        y: 390,
        width: 280,
        height: 340,
        color: area.color,
        marker: "check",
        rotation: 0,
        zIndex: 1,
      });
    }
  });
  return items;
};
