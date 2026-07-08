import { Flower2, Sprout } from "lucide-react";

// Purple / pink / emerald tints — mid-tone so they read on both light and dark canvases.
const TINTS = ["#a855f7", "#ec4899", "#10b981", "#c084fc", "#f472b6", "#34d399"];
const MAX_VISIBLE = 20;

// Deterministic per-index jitter so the garden doesn't reshuffle on every render.
const jitter = (i, salt) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x); // 0..1
};

// The "garden": one glyph per resolved bloom, planted along the bottom edge of
// the home-zone frame. Positive-only — it only ever grows, never decays.
export default function BloomGarden({ count, zone }) {
  if (!count || !zone) return null;
  const visible = Math.min(count, MAX_VISIBLE);
  const overflow = count - visible;
  return (
    <div
      className="absolute pointer-events-none flex items-end gap-1.5 flex-wrap"
      style={{ left: zone.x + 28, top: zone.y + zone.h - 38, maxWidth: zone.w - 56 }}
    >
      {Array.from({ length: visible }, (_, i) => {
        const Icon = i % 4 === 3 ? Sprout : Flower2;
        const size = 14 + Math.round(jitter(i, 1) * 10);
        const rot = Math.round(jitter(i, 2) * 30 - 15);
        return (
          <Icon
            key={i}
            size={size}
            style={{ color: TINTS[i % TINTS.length], opacity: 0.8, transform: `rotate(${rot}deg)` }}
          />
        );
      })}
      {overflow > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          ×{overflow}
        </span>
      )}
    </div>
  );
}
