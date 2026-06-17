import { Maximize, X, Zap, Flame, PenLine, Settings } from "lucide-react";
import { calculateStreak, safeContent } from "../utils/helpers";
import TrackerCalendar from "./widgets/TrackerCalendar";
import GoalColumns from "./widgets/GoalColumns";
import CountdownWidget from "./widgets/CountdownWidget";

const BoardItem = ({ item, isSelected, onSelect, onUpdate, onDayClick, zenMode, zoom = 1, onMagicBreakdown, onOpenProps }) => {
  const streak = item.type === "tracker" ? calculateStreak(item.content) : 0;
  const showGlow = streak >= 3;
  const isSticker = item.type === "sticker";
  // Stickers are bare emoji — never give them the default white card wrapper.
  const transparent = !!item.transparent || isSticker;

  const handleResizeStart = (e) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, startW = item.width, startH = item.height;
    const onMove = (mv) =>
      onUpdate(item.id, {
        width: Math.max(60, startW + (mv.clientX - startX) / zoom),
        height: Math.max(60, startH + (mv.clientY - startY) / zoom),
      });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Panel widgets (tracker/goals/journal) support a transparent-background toggle.
  const panelBg = transparent ? "bg-transparent" : "bg-white/95 backdrop-blur-sm shadow-sm border border-white";

  return (
    <div
      className={`absolute ${zenMode ? "cursor-default" : "group cursor-move"} select-none touch-none transition-shadow ${
        isSelected && !zenMode ? "ring-2 ring-purple-500 shadow-2xl z-50" : !isSelected && !zenMode ? "hover:ring-1 hover:ring-purple-300" : ""
      }`}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex || 1, transform: `rotate(${item.rotation || 0}deg)` }}
      onPointerDown={(e) => {
        if (!zenMode && !e.target.closest(".ctrl") && !e.target.closest("textarea") && !e.target.closest("input")) onSelect(e, item);
      }}
    >
      <div
        className={`w-full h-full overflow-hidden rounded-xl ${
          transparent ? "" : "bg-white/80 backdrop-blur-sm shadow-sm border border-white/50"
        } ${showGlow && !zenMode ? "ring-4 ring-yellow-400/50 shadow-xl" : ""}`}
      >
        {item.type === "image" && <img src={item.content} alt="" className="w-full h-full object-cover rounded-lg" draggable={false} />}
        {item.type === "text" && (
          <div
            className={`w-full h-full p-2 flex items-center justify-center ${item.font || "font-sans"}`}
            style={{ color: item.color || "#000", backgroundColor: item.backgroundColor || "transparent", fontSize: `${Math.min(item.height / 2.5, item.width / 6)}px` }}
          >
            {isSelected && !zenMode ? (
              <textarea
                className="w-full h-full bg-transparent resize-none border-none outline-none text-center leading-tight"
                value={safeContent(item.content)}
                onChange={(e) => onUpdate(item.id, { content: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-center break-words leading-tight whitespace-pre-wrap font-bold">
                {safeContent(item.content)}
              </div>
            )}
          </div>
        )}
        {item.type === "note" && (
          <div className="w-full h-full p-3 shadow-md flex flex-col" style={{ backgroundColor: item.backgroundColor || "#fef3c7" }}>
            {isSelected && !zenMode ? (
              <textarea
                className="w-full h-full bg-transparent resize-none border-none outline-none text-gray-800 text-sm font-hand"
                value={safeContent(item.content)}
                onChange={(e) => onUpdate(item.id, { content: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Type your dreams..."
              />
            ) : (
              <div className="w-full h-full overflow-hidden text-gray-800 whitespace-pre-wrap text-sm font-hand">
                {safeContent(item.content) || "Empty Note"}
              </div>
            )}
          </div>
        )}
        {item.type === "tracker" && (
          <div className={`w-full h-full p-3 rounded-xl flex flex-col ${panelBg}`}>
            <TrackerCalendar item={item} zenMode={zenMode} onUpdate={onUpdate} onDayClick={onDayClick} />
          </div>
        )}
        {item.type === "goals" && (
          <div className={`w-full h-full p-3 rounded-xl flex flex-col ${panelBg}`}>
            <GoalColumns item={item} zenMode={zenMode} onUpdate={onUpdate} />
          </div>
        )}
        {item.type === "sticker" && (
          <div className="w-full h-full flex items-center justify-center pointer-events-none" style={{ fontSize: `${Math.min(item.width, item.height) * 0.8}px`, lineHeight: 1 }}>
            {safeContent(item.content)}
          </div>
        )}
        {item.type === "journal" && (
          <div className={`w-full h-full p-3 rounded-xl border-l-4 border-indigo-500 flex flex-col overflow-hidden ${transparent ? "bg-transparent" : "bg-white shadow-sm"}`}>
            <h3 className="text-[10px] font-bold text-indigo-500 uppercase mb-1 flex items-center gap-1">
              <PenLine size={10} /> Journal
            </h3>
            {isSelected && !zenMode ? (
              <textarea
                className="w-full h-full bg-transparent resize-none border-none outline-none text-xs text-gray-700 leading-relaxed font-serif"
                value={safeContent(item.content)}
                onChange={(e) => onUpdate(item.id, { content: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Write your thoughts..."
              />
            ) : (
              <div className="w-full h-full overflow-hidden text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-serif">
                {safeContent(item.content) || "Click to write..."}
              </div>
            )}
          </div>
        )}
        {item.type === "timer" && <CountdownWidget target={item.content} />}
      </div>
      {isSelected && !zenMode && (
        <>
          <div
            className="ctrl absolute -right-2 -bottom-2 w-5 h-5 bg-white border-2 border-purple-500 rounded-full cursor-se-resize flex items-center justify-center shadow-md z-50"
            onPointerDown={handleResizeStart}
          >
            <Maximize size={10} className="text-purple-500 rotate-90" />
          </div>
          <button
            className="ctrl absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 z-50"
            onPointerDown={(e) => {
              e.stopPropagation();
              onUpdate(item.id, null);
            }}
          >
            <X size={12} />
          </button>
          <button
            className="ctrl absolute -top-2 right-8 w-6 h-6 bg-white border-2 border-purple-500 text-purple-600 rounded-full flex items-center justify-center shadow-md hover:bg-purple-50 z-50"
            title="Edit style"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenProps?.();
            }}
          >
            <Settings size={12} />
          </button>
          {(item.type === "text" || item.type === "goals") && (
            <button
              className="ctrl absolute -top-2 -left-2 w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-indigo-600 z-50"
              title="AI Breakdown"
              onPointerDown={(e) => {
                e.stopPropagation();
                onMagicBreakdown?.(item);
              }}
            >
              <Zap size={12} fill="currentColor" />
            </button>
          )}
        </>
      )}
      {showGlow && !isSelected && !zenMode && (
        <div className="absolute -top-2 -left-2 bg-yellow-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-bounce flex items-center gap-0.5">
          <Flame size={8} /> {streak}d
        </div>
      )}
    </div>
  );
};

export default BoardItem;
