import { useState, useEffect } from "react";
import { Zap, StickyNote, Activity, CheckCircle2, ListTodo, PenLine, Trophy, Lock } from "lucide-react";
import { normalizeDayData, safeContent, todayKey } from "../utils/helpers";

const FocusDashboard = ({ items, userLevel, userXp, onUpdateItem, onAddXp, levels }) => {
  const [today, setToday] = useState("");
  const [currentQuote, setCurrentQuote] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [journalText, setJournalText] = useState("");
  const [journalItemId, setJournalItemId] = useState(null);

  useEffect(() => {
    setToday(todayKey());
    const textItems = items.filter((i) => i.type === "text");
    setCurrentQuote(
      textItems.length > 0
        ? safeContent(textItems[Math.floor(Math.random() * textItems.length)].content)
        : "Focus on being productive instead of busy."
    );
    const noteItems = items.filter((i) => i.type === "note");
    if (noteItems.length > 0) {
      setActiveNoteId(noteItems[noteItems.length - 1].id);
      setQuickNote(safeContent(noteItems[noteItems.length - 1].content));
    }
    const ji = items.find((i) => i.type === "journal");
    if (ji) {
      setJournalItemId(ji.id);
      setJournalText(safeContent(ji.content));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleHabit = (item) => {
    let td = {};
    try {
      td = JSON.parse(safeContent(item.content) || "{}");
    } catch {}
    const newData = { ...td };
    if (newData[today]?.status === "done") delete newData[today];
    else {
      newData[today] = { status: "done", event: "" };
      onAddXp(20);
    }
    onUpdateItem(item.id, { content: JSON.stringify(newData) });
  };

  const habits = items.filter((i) => i.type === "tracker");
  const goalItem = items.find((i) => i.type === "goals");
  let todoList = [];
  if (goalItem) {
    try {
      const p = JSON.parse(goalItem.content || "{}");
      if (p.short) todoList = p.short.split("\n").filter((l) => l.trim());
    } catch {}
  }
  const currentLevelInfo = levels.find((l) => l.level === userLevel) || levels[0];
  const nextLevelInfo = levels.find((l) => l.level === userLevel + 1);
  const xpForNext = nextLevelInfo ? nextLevelInfo.minXp : userXp + 1000;
  const completedHabits = habits.filter((h) => {
    try {
      return normalizeDayData(JSON.parse(safeContent(h.content) || "{}")[today]).status === "done";
    } catch {
      return false;
    }
  }).length;
  const progressPercent = habits.length === 0 ? 0 : Math.round((completedHabits / habits.length) * 100);

  return (
    <div className="flex-1 bg-gray-50 p-4 md:p-6 overflow-y-auto flex justify-center">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">{new Date().getDate()}</h2>
            <p className="text-gray-500 uppercase tracking-widest text-[10px] font-bold mb-3">
              {new Date().toLocaleDateString("en-US", { month: "long", weekday: "long" })}
            </p>
            <div className="h-1 w-8 bg-purple-500 rounded-full" />
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-md text-white">
            <div className="flex items-center gap-1.5 mb-2 opacity-80">
              <Zap size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Daily Signal</span>
            </div>
            <p className="text-sm leading-relaxed italic font-serif">"{currentQuote}"</p>
          </div>
          <div className="bg-yellow-50 p-5 rounded-2xl shadow-sm border border-yellow-100 flex-1 flex flex-col min-h-[150px]">
            <div className="flex items-center gap-1.5 mb-2 text-yellow-800 opacity-60">
              <StickyNote size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Scratchpad</span>
            </div>
            <textarea
              className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 text-xs text-gray-700 leading-relaxed font-mono outline-none"
              placeholder="Quick thoughts..."
              value={quickNote}
              onChange={(e) => {
                setQuickNote(e.target.value);
                if (activeNoteId) onUpdateItem(activeNoteId, { content: e.target.value });
              }}
            />
          </div>
        </div>
        <div className="md:col-span-6 flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Activity size={18} className="text-emerald-500" /> Today's Habits
              </h3>
              <span className="text-xl font-bold text-gray-900">{completedHabits}/{habits.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {habits.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No trackers yet. Add one in Vision Mode.</div>}
              {habits.map((habit) => {
                let isDone = false;
                try {
                  isDone = normalizeDayData(JSON.parse(safeContent(habit.content))[today]).status === "done";
                } catch {}
                return (
                  <div
                    key={habit.id}
                    onClick={() => toggleHabit(habit)}
                    className={`p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-gray-50 ${isDone ? "bg-emerald-50/30" : ""}`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"}`}>
                      {isDone && <CheckCircle2 size={12} strokeWidth={4} />}
                    </div>
                    <span className={`font-medium flex-1 text-sm ${isDone ? "text-gray-400 line-through" : "text-gray-700"}`}>{habit.title || "Untitled"}</span>
                    {isDone && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">+20 XP</span>}
                  </div>
                );
              })}
            </div>
            <div className="h-1 w-full bg-gray-100">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex-1">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ListTodo size={18} className="text-blue-500" /> Short Term Goals
            </h3>
            <div className="space-y-2">
              {todoList.length === 0 && <p className="text-sm text-gray-400 italic">No goals set yet.</p>}
              {todoList.map((todo, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="mt-0.5 w-3 h-3 rounded-full border-2 border-blue-200 flex-shrink-0" />
                  <span className="text-xs text-gray-700">{safeContent(todo)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex-1 flex flex-col">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <PenLine size={18} className="text-indigo-500" /> Daily Journal
            </h3>
            <textarea
              className="w-full flex-1 min-h-[120px] p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none text-gray-700 text-sm leading-relaxed font-serif"
              placeholder="Reflect on your day..."
              value={journalText}
              onChange={(e) => {
                setJournalText(e.target.value);
                if (journalItemId) onUpdateItem(journalItemId, { content: e.target.value });
              }}
            />
          </div>
        </div>
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl rotate-3 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3">
              {userLevel}
            </div>
            <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs mb-0.5">{currentLevelInfo.title}</h3>
            <p className="text-[10px] text-gray-400 mb-3">Level {userLevel}</p>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-yellow-400 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, ((userXp - currentLevelInfo.minXp) / (xpForNext - currentLevelInfo.minXp)) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-gray-500">{userXp} / {xpForNext} XP</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Achievements</h4>
            <div className="grid grid-cols-4 gap-1.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`aspect-square rounded-full flex items-center justify-center ${i < userLevel ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-300"}`}>
                  {i < userLevel ? <Trophy size={14} /> : <Lock size={12} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusDashboard;
