import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Snowflake } from "lucide-react";
import { normalizeDayData, isFreezeActive } from "../../utils/helpers";
import { TRACKER_MARKERS } from "../../constants/colors";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const TrackerCalendar = ({ item, zenMode, onUpdate, onDayClick, onDaysSelect }) => {
  let trackedDates = {};
  try {
    trackedDates = JSON.parse(item.content || "{}");
  } catch {}
  const viewDate = new Date(item.viewDate || Date.now());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const themeColor = item.color || "#10b981";
  const marker = item.marker || "check";
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const monthlyKeys = Object.keys(trackedDates).filter((k) => {
    const [y, m] = k.split("-").map(Number);
    return y === year && m === month + 1;
  });
  const doneCount = monthlyKeys.filter((k) => normalizeDayData(trackedDates[k]).status === "done").length;
  const progressPct = Math.round((doneCount / daysInMonth) * 100);

  const changeMonth = (offset) => {
    const nd = new Date(year, month + offset, 1);
    onUpdate(item.id, { viewDate: nd.getTime() });
  };
  const dayKey = (day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const handleDayClick = (day) => {
    if (onDayClick && !zenMode) onDayClick(item.id, dayKey(day), normalizeDayData(trackedDates[dayKey(day)]));
  };

  // ─ Drag-select: press a day and sweep to mark a whole range at once ─
  // A plain click (no sweep) keeps the single-day behavior. elementFromPoint is
  // used because touch pointers implicitly capture to the pressed cell, so
  // pointerenter never fires on sibling days.
  const [dragRange, setDragRange] = useState(null); // { from, to } day numbers
  const dragRef = useRef(null);
  const beginDaySelect = (e, day) => {
    e.stopPropagation();
    if (zenMode) return;
    dragRef.current = { anchor: day, last: day };
    setDragRange({ from: day, to: day });
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = el && el.closest ? el.closest("[data-trackerday]") : null;
      if (!cell || cell.dataset.trackerid !== String(item.id) || !dragRef.current) return;
      const d = Number(cell.dataset.trackerday);
      if (d && d !== dragRef.current.last) {
        dragRef.current.last = d;
        setDragRange({ from: dragRef.current.anchor, to: d });
      }
    };
    const teardown = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      setDragRange(null);
    };
    const finish = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      teardown();
      if (!drag) return;
      if (drag.last === drag.anchor) {
        handleDayClick(drag.anchor);
      } else if (onDaysSelect) {
        const [a, b] = drag.anchor < drag.last ? [drag.anchor, drag.last] : [drag.last, drag.anchor];
        const keys = [];
        for (let d = a; d <= b; d++) keys.push(dayKey(d));
        onDaysSelect(item.id, keys);
      }
    };
    const cancel = () => {
      dragRef.current = null;
      teardown();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
  };
  const getMarkerIcon = () => {
    const m = TRACKER_MARKERS.find((m) => m.id === marker);
    return m ? m.icon : "✔️";
  };

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(<div key={`e${i}`} className="h-7" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayData = normalizeDayData(trackedDates[dateKey]);
    const isDone = dayData.status === "done";
    const isPlanned = dayData.status === "planned";
    const hasNote = !!(dayData.event && dayData.event.trim());
    const inDragRange = dragRange && d >= Math.min(dragRange.from, dragRange.to) && d <= Math.max(dragRange.from, dragRange.to);
    days.push(
      <div
        key={d}
        data-trackerday={d}
        data-trackerid={item.id}
        onPointerDown={(e) => beginDaySelect(e, d)}
        className={`relative h-7 w-7 flex items-center justify-center rounded-full text-xs transition-all select-none ${!zenMode && "cursor-pointer"} ${
          isDone ? "font-bold text-white shadow-sm" : isPlanned ? "font-medium" : !zenMode ? "hover:bg-gray-100 text-gray-500" : "text-gray-500"
        }`}
        style={{
          backgroundColor: isDone ? (marker === "check" ? themeColor : "transparent") : inDragRange ? `${themeColor}22` : "transparent",
          color: isDone ? (marker === "check" ? "white" : "inherit") : isPlanned ? themeColor : "inherit",
          border: isDone && marker !== "check" ? `1px solid ${themeColor}` : isPlanned ? `1px dashed ${themeColor}` : "none",
          boxShadow: inDragRange ? `0 0 0 2px ${themeColor}` : undefined,
        }}
        title={hasNote ? dayData.event : undefined}
      >
        {isDone || isPlanned ? getMarkerIcon() : d}
        {hasNote && (
          <span
            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full pointer-events-none"
            style={{ backgroundColor: isDone && marker === "check" ? "rgba(255,255,255,0.9)" : themeColor }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full select-none text-gray-800">
      <input
        disabled={zenMode}
        className="w-full text-center font-bold text-sm bg-transparent border-none outline-none mb-1"
        style={{ color: themeColor }}
        value={item.title || ""}
        placeholder="Name your habit..."
        onChange={(e) => onUpdate(item.id, { title: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div className={`flex items-center justify-between mb-1 pb-1 border-b border-gray-100 ${zenMode ? "hidden" : ""}`}>
        <button onPointerDown={(e) => { e.stopPropagation(); changeMonth(-1); }} className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400">
          <ChevronLeft size={14} />
        </button>
        <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">{MONTH_NAMES[month]} {year}</span>
        <button onPointerDown={(e) => { e.stopPropagation(); changeMonth(1); }} className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400">
          <ChevronRight size={14} />
        </button>
      </div>
      {!zenMode && (
        <div className="grid grid-cols-7 gap-0.5 mb-0.5 text-center text-[9px] text-gray-400 font-bold">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
      )}
      <div className="grid grid-cols-7 gap-0.5 place-items-center mb-auto">{days}</div>
      {!zenMode && (
        <div className="mt-1 pt-1 border-t border-gray-100">
          {isFreezeActive(item.content) && (
            <div className="text-[10px] text-sky-600 bg-sky-50 border border-sky-100 rounded-md px-1.5 py-0.5 mb-1 flex items-center gap-1">
              <Snowflake size={10} className="flex-none" /> <span className="font-medium">Freeze saved your streak — never miss twice!</span>
            </div>
          )}
          <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
            <span>Progress</span>
            <span className="font-bold" style={{ color: themeColor }}>{doneCount}/{daysInMonth}</span>
          </div>
          <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: themeColor }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackerCalendar;
