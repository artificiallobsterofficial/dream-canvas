import { CheckCircle2, Calendar, Star, Shield } from "lucide-react";

const GoalColumns = ({ item, zenMode, onUpdate }) => {
  let goals = { short: "", medium: "", long: "", obstacle: "", plan: "" };
  try {
    goals = { ...goals, ...JSON.parse(item.content || "{}") };
  } catch {}
  const updateSection = (section, text) => onUpdate(item.id, { content: JSON.stringify({ ...goals, [section]: text }) });

  return (
    <div className="flex flex-col h-full select-none text-gray-800">
      <div className="flex flex-1 gap-1 min-h-0">
        {["short", "medium", "long"].map((type, idx) => (
          <div key={type} className={`flex-1 flex flex-col min-w-0 ${idx < 2 ? "border-r border-gray-100 pr-1" : "pl-1"}`}>
            <h3
              className={`font-bold text-[10px] mb-1 uppercase tracking-wide text-center flex items-center justify-center gap-0.5 ${
                type === "short" ? "text-emerald-600" : type === "medium" ? "text-blue-600" : "text-purple-600"
              }`}
            >
              {type === "short" ? <CheckCircle2 size={10} /> : type === "medium" ? <Calendar size={10} /> : <Star size={10} />} {type}
            </h3>
            <textarea
              disabled={zenMode}
              className="flex-1 w-full bg-transparent resize-none outline-none text-xs p-1 rounded hover:bg-gray-50 focus:bg-white"
              placeholder="- Goal 1..."
              value={goals[type]}
              onChange={(e) => updateSection(type, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
      {/* WOOP: obstacle + implementation intention. Hidden in zen mode to keep boards clean. */}
      {!zenMode && (
        <div className="flex-none border-t border-gray-100 mt-1 pt-1.5">
          <h4
            className="font-bold text-[9px] uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1"
            title="If-then plans are one of the best-proven goal techniques in psychology. Name the obstacle, then decide your response in advance."
          >
            <Shield size={9} /> Obstacle &amp; If-Then Plan
          </h4>
          <div className="flex gap-1">
            <textarea
              disabled={zenMode}
              className="flex-1 h-11 bg-amber-50/60 resize-none outline-none text-[11px] p-1.5 rounded-lg border border-amber-100 focus:bg-amber-50 placeholder:text-amber-700/40"
              placeholder="What will get in the way?"
              value={goals.obstacle}
              onChange={(e) => updateSection("obstacle", e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <textarea
              disabled={zenMode}
              className="flex-1 h-11 bg-emerald-50/60 resize-none outline-none text-[11px] p-1.5 rounded-lg border border-emerald-100 focus:bg-emerald-50 placeholder:text-emerald-700/40"
              placeholder="If it happens, then I will..."
              value={goals.plan}
              onChange={(e) => updateSection("plan", e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalColumns;
