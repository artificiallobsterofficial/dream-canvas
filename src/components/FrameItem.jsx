import { useState, useRef, useEffect } from "react";
import { Maximize, X, Settings } from "lucide-react";
import { safeContent } from "../utils/helpers";

// Accent hex -> rgba tint for the frame's translucent fill/border.
const tint = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// A life-area frame: a large rounded region rendered BEHIND normal items.
// The interior is pointer-transparent (so panning and item interactions inside
// keep working); the frame itself is grabbed by its edges or its name chip.
const FrameItem = ({ item, isSelected, onSelect, onUpdate, zenMode, zoom = 1, onOpenProps, onResizeStart, onResizeEnd }) => {
  const accent = item.color || "#8b5cf6";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    if (zenMode) return;
    setDraft(safeContent(item.content));
    setEditing(true);
  };
  const commitEdit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== item.content) onUpdate(item.id, { content: name });
  };

  const grab = (e) => {
    if (zenMode || editing) return;
    onSelect(e, item);
  };

  // Same transient-resize pattern as BoardItem, with a frame-sized floor.
  const handleResizeStart = (e) => {
    e.stopPropagation();
    onResizeStart?.(item);
    const startX = e.clientX, startY = e.clientY, startW = item.width, startH = item.height;
    const onMove = (mv) =>
      onUpdate(
        item.id,
        {
          width: Math.max(220, startW + (mv.clientX - startX) / zoom),
          height: Math.max(150, startH + (mv.clientY - startY) / zoom),
        },
        { transient: true }
      );
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onResizeEnd?.(item.id);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="absolute select-none touch-none pointer-events-none"
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex || 1 }}
    >
      {/* Visual body: tinted translucent fill + accent border (no rotation for frames) */}
      <div
        className={`absolute inset-0 rounded-2xl transition-shadow ${isSelected && !zenMode ? "ring-2 ring-purple-500 shadow-xl" : ""}`}
        style={{ backgroundColor: tint(accent, 0.07), border: `1.5px solid ${tint(accent, 0.5)}` }}
      />
      {/* Edge grab strips — the draggable "border" of the frame. The interior stays
          pointer-transparent so items inside and canvas panning are unaffected. */}
      {!zenMode && (
        <>
          <div className="absolute top-0 left-0 right-0 h-3 pointer-events-auto cursor-move" onPointerDown={grab} />
          <div className="absolute bottom-0 left-0 right-0 h-3 pointer-events-auto cursor-move" onPointerDown={grab} />
          <div className="absolute top-0 bottom-0 left-0 w-3 pointer-events-auto cursor-move" onPointerDown={grab} />
          <div className="absolute top-0 bottom-0 right-0 w-3 pointer-events-auto cursor-move" onPointerDown={grab} />
        </>
      )}
      {/* Name chip — riding the top-left border. Double-click to rename inline. */}
      <div className={`absolute -top-3.5 left-4 max-w-[75%] ${zenMode ? "" : "pointer-events-auto"}`} onDoubleClick={startEdit}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-44 text-xs font-semibold rounded-full px-2.5 py-1 outline-none ring-2 ring-purple-400 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 shadow-sm"
          />
        ) : (
          <div
            className={`rounded-full px-2.5 py-1 shadow-sm text-white text-xs font-semibold truncate ${zenMode ? "" : "cursor-move"}`}
            style={{ backgroundColor: accent }}
            onPointerDown={grab}
            title={zenMode ? undefined : "Drag to move — double-click to rename"}
          >
            {safeContent(item.content) || "Untitled area"}
          </div>
        )}
      </div>
      {isSelected && !zenMode && (
        <>
          <div
            className="ctrl pointer-events-auto absolute -right-2 -bottom-2 w-5 h-5 bg-white border-2 border-purple-500 rounded-full cursor-se-resize flex items-center justify-center shadow-md z-50"
            onPointerDown={handleResizeStart}
          >
            <Maximize size={10} className="text-purple-500 rotate-90" />
          </div>
          <button
            className="ctrl pointer-events-auto absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 z-50"
            title="Remove frame (items inside are kept)"
            onPointerDown={(e) => {
              e.stopPropagation();
              onUpdate(item.id, null);
            }}
          >
            <X size={12} />
          </button>
          <button
            className="ctrl pointer-events-auto absolute -top-2 right-8 w-6 h-6 bg-white border-2 border-purple-500 text-purple-600 rounded-full flex items-center justify-center shadow-md hover:bg-purple-50 z-50"
            title="Edit frame"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenProps?.();
            }}
          >
            <Settings size={12} />
          </button>
        </>
      )}
    </div>
  );
};

export default FrameItem;
