import { Clock, X, CheckCircle2, Calendar } from "lucide-react";

const CalendarDayModal = ({ data, dateStr, onUpdateStatus, onUpdateEvent, onClose }) => (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-1.5">
          <Clock size={16} className="text-purple-500" />
          {dateStr}
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
        <div>
          <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Note</label>
          <textarea
            className="w-full dc-field p-2 text-xs resize-none h-16"
            placeholder="Add details..."
            value={data.event}
            onChange={(e) => onUpdateEvent(e.target.value)}
          />
        </div>
        <button onClick={onClose} className="w-full py-1.5 bg-gray-900 dark:bg-purple-600 text-white rounded-lg hover:bg-black dark:hover:bg-purple-700 text-xs font-medium">
          Save & Close
        </button>
      </div>
    </div>
  </div>
);

export default CalendarDayModal;
