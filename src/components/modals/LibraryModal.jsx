import { BookOpen, X, Book } from "lucide-react";
import { LIBRARY_RESOURCES } from "../../constants/library";

const LibraryModal = ({ onAskCoach, onAddToBoard, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BookOpen size={18} />
          <h3 className="font-bold">Learning Library</h3>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="space-y-6">
          {LIBRARY_RESOURCES.map((cat, idx) => (
            <div key={idx}>
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Book size={12} /> {cat.category}
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {cat.items.map((item, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                    <h4 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-teal-600">{item.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{item.content}</p>
                    <div className="flex gap-2">
                      <button onClick={() => onAskCoach(item)} className="text-[10px] font-medium text-teal-600 hover:bg-teal-50 px-1.5 py-0.5 rounded">
                        Ask Coach
                      </button>
                      <button onClick={() => onAddToBoard(item)} className="text-[10px] font-medium text-gray-500 hover:bg-gray-100 px-1.5 py-0.5 rounded">
                        Add to Board
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default LibraryModal;
