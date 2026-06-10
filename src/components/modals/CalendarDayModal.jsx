import { Clock, X, CheckCircle2, Calendar } from "lucide-react";

const CalendarDayModal = ({ data, dateStr, onUpdateStatus, onUpdateEvent, onClose }) => (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
          <Clock size={16} className="text-purple-500" />
          {dateStr}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-1 rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Status</label>
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateStatus("done")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                data.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <CheckCircle2 size={14} /> Done
            </button>
            <button
              onClick={() => onUpdateStatus("planned")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                data.status === "planned" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Calendar size={14} /> Planned
            </button>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Note</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none resize-none h-16"
            placeholder="Add details..."
            value={data.event}
            onChange={(e) => onUpdateEvent(e.target.value)}
          />
        </div>
        <button onClick={onClose} className="w-full py-1.5 bg-gray-900 text-white rounded-lg hover:bg-black text-xs font-medium">
          Save & Close
        </button>
      </div>
    </div>
  </div>
);

export default CalendarDayModal;
