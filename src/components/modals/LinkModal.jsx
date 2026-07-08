import { useState } from "react";
import { Link2 } from "lucide-react";
import { isHttpUrl } from "../../utils/links";

// Tiny prompt modal for the Add → Link flyout entry (paste-on-canvas is the
// fast path; this is the discoverable one). Mirrors ImageModal's shell.
const LinkModal = ({ onAdd, onClose }) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);

  const submit = () => {
    const trimmed = url.trim();
    if (!isHttpUrl(trimmed)) {
      setError("That doesn't look like a full web address (it should start with http:// or https://).");
      return;
    }
    onAdd(trimmed);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-5">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Link2 size={16} className="text-purple-500" /> Add Link
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Tip: you can also just paste a URL onto the board.</p>
        <input
          type="text"
          placeholder="https://…"
          className="w-full dc-field p-2.5 mb-2 text-sm"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-sm">
            Cancel
          </button>
          <button onClick={submit} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkModal;
