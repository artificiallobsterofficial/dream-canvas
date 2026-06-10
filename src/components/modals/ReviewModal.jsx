import { BarChart3, X, Loader2, StickyNote, Sparkles } from "lucide-react";
import FormatMessage from "../FormatMessage";

const ReviewModal = ({ review, isLoading, onAddToBoard, onRegenerate, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} />
          <div>
            <h3 className="font-bold">Weekly Review</h3>
            <p className="text-[9px] text-emerald-100 uppercase tracking-wider">
              {review?.source === "ai" ? "AI coach + your real data" : "Computed from your real data"}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-3">
            <Loader2 className="animate-spin text-emerald-500" size={28} />
            <p className="text-xs">Reading your week...</p>
          </div>
        ) : (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono text-[12px]">
            <FormatMessage text={review?.text || ""} />
          </div>
        )}
      </div>
      {!isLoading && (
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
          <button
            onClick={onAddToBoard}
            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <StickyNote size={13} /> Add to board
          </button>
          <button
            onClick={onRegenerate}
            className="py-2 px-3 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} /> Regenerate
          </button>
        </div>
      )}
    </div>
  </div>
);

export default ReviewModal;
