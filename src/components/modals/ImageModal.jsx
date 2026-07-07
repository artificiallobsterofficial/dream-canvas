import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { fileToDataUrl } from "../../utils/helpers";

const ImageModal = ({ onAdd, onClose }) => {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      onAdd(dataUrl);
    } catch (e) {
      setError(e.message || "Could not load that file.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-5">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-3">Add Image</h3>
        <input
          type="text"
          placeholder="Paste image address..."
          className="w-full dc-field p-2.5 mb-3 text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && url && onAdd(url)}
          autoFocus
        />
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px bg-gray-200 dark:bg-slate-700 flex-1" />
          <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">or</span>
          <div className="h-px bg-gray-200 dark:bg-slate-700 flex-1" />
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {busy ? "Processing..." : "Upload from device"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-sm">
            Cancel
          </button>
          <button onClick={() => url && onAdd(url)} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
