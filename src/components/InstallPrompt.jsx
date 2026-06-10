import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";

const DISMISSED_KEY = "dc_install_dismissed";
const VISITS_KEY = "dc_visits";

// Gentle install banner: Chrome/Edge/Android get the native prompt, iOS gets
// Add-to-Home-Screen instructions. Shown from the second visit, once.
const InstallPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
      const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
      if (standalone) return;
      const visits = Number(localStorage.getItem(VISITS_KEY) || 0) + 1;
      localStorage.setItem(VISITS_KEY, String(visits));
      const eligible = visits >= 2;
      const handler = (e) => {
        e.preventDefault();
        setDeferred(e);
        if (eligible) setShow(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      if (isIos && eligible) setShow(true);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    } catch {
      /* storage blocked — skip the prompt entirely */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setShow(false);
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === "accepted") dismiss();
    } else if (isIos) {
      setIosHelp(true);
    }
  };

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5">
        {!iosHelp ? (
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="w-10 h-10 rounded-xl flex-none" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900">Install DreamCanvas</p>
              <p className="text-[11px] text-gray-500 leading-snug">Works offline, opens like an app — and habit reminders work best installed.</p>
            </div>
            <button onClick={install} className="flex-none bg-purple-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-1">
              <Download size={12} /> {deferred ? "Install" : "How"}
            </button>
            <button onClick={dismiss} className="flex-none text-gray-300 hover:text-gray-500 p-1" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-xs font-bold text-gray-900">Add to your Home Screen</p>
              <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 p-1" aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
            <ol className="text-[11px] text-gray-600 space-y-1 list-decimal pl-4">
              <li className="leading-snug">
                Tap the <Share size={11} className="inline -mt-0.5 text-blue-500" /> <span className="font-medium">Share</span> button in Safari's toolbar
              </li>
              <li className="leading-snug">Scroll down and tap <span className="font-medium">"Add to Home Screen"</span></li>
              <li className="leading-snug">Open DreamCanvas from your Home Screen ✨</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstallPrompt;
