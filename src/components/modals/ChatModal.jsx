import { Bot, X, RefreshCw, Send, User, Lightbulb } from "lucide-react";
import FormatMessage from "../FormatMessage";
import { SUGGESTED_PROMPTS } from "../../constants/library";
import { getAiProvider } from "../../services/ai";

const ChatModal = ({ chatHistory, chatInput, setChatInput, isChatLoading, onSend, onReset, onClose, chatEndRef }) => {
  const aiProvider = getAiProvider();
  return (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[550px] max-h-[88vh]">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-white flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-full">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Goal Coach AI</h3>
            <p className="text-[9px] text-blue-100 uppercase tracking-wider">
              {aiProvider === "claude" ? "Powered by Claude" : aiProvider === "gemini" ? "Powered by Gemini" : "Offline mode"}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onReset} className="hover:bg-white/20 p-1.5 rounded-full">
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-full">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role !== "user" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white mt-0.5">
                <Bot size={12} />
              </div>
            )}
            <div
              className={`max-w-[80%] p-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
              }`}
            >
              <FormatMessage text={typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text)} />
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600 mt-0.5">
                <User size={12} />
              </div>
            )}
          </div>
        ))}
        {isChatLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
              <Bot size={12} />
            </div>
            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        )}
        {chatHistory.length === 1 && !isChatLoading && (
          <div className="grid gap-1.5 mt-3 px-1">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-0.5">
              <Lightbulb size={10} /> Try asking...
            </p>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => onSend(prompt)}
                className="text-left text-xs p-2.5 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex gap-2 relative">
          <input
            type="text"
            placeholder="Ask for vision board ideas..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none pr-10"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isChatLoading && onSend()}
            disabled={isChatLoading}
          />
          <button
            onClick={() => onSend()}
            disabled={isChatLoading || !chatInput.trim()}
            className="absolute right-1 top-1 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};

export default ChatModal;
