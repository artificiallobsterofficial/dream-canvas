import { Settings, X, Trash2 } from "lucide-react";
import { COLORS } from "../../constants/colors";
import { aiProvider } from "../../services/ai";

const SettingsModal = ({ boardConfig, setBoardConfig, onClearBoard, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Settings size={18} /> Settings
        </h3>
        <button onClick={onClose}>
          <X size={18} className="text-gray-400" />
        </button>
      </div>
      <div className="space-y-5">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Background Color</label>
          <div className="flex flex-wrap gap-2 justify-center">
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => setBoardConfig({ ...boardConfig, backgroundColor: c.bg })}
                className={`w-7 h-7 rounded-full border border-gray-300 shadow-sm hover:scale-110 transition-transform ${
                  boardConfig.backgroundColor === c.bg ? "ring-2 ring-purple-500 ring-offset-2" : ""
                }`}
                style={{ backgroundColor: c.bg }}
                title={c.name}
              />
            ))}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-[11px] text-gray-500">
          AI provider:{" "}
          <span className="font-bold text-gray-700">
            {aiProvider === "claude" ? "Claude (Anthropic)" : aiProvider === "gemini" ? "Gemini (Google)" : "None — using offline fallbacks"}
          </span>
          {!aiProvider && <p className="mt-1">Add a key to <span className="font-mono">.env</span> to enable live AI features.</p>}
        </div>
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={onClearBoard}
            className="w-full py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-medium flex items-center justify-center gap-1"
          >
            <Trash2 size={14} /> Clear Entire Board
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default SettingsModal;
