import { useState } from "react";
import { Clock, X, CheckCircle2, Calendar, Eraser, Repeat, Plus, CalendarClock } from "lucide-react";
import { generateId, sortDayEvents } from "../../utils/helpers";

// Timed entries for one day, phone-calendar style. Single-day mode only —
// duplicating the same timed event across a range is rarely what you want.
const DayEvents = ({ events, onUpdateEvents }) => {
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const add = () => {
    const t = title.trim();
    if (!t) return;
    onUpdateEvents(sortDayEvents([...events, { id: generateId(), time, title: t }]));
    setTime("");
    setTitle("");
  };
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
        <CalendarClock size={11} /> Events
      </label>
      {events.length > 0 && (
        <div className="space-y-1 mb-1.5">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 rounded-lg px-2 py-1">
              <span className="font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400 w-10 flex-none">{ev.time || "—"}</span>
              <span className="text-xs text-gray-700 dark:text-slate-200 flex-1 truncate">{ev.title}</span>
              <button
                onClick={() => onUpdateEvents(events.filter((e) => e.id !== ev.id))}
                className="text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input type="time" className="dc-field text-xs p-1.5 w-24 flex-none" value={time} onChange={(e) => setTime(e.target.value)} />
        <input
          type="text"
          className="dc-field text-xs p-1.5 flex-1 min-w-0"
          placeholder="Dentist, call mom..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={!title.trim()}
          className="p-1.5 rounded-lg bg-purple-600 text-white enabled:hover:bg-purple-700 disabled:opacity-30 flex-none"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};

const CalendarDayModal = ({ data, dateStr, multiCount, repeat, repeatExtra, onToggleRepeat, onUpdateStatus, onUpdateEvent, onUpdateEvents, onClear, onClose }) => (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-1.5 text-sm">
          <Clock size={16} className="text-purple-500 flex-none" />
          {dateStr}
          {multiCount > 1 && (
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/40 rounded-full px-1.5 py-0.5">
              {multiCount} days
            </span>
          )}
        </h3>
        <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 p-1 rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Status</label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateStatus("done")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                data.status === "done"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
              }`}
            >
              <CheckCircle2 size={14} /> Done
            </button>
            <button
              onClick={() => onUpdateStatus("planned")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                data.status === "planned"
                  ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
              }`}
            >
              <Calendar size={14} /> Planned
            </button>
          </div>
        </div>
        {onUpdateEvents && !multiCount && <DayEvents events={data.events || []} onUpdateEvents={onUpdateEvents} />}
        <div>
          <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Note</label>
          <textarea
            className="w-full dc-field p-2 text-xs resize-none h-16"
            placeholder={multiCount > 1 ? "Add a note to every selected day..." : "Add details..."}
            value={data.event}
            onChange={(e) => onUpdateEvent(e.target.value)}
          />
        </div>
        {multiCount > 1 && onToggleRepeat && (
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300 cursor-pointer select-none py-0.5">
            <input type="checkbox" className="dc-check" checked={repeat} onChange={onToggleRepeat} />
            <Repeat size={13} className="text-purple-500 flex-none" />
            <span>
              Repeat weekly until month end
              {!repeat && repeatExtra > 0 && <span className="text-gray-400 dark:text-slate-500"> (+{repeatExtra} more days)</span>}
            </span>
          </label>
        )}
        {multiCount > 1 && (
          <button
            onClick={onClear}
            className="w-full py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 flex items-center justify-center gap-1"
          >
            <Eraser size={13} /> Clear these days
          </button>
        )}
        <button onClick={onClose} className="w-full py-1.5 bg-gray-900 dark:bg-purple-600 text-white rounded-lg hover:bg-black dark:hover:bg-purple-700 text-xs font-medium">
          Save & Close
        </button>
      </div>
    </div>
  </div>
);

export default CalendarDayModal;
