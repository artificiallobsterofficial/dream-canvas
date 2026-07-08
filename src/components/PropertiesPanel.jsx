import { X, Trash2, RotateCw } from "lucide-react";
import { TEXT_COLORS, NOTE_COLORS, TRACKER_COLORS, TRACKER_MARKERS, FONT_OPTIONS } from "../constants/colors";

const PropertiesPanel = ({ item, onUpdate, onClose }) => (
  // Desktop: floating panel top-right. Small screens: bottom sheet.
  <div className="fixed inset-x-0 bottom-0 w-full rounded-t-2xl max-h-[45vh] pb-[env(safe-area-inset-bottom)] md:absolute md:top-3 md:right-12 md:bottom-auto md:inset-x-auto md:w-56 md:rounded-xl md:max-h-[85vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-xl border border-gray-200 dark:border-slate-700 p-3 z-40 overflow-y-auto">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Edit {item.type}</span>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">
        <X size={14} />
      </button>
    </div>
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button onClick={() => onUpdate(item.id, { zIndex: (item.zIndex || 0) + 10 })} className="flex-1 text-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 py-1.5 rounded text-gray-700 dark:text-slate-300">
          Forward
        </button>
        <button onClick={() => onUpdate(item.id, { zIndex: Math.max(0, (item.zIndex || 0) - 10) })} className="flex-1 text-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 py-1.5 rounded text-gray-700 dark:text-slate-300">
          Backward
        </button>
      </div>

      <div>
        <label className="text-[10px] text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
          <RotateCw size={10} /> Rotation ({Math.round(item.rotation || 0)}°)
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={item.rotation || 0}
            onChange={(e) => onUpdate(item.id, { rotation: Number(e.target.value) })}
            className="flex-1 dc-range"
          />
          <button onClick={() => onUpdate(item.id, { rotation: 0 })} className="text-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-slate-300">
            0°
          </button>
        </div>
      </div>

      {item.type === "text" && (
        <>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate(item.id, { color: c })}
                  className={`w-5 h-5 rounded-full border border-gray-200 dark:border-slate-600 ${item.color === c ? "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">Font</label>
            <div className="flex gap-1">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdate(item.id, { font: f.id })}
                  className={`flex-1 text-[10px] py-1 rounded border ${f.id} ${
                    (item.font || "font-sans") === f.id
                      ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {item.type === "note" && (
        <div>
          <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">Note Color</label>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdate(item.id, { backgroundColor: c })}
                className={`w-5 h-5 rounded-full border border-gray-200 dark:border-slate-600 ${item.backgroundColor === c ? "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {item.type === "tracker" && (
        <>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">Theme</label>
            <div className="flex flex-wrap gap-1.5">
              {TRACKER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate(item.id, { color: c })}
                  className={`w-5 h-5 rounded-full border border-gray-200 dark:border-slate-600 ${item.color === c ? "ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-slate-900" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">Marker</label>
            <div className="flex gap-1.5">
              {TRACKER_MARKERS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onUpdate(item.id, { marker: m.id })}
                  className={`p-1 rounded border ${item.marker === m.id ? "border-purple-500 bg-purple-50 dark:bg-purple-900/40" : "border-gray-200 dark:border-slate-600"}`}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {item.type === "link" && (
        <>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">URL</label>
            <input
              type="text"
              className="w-full text-xs dc-field"
              value={typeof item.content === "string" ? item.content : ""}
              onChange={(e) => onUpdate(item.id, { content: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">Title</label>
            <input
              type="text"
              className="w-full text-xs dc-field"
              value={item.title || ""}
              onChange={(e) => onUpdate(item.id, { title: e.target.value || undefined })}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Auto (from URL)"
            />
          </div>
        </>
      )}

      {item.type === "timer" && (
        <div>
          <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-1">Target Date</label>
          <input
            type="date"
            className="w-full text-xs dc-field"
            value={item.content?.slice(0, 10) || ""}
            onChange={(e) => onUpdate(item.id, { content: new Date(e.target.value).toISOString() })}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {["tracker", "goals", "journal"].includes(item.type) && (
        <label className="flex items-center justify-between text-[10px] text-gray-600 dark:text-slate-300 cursor-pointer">
          <span>Transparent background</span>
          <input
            type="checkbox"
            checked={!!item.transparent}
            onChange={(e) => onUpdate(item.id, { transparent: e.target.checked })}
            className="dc-check"
          />
        </label>
      )}

      <button
        onClick={() => onUpdate(item.id, null)}
        className="w-full flex items-center justify-center gap-1 text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50 py-1.5 rounded-lg text-xs mt-1"
      >
        <Trash2 size={12} /> Remove
      </button>
    </div>
  </div>
);

export default PropertiesPanel;
