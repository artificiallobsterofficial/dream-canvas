import { Sparkles, X, Loader2 } from "lucide-react";

const AIModal = ({ aiPrompt, setAiPrompt, aiResults, setAiResults, isAiLoading, onGenerate, onPickResult, onClose }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <h3 className="font-bold">AI Creative Assistant</h3>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">
        <div className="space-y-3">
          {!aiResults ? (
            <>
              <p className="text-xs text-gray-500 dark:text-slate-400">Enter a goal or feeling to generate personalized affirmations.</p>
              <input
                type="text"
                placeholder="e.g., career success, inner peace, fitness..."
                className="w-full dc-field p-2.5 text-sm"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onGenerate()}
                autoFocus
              />
              <button
                onClick={onGenerate}
                disabled={isAiLoading || !aiPrompt}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {isAiLoading ? "Thinking..." : "Inspire Me"}
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-700 dark:text-slate-300">Click one to add to your board:</p>
              {aiResults.map((text, idx) => (
                <button
                  key={idx}
                  onClick={() => onPickResult(typeof text === "string" ? text : String(text))}
                  className="w-full text-left p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:border-indigo-800 rounded-lg text-indigo-900 dark:text-indigo-200 font-medium text-xs"
                >
                  "{typeof text === "string" ? text : String(text)}"
                </button>
              ))}
              <button onClick={() => setAiResults(null)} className="w-full py-1.5 text-gray-400 dark:text-slate-500 text-xs hover:text-gray-600 dark:hover:text-slate-300">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default AIModal;
