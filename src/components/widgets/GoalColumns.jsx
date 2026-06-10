import { CheckCircle2, Calendar, Star } from "lucide-react";

const GoalColumns = ({ item, zenMode, onUpdate }) => {
  let goals = { short: "", medium: "", long: "" };
  try {
    goals = { ...goals, ...JSON.parse(item.content || "{}") };
  } catch {}
  const updateGoalSection = (section, text) => onUpdate(item.id, { content: JSON.stringify({ ...goals, [section]: text }) });

  return (
    <div className="flex h-full gap-1 select-none text-gray-800">
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
            onChange={(e) => updateGoalSection(type, e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
      ))}
    </div>
  );
};

export default GoalColumns;
