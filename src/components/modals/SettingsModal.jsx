import { useState, useEffect } from "react";
import { Settings, X, Trash2, History, RotateCcw, KeyRound, Bell, RefreshCw, Sun, Moon, Monitor } from "lucide-react";
import { COLORS } from "../../constants/colors";
import { getAiProvider, getAiSource, getStoredKey, setStoredKey, callAI } from "../../services/ai";
import { SnapshotService } from "../../services/storage";
import { enableReminders } from "../../services/reminders";

const REASON_LABELS = {
  daily: "Daily auto-backup",
  "before-clear": "Before board clear",
  "before-import": "Before import",
  "before-template": "Before template",
  "before-restore": "Before restore",
};

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const SettingsModal = ({ boardConfig, setBoardConfig, onClearBoard, onRestoreSnapshot, lastExportAt, onClose }) => {
  const [snapshots, setSnapshots] = useState([]);
  // null | "checking" | "current" | "update" | "error"
  const [updateStatus, setUpdateStatus] = useState(null);
  const [keyInput, setKeyInput] = useState(getStoredKey());
  // null | "testing" | "ok" | "fail" | "wrong-provider"
  const [keyStatus, setKeyStatus] = useState(null);

  useEffect(() => {
    SnapshotService.list().then(setSnapshots);
  }, []);

  const checkForUpdate = async () => {
    setUpdateStatus("checking");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json?cb=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const { version } = await res.json();
      setUpdateStatus(version === __APP_VERSION__ ? "current" : "update");
    } catch {
      setUpdateStatus("error");
    }
  };

  const applyUpdate = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration?.();
      await reg?.update();
    } catch {}
    // Navigations are network-first in the SW, so a reload fetches the new build.
    window.location.reload();
  };

  const provider = getAiProvider();
  const source = getAiSource();
  const reminder = boardConfig.reminder || { enabled: false, time: "20:00" };
  const themePref = boardConfig.theme || "system";
  const [reminderError, setReminderError] = useState(null);

  const toggleReminder = async (enabled) => {
    setReminderError(null);
    if (enabled) {
      const result = await enableReminders();
      if (result !== "granted") {
        setReminderError(
          result === "unsupported"
            ? "This browser doesn't support notifications."
            : "Notifications are blocked — allow them for this site in your browser settings, then try again."
        );
        return;
      }
    }
    setBoardConfig({ ...boardConfig, reminder: { ...reminder, enabled } });
  };
  const saveKey = async () => {
    const k = keyInput.trim();
    if (!k) {
      setStoredKey("");
      setKeyStatus(null);
      return;
    }
    // OpenAI-style keys share the sk- prefix — catch the common mistake early.
    if (k.startsWith("sk-") && !k.startsWith("sk-ant-")) {
      setKeyStatus("wrong-provider");
      return;
    }
    setStoredKey(k);
    setKeyStatus("testing");
    const result = await callAI("Reply with exactly: OK", "You are a connectivity test. Reply with exactly: OK");
    setKeyStatus(result ? "ok" : "fail");
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Settings size={18} /> Settings
          </h3>
          <button onClick={onClose}>
            <X size={18} className="text-gray-400 dark:text-slate-500" />
          </button>
        </div>
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Appearance</label>
            <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg gap-0.5">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = themePref === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setBoardConfig({ ...boardConfig, theme: opt.id })}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                      active
                        ? "bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-300"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon size={13} /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Background Color</label>
            <div className="flex flex-wrap gap-2 justify-center">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setBoardConfig({ ...boardConfig, backgroundColor: c.bg })}
                  className={`w-7 h-7 rounded-full border border-gray-300 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform ${
                    boardConfig.backgroundColor === c.bg ? "ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-slate-900" : ""
                  }`}
                  style={{ backgroundColor: c.bg }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <History size={11} /> Backups
            </label>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">
              Automatic snapshots, kept in this browser. Last file export:{" "}
              <span className="font-medium text-gray-700 dark:text-slate-300">{lastExportAt ? new Date(lastExportAt).toLocaleDateString() : "never"}</span>
            </p>
            {snapshots.length === 0 ? (
              <p className="text-[11px] text-gray-400 dark:text-slate-500 italic">No snapshots yet — they're created daily and before risky actions.</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {snapshots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-gray-700 dark:text-slate-300 truncate">{REASON_LABELS[s.reason] || s.reason}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        {new Date(s.ts).toLocaleString()} · {s.itemCount} items
                      </p>
                    </div>
                    <button
                      onClick={() => onRestoreSnapshot(s.id)}
                      className="flex-none flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-2 py-1 rounded-md"
                      title="Restore this snapshot"
                    >
                      <RotateCcw size={11} /> Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Bell size={11} /> Daily Reminder
            </label>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!reminder.enabled}
                  onChange={(e) => toggleReminder(e.target.checked)}
                  className="dc-check"
                />
                Remind me if habits aren't done by
              </label>
              <input
                type="time"
                value={reminder.time}
                onChange={(e) => setBoardConfig({ ...boardConfig, reminder: { ...reminder, time: e.target.value } })}
                className="dc-field text-[11px]"
              />
            </div>
            {reminderError && <p className="text-[10px] text-red-500 mb-1">{reminderError}</p>}
            <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
              Fires while DreamCanvas is open; on installed Android/desktop Chrome it can also fire in the background. On iPhone, install the
              app (Share → Add to Home Screen) and open it daily for the best experience.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <KeyRound size={11} /> AI Coach
            </label>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">
              Status:{" "}
              <span className="font-bold text-gray-700 dark:text-slate-300">
                {provider === "claude" ? "Claude" : provider === "gemini" ? "Gemini" : "Offline fallbacks"}
              </span>
              {provider && <span className="text-gray-400 dark:text-slate-500"> · {source === "env" ? "key from .env" : "your key"}</span>}
            </p>
            {source === "env" ? (
              <p className="text-[10px] text-gray-400 dark:text-slate-500">A key from .env is in use; remove it to use a browser-stored key instead.</p>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    placeholder="Anthropic (sk-ant-…) or Gemini key"
                    className="flex-1 dc-field text-[11px] py-1.5"
                    value={keyInput}
                    onChange={(e) => { setKeyInput(e.target.value); setKeyStatus(null); }}
                  />
                  <button
                    onClick={saveKey}
                    disabled={keyStatus === "testing"}
                    className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-[11px] font-medium hover:bg-purple-700 disabled:opacity-60"
                  >
                    {keyStatus === "testing" ? "Testing…" : "Save & test"}
                  </button>
                </div>
                {keyStatus === "ok" && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">✓ Key works — {getAiProvider() === "claude" ? "Claude" : "Gemini"} connected.</p>}
                {keyStatus === "fail" && <p className="text-[10px] text-red-500 mt-1 font-medium">✗ That key didn't work — check it and try again. AI features will use offline fallbacks meanwhile.</p>}
                {keyStatus === "wrong-provider" && <p className="text-[10px] text-red-500 mt-1 font-medium">✗ That looks like an OpenAI key — DreamCanvas supports Anthropic (sk-ant-…) or Gemini keys.</p>}
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                  Stored only in this browser; calls go directly from your browser to the provider. Don't enter a key on a shared computer.
                  Without a key, AI features use built-in offline responses.
                </p>
              </>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-2">
            <p className="text-[10px] text-gray-400 dark:text-slate-500">
              Version: <span className="font-mono text-gray-500 dark:text-slate-400">{__APP_VERSION__}</span>
            </p>
            {updateStatus === "update" ? (
              <button onClick={applyUpdate} className="flex items-center gap-1 text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded-md">
                <RefreshCw size={10} /> Update now
              </button>
            ) : (
              <button
                onClick={checkForUpdate}
                disabled={updateStatus === "checking"}
                className="flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-2 py-1 rounded-md disabled:opacity-50"
              >
                <RefreshCw size={10} className={updateStatus === "checking" ? "animate-spin" : ""} />
                {updateStatus === "checking" ? "Checking…" : updateStatus === "current" ? "✓ Up to date" : updateStatus === "error" ? "Couldn't check — offline?" : "Check for updates"}
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
            <button
              onClick={onClearBoard}
              className="w-full py-2 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-medium flex items-center justify-center gap-1"
            >
              <Trash2 size={14} /> Clear Entire Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
