import { useState } from "react";
import { Sparkles, ArrowLeft, ArrowRight, Check, Layers } from "lucide-react";
import { LIFE_AREAS } from "../../constants/onboarding";
import { COLORS } from "../../constants/colors";

const STEP_TITLES = [
  "What matters to you right now?",
  "Pick a vibe",
  "Here's your starting point",
];

// First-run wizard: 3 calm steps → a starter board. Fully keyboard/touch
// friendly and phone-sized (max-w-md, scrollable body). Skip is always
// available and never nags again.
const OnboardingModal = ({ onCreate, onSkip }) => {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState([]);
  const [bg, setBg] = useState("#f3f4f6");

  const toggleArea = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (prev.length >= 3) return prev; // 1–3 areas keeps the board focused
      return [...prev, id];
    });
  };

  const chosen = selected.map((id) => LIFE_AREAS.find((a) => a.id === id)).filter(Boolean);
  const canNext = step !== 0 || selected.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white flex-none">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} />
            <h3 className="text-base font-bold leading-tight">{STEP_TITLES[step]}</h3>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map((s) => (
              <div key={s} className={`h-1 rounded-full transition-all ${s === step ? "w-6 bg-white" : "w-3 bg-white/40"}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {step === 0 && (
            <>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                Pick 1–3 life areas — fewer is better. Your board starts with a small cluster for each.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {LIFE_AREAS.map((area) => {
                  const isOn = selected.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      onClick={() => toggleArea(area.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                        isOn
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500"
                          : "border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-600"
                      } ${!isOn && selected.length >= 3 ? "opacity-40" : ""}`}
                    >
                      <span className="text-lg leading-none">{area.sticker}</span>
                      <span className="flex-1 truncate">{area.label}</span>
                      {isOn && <Check size={14} className="flex-none text-purple-600 dark:text-purple-400" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">Choose a board background. You can change it anytime in Settings.</p>
              <div className="grid grid-cols-4 gap-2.5">
                {COLORS.map((c) => (
                  <button
                    key={c.bg}
                    onClick={() => setBg(c.bg)}
                    className={`rounded-xl border p-1 transition-all ${
                      bg === c.bg ? "border-purple-500 ring-2 ring-purple-400" : "border-gray-200 dark:border-slate-700 hover:border-purple-300"
                    }`}
                    title={c.name}
                  >
                    <div className="h-12 rounded-lg border border-black/5" style={{ backgroundColor: c.bg }} />
                    <div className="text-[9px] font-semibold text-gray-500 dark:text-slate-400 mt-1 truncate text-center">{c.name}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 mb-4" style={{ backgroundColor: bg }}>
                <div className="flex flex-wrap gap-2">
                  {chosen.map((area) => (
                    <span
                      key={area.id}
                      className="inline-flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/60 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold shadow-sm"
                      style={{ color: area.color }}
                    >
                      {area.sticker} {area.label}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                Each area gets a header, a sticker, and a starter prompt to make your first goal a <em>process</em> goal
                {chosen[0] ? ` — plus a daily habit tracker for ${chosen[0].label}.` : "."} Nothing here is precious: move, edit, or delete anything.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex-none">
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-sm font-medium flex items-center gap-1 hover:border-purple-300"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => canNext && setStep(step + 1)}
                disabled={!canNext}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 shadow-sm"
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => onCreate(selected, bg)}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Layers size={15} /> Create my board
              </button>
            )}
          </div>
          <button
            onClick={onSkip}
            className="w-full mt-2 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 py-1"
          >
            Skip — start blank
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
