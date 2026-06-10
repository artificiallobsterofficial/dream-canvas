import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Type, Image as ImageIcon, Trash2, Maximize, Layers, StickyNote,
  X, Sparkles, Wand2, Loader2, Calendar, ChevronLeft, ChevronRight, CheckCircle2,
  Smile, Link as LinkIcon, MessageCircle, Send, Bot, AlertTriangle, User, RefreshCw, Lightbulb,
  Heart, Star, Flame, BookOpen, Dumbbell, Book, ListTodo, Clock, Trophy, Crown,
  Lock, Zap, Activity, LayoutTemplate, PenLine, Eye, EyeOff, Download, Upload,
  Settings, Plane, Music, Timer
} from "lucide-react";

// ─── Utilities ───
const generateId = () => Math.random().toString(36).substr(2, 9);
const normalizeDayData = (val) => {
  if (!val) return { status: null, event: "" };
  if (typeof val === "object") return { status: val.status || null, event: val.event || "" };
  if (val === true) return { status: "done", event: "" };
  return { status: val, event: "" };
};
const safeContent = (c) => {
  if (c === null || c === undefined) return "";
  if (typeof c === "string") return c;
  if (typeof c === "object") return JSON.stringify(c);
  return String(c);
};
const calculateStreak = (content) => {
  let td = {};
  try { td = JSON.parse(safeContent(content) || "{}"); } catch { return 0; }
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const st = normalizeDayData(td[key]).status;
    if (st === "done") streak++; else if (i === 0) continue; else break;
  }
  return streak;
};

// ─── Constants ───
const COLORS = [
  { bg: "#ffffff", name: "White" }, { bg: "#fef3c7", name: "Warm Paper" },
  { bg: "#dbeafe", name: "Soft Blue" }, { bg: "#fce7f3", name: "Rose" },
  { bg: "#dcfce7", name: "Mint" }, { bg: "#f3f4f6", name: "Grey" }, { bg: "#1f2937", name: "Dark" },
];
const TRACKER_COLORS = ["#10b981","#3b82f6","#8b5cf6","#ec4899","#f97316","#ef4444","#06b6d4","#84cc16","#1f2937"];
const TRACKER_MARKERS = [
  { id: "check", icon: "✔️" }, { id: "heart", icon: "❤️" }, { id: "star", icon: "⭐" },
  { id: "fire", icon: "🔥" }, { id: "gym", icon: "💪" },
];
const STICKER_PACKS = {
  Decor: { stickers: ["✨","📌","📍","🎀","💫","⭐️","🌟","💖","🔥","💎","🌿","🌵","🌸"], levelReq: 1 },
  Mood: { stickers: ["😎","🤩","🧘‍♀️","💪","🧠","👀","💃","🏃‍♀️","✈️","🏝️","🚀","🎯","💰"], levelReq: 1 },
  Tape: { stickers: ["🩹","🟧","🟦","🟩","🟨","⬛️","⬜️"], levelReq: 1 },
  Words: { stickers: ["💯","🆒","🆓","🆗","🆙","🆕","✅","‼️"], levelReq: 2 },
  Luxury: { stickers: ["🥂","🏎️","🏰","💎","⌚","👔","👠","👜"], levelReq: 3 },
};
const LEVELS = [
  { level: 1, title: "Dreamer", minXp: 0 }, { level: 2, title: "Planner", minXp: 100 },
  { level: 3, title: "Doer", minXp: 300 }, { level: 4, title: "Achiever", minXp: 600 },
  { level: 5, title: "Visionary", minXp: 1000 },
];
const TEMPLATES = {
  wellness: {
    name: "That Girl / Wellness",
    items: [
      { type: "tracker", title: "Hydration", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#06b6d4", marker: "heart", zIndex: 1 },
      { type: "tracker", title: "Yoga / Movement", x: 400, y: 80, width: 280, height: 350, content: "{}", color: "#ec4899", marker: "fire", zIndex: 1 },
      { type: "note", content: "My body is a temple.\nI nourish myself with good food and positive thoughts.", x: 80, y: 460, width: 200, height: 200, backgroundColor: "#dcfce7", zIndex: 1 },
      { type: "text", content: "GLOW UP ERA", x: 350, y: 30, width: 400, height: 80, font: "font-serif", color: "#ec4899", zIndex: 1 },
      { type: "sticker", content: "🌿", x: 600, y: 400, width: 80, height: 80, zIndex: 2 },
    ],
    config: { backgroundColor: "#fdf2f8" },
  },
  founder: {
    name: "Tech Founder",
    items: [
      { type: "tracker", title: "Deep Work (4h)", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#3b82f6", marker: "check", zIndex: 1 },
      { type: "goals", content: '{"short":"- Launch MVP\\n- Get 10 users","medium":"- Product Hunt","long":"- $10k MRR"}', x: 400, y: 80, width: 500, height: 300, zIndex: 1 },
      { type: "text", content: "BUILD. SHIP. REPEAT.", x: 350, y: 10, width: 500, height: 70, font: "font-mono", color: "#111827", zIndex: 1 },
    ],
    config: { backgroundColor: "#ffffff" },
  },
  student: {
    name: "4.0 Student",
    items: [
      { type: "tracker", title: "Study Session (2h)", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#8b5cf6", marker: "check", zIndex: 1 },
      { type: "goals", content: '{"short":"- Finish History Paper\\n- Math HW","medium":"- Ace Midterms","long":"- Dream College"}', x: 400, y: 80, width: 500, height: 300, zIndex: 1 },
      { type: "text", content: "KNOWLEDGE IS POWER", x: 300, y: 20, width: 400, height: 70, font: "font-sans", color: "#8b5cf6", zIndex: 1 },
    ],
    config: { backgroundColor: "#f5f3ff" },
  },
  travel: {
    name: "Wanderlust",
    items: [
      { type: "goals", content: '{"short":"- Save $500\\n- Book Flights","medium":"- Japan Trip","long":"- Visit 30 Countries"}', x: 80, y: 80, width: 500, height: 300, zIndex: 1 },
      { type: "note", content: "Packing List:\n- Camera\n- Passport\n- Adapter", x: 620, y: 80, width: 200, height: 250, backgroundColor: "#dbeafe", zIndex: 1 },
      { type: "text", content: "ADVENTURE AWAITS", x: 200, y: 10, width: 500, height: 70, font: "font-sans", color: "#0ea5e9", zIndex: 1 },
      { type: "sticker", content: "✈️", x: 50, y: 20, width: 80, height: 80, zIndex: 2 },
    ],
    config: { backgroundColor: "#f0f9ff" },
  },
  fitness: {
    name: "Iron Body",
    items: [
      { type: "tracker", title: "Gym Session", x: 80, y: 80, width: 280, height: 350, content: "{}", color: "#ef4444", marker: "gym", zIndex: 1 },
      { type: "note", content: "Macros:\nProtein: 180g\nCarbs: 200g\nFats: 60g", x: 400, y: 80, width: 250, height: 250, backgroundColor: "#fee2e2", zIndex: 1 },
      { type: "text", content: "NO PAIN NO GAIN", x: 400, y: 360, width: 400, height: 70, font: "font-mono", color: "#dc2626", zIndex: 1 },
    ],
    config: { backgroundColor: "#fef2f2" },
  },
};
const SUGGESTED_PROMPTS = ["Visualize my dream career", "Quotes for anxiety relief", "Color palette for 'New Beginnings'"];
const DEFAULT_AFFIRMATIONS = [
  "I am attracting abundance into my life.",
  "Every day, I am getting closer to my dreams.",
  "I am capable of achieving anything I set my mind to.",
  "My potential is limitless.",
  "I radiate confidence and positivity.",
];
const LIBRARY_RESOURCES = [
  { category: "Manifestation 101", items: [
    { title: "The 3-6-9 Method", content: "Write your desire 3 times in the morning, 6 times in the afternoon, and 9 times at night." },
    { title: "Visualization Basics", content: "Spend 5 minutes every morning feeling the emotions of having already achieved your goal." },
  ]},
  { category: "Color Psychology", items: [
    { title: "Blue for Calm", content: "Use blue tones to induce serenity, stability, and productivity. Great for career boards." },
    { title: "Yellow for Energy", content: "Yellow evokes happiness, optimism, and creativity. Perfect for fitness or creative goals." },
  ]},
  { category: "Goal Setting", items: [
    { title: "S.M.A.R.T. Goals", content: "Specific, Measurable, Achievable, Relevant, and Time-bound." },
    { title: "Breaking it Down", content: "Take your big yearly goal and break it into quarterly milestones, then monthly actions." },
  ]},
];

// ─── Persistent Storage ───
const StorageService = {
  save: async (data) => {
    try {
      await window.storage.set("dreamcanvas:board", JSON.stringify(data));
      return { success: true };
    } catch { return { success: false }; }
  },
  load: async () => {
    try {
      const res = await window.storage.get("dreamcanvas:board");
      return res ? JSON.parse(res.value) : null;
    } catch { return null; }
  },
};

// ─── AI Service (uses Anthropic API available in artifacts) ───
const callAI = async (prompt, systemPrompt) => {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt || "You are a warm, aesthetic-focused Vision Board Coach. Keep responses concise (under 150 words). Focus on feelings, not just things.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (e) {
    console.error("AI error:", e);
    return null;
  }
};

// ─── Sub-components ───

const ToolbarButton = ({ icon: Icon, label, onClick, active = false, special = false }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-full ${
    active ? "bg-purple-100 text-purple-700" : special ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg" : "hover:bg-gray-100 text-gray-600"
  }`} title={label}>
    <Icon size={special ? 20 : 18} className={special ? "" : "mb-0.5"} />
    {!special && <span className="text-[9px] font-medium leading-tight">{label}</span>}
  </button>
);

const FormatMessage = ({ text }) => {
  if (typeof text !== "string") return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} className="text-purple-600 font-semibold">{part.slice(2, -2)}</strong>
          : part
      )}
    </span>
  );
};

// ─── Board Item ───
const BoardItem = ({ item, isSelected, onSelect, onUpdate, onDayClick, zenMode, onMagicBreakdown }) => {
  const streak = item.type === "tracker" ? calculateStreak(item.content) : 0;
  const showGlow = streak >= 3;

  const handleResizeStart = (e) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, startW = item.width, startH = item.height;
    const onMove = (mv) => onUpdate(item.id, { width: Math.max(60, startW + (mv.clientX - startX)), height: Math.max(60, startH + (mv.clientY - startY)) });
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const renderCalendar = () => {
    let trackedDates = {};
    try { trackedDates = JSON.parse(item.content || "{}"); } catch {}
    const viewDate = new Date(item.viewDate || Date.now());
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const themeColor = item.color || "#10b981";
    const marker = item.marker || "check";
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    const monthlyKeys = Object.keys(trackedDates).filter(k => { const [y,m] = k.split("-").map(Number); return y === year && m === month+1; });
    const doneCount = monthlyKeys.filter(k => normalizeDayData(trackedDates[k]).status === "done").length;
    const progressPct = Math.round((doneCount / daysInMonth) * 100);

    const changeMonth = (offset) => { const nd = new Date(year, month + offset, 1); onUpdate(item.id, { viewDate: nd.getTime() }); };
    const handleDayClick = (day) => {
      const dateKey = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      if (onDayClick && !zenMode) onDayClick(item.id, dateKey, normalizeDayData(trackedDates[dateKey]));
    };
    const getMarkerIcon = () => { const m = TRACKER_MARKERS.find(m => m.id === marker); return m ? m.icon : "✔️"; };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`e${i}`} className="h-7" />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const dayData = normalizeDayData(trackedDates[dateKey]);
      const isDone = dayData.status === "done";
      const isPlanned = dayData.status === "planned";
      days.push(
        <div key={d} onPointerDown={e => { e.stopPropagation(); handleDayClick(d); }}
          className={`h-7 w-7 flex items-center justify-center rounded-full text-xs transition-all select-none ${!zenMode && "cursor-pointer"} ${
            isDone ? "font-bold text-white shadow-sm" : isPlanned ? "font-medium" : !zenMode ? "hover:bg-gray-100 text-gray-500" : "text-gray-500"
          }`}
          style={{
            backgroundColor: isDone ? (marker === "check" ? themeColor : "transparent") : "transparent",
            color: isDone ? (marker === "check" ? "white" : "inherit") : (isPlanned ? themeColor : "inherit"),
            border: isDone && marker !== "check" ? `1px solid ${themeColor}` : isPlanned ? `1px dashed ${themeColor}` : "none",
          }}
        >
          {isDone || isPlanned ? getMarkerIcon() : d}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full w-full select-none text-gray-800">
        <input disabled={zenMode} className="w-full text-center font-bold text-sm bg-transparent border-none outline-none mb-1" style={{ color: themeColor }}
          value={item.title || ""} placeholder="Name your habit..." onChange={e => onUpdate(item.id, { title: e.target.value })} onPointerDown={e => e.stopPropagation()} />
        <div className={`flex items-center justify-between mb-1 pb-1 border-b border-gray-100 ${zenMode ? "hidden" : ""}`}>
          <button onPointerDown={e => { e.stopPropagation(); changeMonth(-1); }} className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400"><ChevronLeft size={14} /></button>
          <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wider">{monthNames[month]} {year}</span>
          <button onPointerDown={e => { e.stopPropagation(); changeMonth(1); }} className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400"><ChevronRight size={14} /></button>
        </div>
        {!zenMode && <div className="grid grid-cols-7 gap-0.5 mb-0.5 text-center text-[9px] text-gray-400 font-bold">{["S","M","T","W","T","F","S"].map((d,i) => <div key={i}>{d}</div>)}</div>}
        <div className="grid grid-cols-7 gap-0.5 place-items-center mb-auto">{days}</div>
        {!zenMode && (
          <div className="mt-1 pt-1 border-t border-gray-100">
            <div className="flex justify-between text-[9px] text-gray-500 mb-0.5"><span>Progress</span><span className="font-bold" style={{ color: themeColor }}>{doneCount}/{daysInMonth}</span></div>
            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden"><div className="h-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: themeColor }} /></div>
          </div>
        )}
      </div>
    );
  };

  const renderGoalColumns = () => {
    let goals = { short: "", medium: "", long: "" };
    try { goals = { ...goals, ...JSON.parse(item.content || "{}") }; } catch {}
    const updateGoalSection = (section, text) => onUpdate(item.id, { content: JSON.stringify({ ...goals, [section]: text }) });
    return (
      <div className="flex h-full gap-1 select-none text-gray-800">
        {["short", "medium", "long"].map((type, idx) => (
          <div key={type} className={`flex-1 flex flex-col min-w-0 ${idx < 2 ? "border-r border-gray-100 pr-1" : "pl-1"}`}>
            <h3 className={`font-bold text-[10px] mb-1 uppercase tracking-wide text-center flex items-center justify-center gap-0.5 ${type==="short"?"text-emerald-600":type==="medium"?"text-blue-600":"text-purple-600"}`}>
              {type==="short"?<CheckCircle2 size={10}/>:type==="medium"?<Calendar size={10}/>:<Star size={10}/>} {type}
            </h3>
            <textarea disabled={zenMode} className="flex-1 w-full bg-transparent resize-none outline-none text-xs p-1 rounded hover:bg-gray-50 focus:bg-white"
              placeholder="- Goal 1..." value={goals[type]} onChange={e => updateGoalSection(type, e.target.value)} onPointerDown={e => e.stopPropagation()} />
          </div>
        ))}
      </div>
    );
  };

  const renderCountdown = () => {
    const [timeLeft, setTimeLeft] = useState(null);
    useEffect(() => {
      if (!item.content) return;
      const iv = setInterval(() => {
        const dist = new Date(item.content).getTime() - Date.now();
        if (dist < 0) setTimeLeft("DONE!");
        else { const d = Math.floor(dist/(1000*60*60*24)), h = Math.floor((dist%(1000*60*60*24))/(1000*60*60)); setTimeLeft(`${d}d ${h}h`); }
      }, 1000);
      return () => clearInterval(iv);
    }, [item.content]);
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 text-center rounded-lg">
        <div className="text-xl font-bold font-mono tracking-widest">{timeLeft || "..."}</div>
        <div className="text-[9px] uppercase tracking-wide opacity-75 mt-1">Until Goal</div>
      </div>
    );
  };

  return (
    <div className={`absolute ${zenMode ? "cursor-default" : "group cursor-move"} select-none touch-none transition-shadow ${
      isSelected && !zenMode ? "ring-2 ring-purple-500 shadow-2xl z-50" : !isSelected && !zenMode ? "hover:ring-1 hover:ring-purple-300" : ""
    }`}
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex || 1, transform: `rotate(${item.rotation || 0}deg)` }}
      onPointerDown={e => { if (!zenMode && !e.target.closest(".ctrl") && !e.target.closest("textarea") && !e.target.closest("input")) onSelect(e, item); }}
    >
      <div className={`w-full h-full overflow-hidden rounded-xl bg-white/80 backdrop-blur-sm shadow-sm border border-white/50 ${showGlow && !zenMode ? "ring-4 ring-yellow-400/50 shadow-xl" : ""}`}>
        {item.type === "image" && <img src={item.content} alt="" className="w-full h-full object-cover rounded-lg" />}
        {item.type === "text" && (
          <div className={`w-full h-full p-2 flex items-center justify-center ${item.font || "font-sans"}`} style={{ color: item.color || "#000", backgroundColor: item.backgroundColor || "transparent", fontSize: `${Math.min(item.height / 2.5, item.width / 6)}px` }}>
            {isSelected && !zenMode
              ? <textarea className="w-full h-full bg-transparent resize-none border-none outline-none text-center leading-tight" value={safeContent(item.content)} onChange={e => onUpdate(item.id, { content: e.target.value })} onPointerDown={e => e.stopPropagation()} autoFocus />
              : <div className="w-full h-full flex items-center justify-center text-center break-words leading-tight whitespace-pre-wrap font-bold">{safeContent(item.content)}</div>}
          </div>
        )}
        {item.type === "note" && (
          <div className="w-full h-full p-3 shadow-md flex flex-col" style={{ backgroundColor: item.backgroundColor || "#fef3c7" }}>
            {isSelected && !zenMode
              ? <textarea className="w-full h-full bg-transparent resize-none border-none outline-none text-gray-800 text-sm" style={{ fontFamily: "'Patrick Hand', cursive" }} value={safeContent(item.content)} onChange={e => onUpdate(item.id, { content: e.target.value })} onPointerDown={e => e.stopPropagation()} placeholder="Type your dreams..." />
              : <div className="w-full h-full overflow-hidden text-gray-800 whitespace-pre-wrap text-sm" style={{ fontFamily: "'Patrick Hand', cursive" }}>{safeContent(item.content) || "Empty Note"}</div>}
          </div>
        )}
        {item.type === "tracker" && <div className="w-full h-full p-3 rounded-xl flex flex-col bg-white/95 backdrop-blur-sm shadow-sm border border-white">{renderCalendar()}</div>}
        {item.type === "goals" && <div className="w-full h-full p-3 rounded-xl flex flex-col bg-white/95 backdrop-blur-sm shadow-sm border border-white">{renderGoalColumns()}</div>}
        {item.type === "sticker" && <div className="w-full h-full flex items-center justify-center pointer-events-none" style={{ fontSize: `${Math.min(item.width, item.height) * 0.8}px`, lineHeight: 1 }}>{safeContent(item.content)}</div>}
        {item.type === "journal" && (
          <div className="w-full h-full p-3 bg-white shadow-sm rounded-xl border-l-4 border-indigo-500 flex flex-col overflow-hidden">
            <h3 className="text-[10px] font-bold text-indigo-500 uppercase mb-1 flex items-center gap-1"><PenLine size={10}/> Journal</h3>
            {isSelected && !zenMode
              ? <textarea className="w-full h-full bg-transparent resize-none border-none outline-none text-xs text-gray-700 leading-relaxed" style={{ fontFamily: "serif" }} value={safeContent(item.content)} onChange={e => onUpdate(item.id, { content: e.target.value })} onPointerDown={e => e.stopPropagation()} placeholder="Write your thoughts..." />
              : <div className="w-full h-full overflow-hidden text-xs text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "serif" }}>{safeContent(item.content) || "Click to write..."}</div>}
          </div>
        )}
        {item.type === "timer" && renderCountdown()}
      </div>
      {isSelected && !zenMode && (
        <>
          <div className="ctrl absolute -right-2 -bottom-2 w-5 h-5 bg-white border-2 border-purple-500 rounded-full cursor-se-resize flex items-center justify-center shadow-md z-50" onPointerDown={handleResizeStart}><Maximize size={10} className="text-purple-500 rotate-90" /></div>
          <button className="ctrl absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 z-50" onPointerDown={e => { e.stopPropagation(); onUpdate(item.id, null); }}><X size={12} /></button>
          {(item.type === "text" || item.type === "goals") && (
            <button className="ctrl absolute -top-2 -left-2 w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-indigo-600 z-50" title="AI Breakdown" onPointerDown={e => { e.stopPropagation(); onMagicBreakdown?.(item); }}>
              <Zap size={12} fill="currentColor" />
            </button>
          )}
        </>
      )}
      {showGlow && !isSelected && !zenMode && <div className="absolute -top-2 -left-2 bg-yellow-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-bounce flex items-center gap-0.5"><Flame size={8} /> {streak}d</div>}
    </div>
  );
};

// ─── Focus Dashboard ───
const FocusDashboard = ({ items, userLevel, userXp, onUpdateItem, onAddItem, onAddXp, levels }) => {
  const [todayKey, setTodayKey] = useState("");
  const [currentQuote, setCurrentQuote] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [journalText, setJournalText] = useState("");
  const [journalItemId, setJournalItemId] = useState(null);

  useEffect(() => {
    const now = new Date();
    setTodayKey(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`);
    const textItems = items.filter(i => i.type === "text");
    setCurrentQuote(textItems.length > 0 ? safeContent(textItems[Math.floor(Math.random() * textItems.length)].content) : "Focus on being productive instead of busy.");
    const noteItems = items.filter(i => i.type === "note");
    if (noteItems.length > 0) { setActiveNoteId(noteItems[noteItems.length-1].id); setQuickNote(safeContent(noteItems[noteItems.length-1].content)); }
    const ji = items.find(i => i.type === "journal");
    if (ji) { setJournalItemId(ji.id); setJournalText(safeContent(ji.content)); }
  }, [items]);

  const toggleHabit = (item) => {
    let td = {}; try { td = JSON.parse(safeContent(item.content) || "{}"); } catch {}
    const newData = { ...td };
    if (newData[todayKey]?.status === "done") delete newData[todayKey];
    else { newData[todayKey] = { status: "done", event: "" }; onAddXp(20); }
    onUpdateItem(item.id, { content: JSON.stringify(newData) });
  };

  const habits = items.filter(i => i.type === "tracker");
  const goalItem = items.find(i => i.type === "goals");
  let todoList = [];
  if (goalItem) { try { const p = JSON.parse(goalItem.content || "{}"); if (p.short) todoList = p.short.split("\n").filter(l => l.trim()); } catch {} }
  const currentLevelInfo = levels.find(l => l.level === userLevel) || levels[0];
  const nextLevelInfo = levels.find(l => l.level === userLevel + 1);
  const xpForNext = nextLevelInfo ? nextLevelInfo.minXp : userXp + 1000;
  const completedHabits = habits.filter(h => { try { return normalizeDayData(JSON.parse(safeContent(h.content) || "{}")[todayKey]).status === "done"; } catch { return false; } }).length;
  const progressPercent = habits.length === 0 ? 0 : Math.round((completedHabits / habits.length) * 100);

  return (
    <div className="flex-1 bg-gray-50 p-4 md:p-6 overflow-y-auto flex justify-center">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">{new Date().getDate()}</h2>
            <p className="text-gray-500 uppercase tracking-widest text-[10px] font-bold mb-3">{new Date().toLocaleDateString("en-US", { month: "long", weekday: "long" })}</p>
            <div className="h-1 w-8 bg-purple-500 rounded-full" />
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-md text-white">
            <div className="flex items-center gap-1.5 mb-2 opacity-80"><Zap size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">Daily Signal</span></div>
            <p className="text-sm leading-relaxed italic" style={{ fontFamily: "serif" }}>"{currentQuote}"</p>
          </div>
          <div className="bg-yellow-50 p-5 rounded-2xl shadow-sm border border-yellow-100 flex-1 flex flex-col min-h-[150px]">
            <div className="flex items-center gap-1.5 mb-2 text-yellow-800 opacity-60"><StickyNote size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">Scratchpad</span></div>
            <textarea className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 text-xs text-gray-700 leading-relaxed font-mono outline-none" placeholder="Quick thoughts..." value={quickNote} onChange={e => { setQuickNote(e.target.value); if (activeNoteId) onUpdateItem(activeNoteId, { content: e.target.value }); }} />
          </div>
        </div>
        <div className="md:col-span-6 flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Activity size={18} className="text-emerald-500" /> Today's Habits</h3>
              <span className="text-xl font-bold text-gray-900">{completedHabits}/{habits.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {habits.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No trackers yet. Add one in Vision Mode.</div>}
              {habits.map(habit => {
                let isDone = false; try { isDone = normalizeDayData(JSON.parse(safeContent(habit.content))[todayKey]).status === "done"; } catch {}
                return (
                  <div key={habit.id} onClick={() => toggleHabit(habit)} className={`p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-gray-50 ${isDone ? "bg-emerald-50/30" : ""}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"}`}>{isDone && <CheckCircle2 size={12} strokeWidth={4} />}</div>
                    <span className={`font-medium flex-1 text-sm ${isDone ? "text-gray-400 line-through" : "text-gray-700"}`}>{habit.title || "Untitled"}</span>
                    {isDone && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">+20 XP</span>}
                  </div>
                );
              })}
            </div>
            <div className="h-1 w-full bg-gray-100"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} /></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex-1">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><ListTodo size={18} className="text-blue-500" /> Short Term Goals</h3>
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
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><PenLine size={18} className="text-indigo-500" /> Daily Journal</h3>
            <textarea className="w-full flex-1 min-h-[120px] p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none text-gray-700 text-sm leading-relaxed" style={{ fontFamily: "serif" }} placeholder="Reflect on your day..." value={journalText} onChange={e => { setJournalText(e.target.value); if (journalItemId) onUpdateItem(journalItemId, { content: e.target.value }); }} />
          </div>
        </div>
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl rotate-3 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3">{userLevel}</div>
            <h3 className="font-bold text-gray-900 uppercase tracking-widest text-xs mb-0.5">{currentLevelInfo.title}</h3>
            <p className="text-[10px] text-gray-400 mb-3">Level {userLevel}</p>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-1"><div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, ((userXp - currentLevelInfo.minXp) / (xpForNext - currentLevelInfo.minXp)) * 100))}%` }} /></div>
            <p className="text-[10px] font-mono text-gray-500">{userXp} / {xpForNext} XP</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Achievements</h4>
            <div className="grid grid-cols-4 gap-1.5">
              {[...Array(8)].map((_, i) => <div key={i} className={`aspect-square rounded-full flex items-center justify-center ${i < userLevel ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-300"}`}>{i < userLevel ? <Trophy size={14} /> : <Lock size={12} />}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ───
export default function DreamCanvas() {
  const [userXp, setUserXp] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [xpNotif, setXpNotif] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [boardConfig, setBoardConfig] = useState({ backgroundColor: "#f3f4f6" });
  const [dragState, setDragState] = useState({ isDragging: false });
  const [viewMode, setViewMode] = useState("vision");
  const [zenMode, setZenMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Modals
  const [showImageModal, setShowImageModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [calendarModalData, setCalendarModalData] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [stickerTab, setStickerTab] = useState("stickers");
  const [aiTab, setAiTab] = useState("affirmation");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [chatHistory, setChatHistory] = useState([{ role: "assistant", text: "Hi! I'm your Vision Coach ✨ What big dream are you working on? I can help with goals, affirmations, or ideas!" }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const boardRef = useRef(null);

  // ─ Properties Panel State (for selected item) ─
  const selectedItem = items.find(i => i.id === selectedId);

  // ─ Load data on mount ─
  useEffect(() => {
    StorageService.load().then(data => {
      if (data) {
        setItems(data.items || []);
        setBoardConfig(data.boardConfig || { backgroundColor: "#f3f4f6" });
        setUserXp(data.profile?.xp || 0);
        setUserLevel(data.profile?.level || 1);
      }
      setLoaded(true);
    });
  }, []);

  // ─ Auto-save ─
  useEffect(() => {
    if (!loaded) return;
    StorageService.save({ profile: { xp: userXp, level: userLevel }, items, boardConfig, lastActive: Date.now() });
  }, [items, boardConfig, userXp, userLevel, loaded]);

  // ─ XP + Leveling ─
  const addXp = (amount) => {
    let newLevel = userLevel;
    for (let i = LEVELS.length - 1; i >= 0; i--) { if ((userXp + amount) >= LEVELS[i].minXp) { newLevel = LEVELS[i].level; break; } }
    setUserXp(prev => prev + amount);
    setXpNotif(`+${amount} XP`);
    if (newLevel > userLevel) { setUserLevel(newLevel); setXpNotif(`🎉 LEVEL UP! ${LEVELS.find(l => l.level === newLevel).title}!`); }
    setTimeout(() => setXpNotif(null), 2500);
  };

  // ─ Drag ─
  useEffect(() => {
    const handleUp = () => { if (dragState.isDragging) setDragState({ isDragging: false }); };
    const handleMove = (e) => {
      if (!dragState.isDragging) return;
      e.preventDefault();
      const cx = e.clientX ?? e.touches?.[0]?.clientX, cy = e.clientY ?? e.touches?.[0]?.clientY;
      if (cx == null) return;
      const dx = cx - dragState.startX, dy = cy - dragState.startY;
      setItems(prev => prev.map(i => i.id === dragState.id ? { ...i, x: dragState.ix + dx, y: dragState.iy + dy } : i));
    };
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointermove", handleMove);
    return () => { window.removeEventListener("pointerup", handleUp); window.removeEventListener("pointermove", handleMove); };
  }, [dragState]);

  // ─ Add Item ─
  const addItem = (type, content = "", extraProps = {}) => {
    const br = boardRef.current?.getBoundingClientRect();
    const cx = br ? br.width / 2 - 100 : 300, cy = br ? br.height / 2 - 80 : 200;
    const off = Math.random() * 40 - 20;
    const w = type === "note" ? 200 : type === "sticker" ? 80 : type === "goals" ? 480 : type === "journal" ? 350 : type === "timer" ? 180 : 220;
    const h = type === "note" ? 200 : type === "sticker" ? 80 : type === "goals" ? 280 : type === "journal" ? 400 : type === "tracker" ? 340 : type === "timer" ? 120 : 120;
    const newItem = { id: generateId(), type, content, x: cx + off, y: cy + off, width: w, height: h, zIndex: items.length + 1, rotation: type === "sticker" ? Math.random() * 20 - 10 : 0, ...extraProps };
    setItems(prev => [...prev, newItem]);
    setSelectedId(newItem.id);
    addXp(10);
    setShowAddMenu(false);
    return newItem;
  };

  const handleUpdateItem = (id, updates) => {
    if (updates === null) { setItems(prev => prev.filter(i => i.id !== id)); setSelectedId(null); }
    else setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const handleDayUpdate = (itemId, dateKey, newData) => {
    const item = items.find(i => i.id === itemId); if (!item) return;
    let td = {}; try { td = JSON.parse(item.content || "{}"); } catch {}
    if (!newData.status && !newData.event) delete td[dateKey]; else td[dateKey] = newData;
    if (newData.status === "done") addXp(20); else if (newData.status === "planned") addXp(5);
    handleUpdateItem(itemId, { content: JSON.stringify(td) });
  };

  const handlePointerDownItem = (e, item) => {
    e.stopPropagation();
    setSelectedId(item.id);
    const maxZ = Math.max(...items.map(i => i.zIndex || 0), 0);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, zIndex: maxZ + 1 } : i));
    setDragState({ isDragging: true, id: item.id, startX: e.clientX, startY: e.clientY, ix: item.x, iy: item.y });
  };

  const handleAddUrlImage = (url) => { if (url) { addItem("image", url); setImageUrlInput(""); setShowImageModal(false); } };

  const requestClearBoard = () => {
    setConfirmModal({ isOpen: true, message: "Clear your entire vision board? This cannot be undone.", onConfirm: () => { setItems([]); setBoardConfig({ backgroundColor: "#f3f4f6" }); setConfirmModal({ isOpen: false }); } });
  };

  const applyTemplate = (key) => {
    const apply = () => {
      const tpl = TEMPLATES[key];
      setItems(tpl.items.map(i => ({ ...i, id: generateId() })));
      setBoardConfig(tpl.config);
      setShowTemplateModal(false);
      addXp(50);
      setConfirmModal({ isOpen: false });
    };
    if (items.length > 0) setConfirmModal({ isOpen: true, message: "This will replace your current board. Continue?", onConfirm: apply });
    else apply();
  };

  const handleExport = () => {
    const data = { profile: { xp: userXp, level: userLevel }, items, boardConfig };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `dreamcanvas_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── AI Handlers ───
  const handleGenerateAffirmations = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    const text = await callAI(
      `Generate 3 short, powerful, first-person positive affirmations about "${aiPrompt}". Return ONLY a JSON array of strings, no other text.`,
      "You generate affirmations. Return ONLY valid JSON arrays of strings. No markdown, no explanation."
    );
    if (text) {
      try {
        const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
        setAiResults(JSON.parse(clean));
      } catch { setAiResults([text.slice(0, 120)]); }
    } else {
      // Fallback to local generation
      setAiResults([
        `I am attracting ${aiPrompt} into my life with ease.`,
        `Every day brings me closer to ${aiPrompt}.`,
        `I am worthy of ${aiPrompt} and I receive it now.`,
      ]);
    }
    setIsAiLoading(false);
  };

  const handleSendChat = async (overridePrompt) => {
    const text = overridePrompt || chatInput;
    if (!text.trim()) return;
    const userMsg = { role: "user", text };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatLoading(true);
    const aiText = await callAI(
      newHistory.map(m => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`).join("\n") + "\nCoach:",
      "You are a warm, aesthetic-focused Vision Board Coach. Help with goals, visualization, affirmations. Keep responses under 120 words. Be encouraging and specific."
    );
    if (aiText) {
      setChatHistory(prev => [...prev, { role: "assistant", text: aiText }]);
      addXp(5);
    } else {
      // Fallback
      setChatHistory(prev => [...prev, { role: "assistant", text: "That's a wonderful goal! Try breaking it into 3 small steps you can take this week. Visualize how you'll feel when you achieve it. What's the first tiny action you could take today? 💫" }]);
    }
    setIsChatLoading(false);
  };

  const handleMagicBreakdown = async (item) => {
    const content = safeContent(item.content);
    if (!content) return;
    const text = await callAI(
      `Break down the goal "${content}" into 3-4 short actionable steps. Return only the bulleted list, nothing else.`,
      "You are a goal-planning assistant. Be concise and actionable."
    );
    const steps = text || `• Research and plan for "${content}"\n• Set a deadline and milestones\n• Take the first small step today\n• Track your progress daily`;
    addItem("note", `Steps for ${content.slice(0,30)}…\n\n${steps}`, { x: item.x + 40, y: item.y + 40, backgroundColor: "#dbeafe" });
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, isChatLoading]);

  // ─── Board visual brightness based on completion ───
  const trackers = items.filter(i => i.type === "tracker");
  const completionRate = trackers.reduce((acc, item) => {
    try {
      const now = new Date();
      const key = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
      const data = JSON.parse(item.content || "{}");
      return acc + (normalizeDayData(data[key]).status === "done" ? 1 : 0);
    } catch { return acc; }
  }, 0) / (trackers.length || 1);
  const boardBrightness = 0.92 + completionRate * 0.15;

  const currentLevelInfo = LEVELS.find(l => l.level === userLevel) || LEVELS[0];
  const nextLevelInfo = LEVELS.find(l => l.level === userLevel + 1);
  const xpForNext = nextLevelInfo ? nextLevelInfo.minXp : userXp + 1000;
  const progressPercent = Math.min(100, Math.max(0, ((userXp - currentLevelInfo.minXp) / (xpForNext - currentLevelInfo.minXp)) * 100));

  if (!loaded) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-purple-500" size={32} /></div>;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* HEADER */}
      <header className={`flex-none bg-white border-b border-gray-200 z-20 px-4 h-14 flex items-center justify-between shadow-sm transition-transform ${zenMode ? "-translate-y-full absolute w-full" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-purple-600 to-blue-500 p-1.5 rounded-lg text-white"><Layers size={18} /></div>
          <h1 className="text-base font-bold text-gray-900 leading-none">DreamCanvas</h1>
          <div className="h-5 w-px bg-gray-200 mx-1" />
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            <button onClick={() => setViewMode("vision")} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${viewMode === "vision" ? "bg-white shadow-sm text-purple-600" : "text-gray-500"}`}>Vision</button>
            <button onClick={() => setViewMode("focus")} className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${viewMode === "focus" ? "bg-white shadow-sm text-emerald-600" : "text-gray-500"}`}>Focus</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {xpNotif && <div className="animate-bounce text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{xpNotif}</div>}
          {/* XP bar */}
          <div className="hidden md:flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            <Crown size={12} className="text-yellow-500" />
            <span className="text-[10px] font-bold text-gray-600">Lv{userLevel}</span>
            <div className="w-16 h-1 bg-gray-200 rounded-full"><div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${progressPercent}%` }} /></div>
            <span className="text-[10px] text-gray-400">{userXp}xp</span>
          </div>
          <button onClick={handleExport} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Export"><Download size={16} /></button>
          <button onClick={requestClearBoard} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Clear"><Trash2 size={16} /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Zen Mode Toggle */}
        {viewMode === "vision" && (
          <button onClick={() => setZenMode(!zenMode)} className={`absolute top-3 right-3 z-50 p-1.5 rounded-full shadow-lg transition-all ${zenMode ? "bg-gray-900 text-white opacity-40 hover:opacity-100" : "bg-white text-gray-400 hover:text-purple-600"}`} title="Zen Mode">
            {zenMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {viewMode === "focus" ? (
          <FocusDashboard items={items} userLevel={userLevel} userXp={userXp} onUpdateItem={handleUpdateItem} onAddItem={addItem} onAddXp={addXp} levels={LEVELS} />
        ) : (
          <>
            {/* TOOLBAR */}
            <div className={`w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-2 shadow-sm z-20 transition-transform ${zenMode ? "-translate-x-full absolute h-full" : ""}`}>
              <ToolbarButton icon={Plus} label="Add" onClick={() => setShowAddMenu(!showAddMenu)} active={showAddMenu} />
              {showAddMenu && (
                <div className="absolute left-14 top-3 bg-white border shadow-xl rounded-xl p-2 grid gap-1 w-44 z-50 ml-1">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-2">Basics</div>
                  <button onClick={() => addItem("text", "GOAL")} className="text-left p-1.5 hover:bg-purple-50 rounded text-xs flex gap-2 text-gray-700"><Type size={14}/> Text</button>
                  <button onClick={() => addItem("note", "Note...", { backgroundColor: "#fef3c7" })} className="text-left p-1.5 hover:bg-yellow-50 rounded text-xs flex gap-2 text-gray-700"><StickyNote size={14}/> Sticky Note</button>
                  <button onClick={() => { setShowImageModal(true); setShowAddMenu(false); }} className="text-left p-1.5 hover:bg-gray-100 rounded text-xs flex gap-2 text-gray-700"><LinkIcon size={14}/> Image URL</button>
                  <div className="h-px bg-gray-100 my-0.5" />
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-2">Productivity</div>
                  <button onClick={() => addItem("goals", "{}")} className="text-left p-1.5 hover:bg-blue-50 rounded text-xs flex gap-2 text-gray-700"><ListTodo size={14}/> Goal List</button>
                  <button onClick={() => addItem("tracker", "{}", { width: 280, height: 340 })} className="text-left p-1.5 hover:bg-emerald-50 rounded text-xs flex gap-2 text-gray-700"><Calendar size={14}/> Habit Tracker</button>
                  <button onClick={() => addItem("journal", "Dear Diary...")} className="text-left p-1.5 hover:bg-indigo-50 rounded text-xs flex gap-2 text-gray-700"><PenLine size={14}/> Journal</button>
                  <div className="h-px bg-gray-100 my-0.5" />
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-2">Widgets</div>
                  <button onClick={() => addItem("timer", new Date(Date.now() + 86400000 * 7).toISOString())} className="text-left p-1.5 hover:bg-orange-50 rounded text-xs flex gap-2 text-gray-700"><Timer size={14}/> Countdown</button>
                </div>
              )}
              <div className="w-8 h-px bg-gray-200 my-1" />
              <ToolbarButton icon={LayoutTemplate} label="Templates" onClick={() => setShowTemplateModal(true)} />
              <ToolbarButton icon={Sparkles} label="AI" onClick={() => { setShowAIModal(true); setAiPrompt(""); setAiResults(null); }} />
              <ToolbarButton icon={MessageCircle} label="Coach" onClick={() => setShowChatModal(true)} />
              <ToolbarButton icon={Smile} label="Stickers" onClick={() => setShowStickerModal(true)} />
              <ToolbarButton icon={BookOpen} label="Library" onClick={() => setShowLibraryModal(true)} />
              <div className="w-8 h-px bg-gray-200 my-1" />
              <ToolbarButton icon={Settings} label="Settings" onClick={() => setShowSettingsModal(true)} />
            </div>

            {/* CANVAS */}
            <div ref={boardRef} className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing transition-all"
              style={{ backgroundColor: boardConfig.backgroundColor, backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "20px 20px", touchAction: "none", filter: `brightness(${boardBrightness})` }}
              onPointerDown={e => { if (e.target === boardRef.current) { setSelectedId(null); setShowAddMenu(false); } }}
            >
              {items.map(item => (
                <BoardItem key={item.id} item={item} isSelected={selectedId === item.id} onSelect={handlePointerDownItem} onUpdate={handleUpdateItem}
                  onDayClick={(itemId, dateStr, data) => setCalendarModalData({ itemId, dateStr, data })} zenMode={zenMode} onMagicBreakdown={handleMagicBreakdown} />
              ))}
              {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                  <div className="text-center">
                    <Layers size={48} className="mx-auto mb-3 text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-400 mb-1">Create Your Vision</h2>
                    <p className="text-gray-400 text-sm">Click + to add widgets, or pick a template</p>
                  </div>
                </div>
              )}
            </div>

            {/* PROPERTIES PANEL */}
            {selectedItem && !calendarModalData && !zenMode && (
              <div className="absolute top-3 right-12 w-56 bg-white/95 backdrop-blur rounded-xl shadow-xl border border-gray-200 p-3 z-30 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Edit {selectedItem.type}</span><button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button></div>
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => handleUpdateItem(selectedItem.id, { zIndex: (selectedItem.zIndex||0) + 10 })} className="flex-1 text-[10px] bg-gray-100 hover:bg-gray-200 py-1.5 rounded text-gray-700">Forward</button>
                    <button onClick={() => handleUpdateItem(selectedItem.id, { zIndex: Math.max(0, (selectedItem.zIndex||0) - 10) })} className="flex-1 text-[10px] bg-gray-100 hover:bg-gray-200 py-1.5 rounded text-gray-700">Backward</button>
                  </div>
                  {selectedItem.type === "text" && (
                    <div><label className="text-[10px] text-gray-500 block mb-1">Color</label><div className="flex flex-wrap gap-1.5">
                      {["#000000","#ffffff","#ef4444","#3b82f6","#10b981","#a855f7","#ec4899","#f97316"].map(c => (
                        <button key={c} onClick={() => handleUpdateItem(selectedItem.id, { color: c })} className={`w-5 h-5 rounded-full border border-gray-200 ${selectedItem.color === c ? "ring-2 ring-purple-500 ring-offset-1" : ""}`} style={{ backgroundColor: c }} />
                      ))}
                    </div></div>
                  )}
                  {selectedItem.type === "note" && (
                    <div><label className="text-[10px] text-gray-500 block mb-1">Note Color</label><div className="flex flex-wrap gap-1.5">
                      {["#fef3c7","#dbeafe","#fce7f3","#dcfce7","#f3f4f6","#ccfbf1","#fef2f2"].map(c => (
                        <button key={c} onClick={() => handleUpdateItem(selectedItem.id, { backgroundColor: c })} className={`w-5 h-5 rounded-full border border-gray-200 ${selectedItem.backgroundColor === c ? "ring-2 ring-purple-500 ring-offset-1" : ""}`} style={{ backgroundColor: c }} />
                      ))}
                    </div></div>
                  )}
                  {selectedItem.type === "tracker" && (
                    <>
                      <div><label className="text-[10px] text-gray-500 block mb-1">Theme</label><div className="flex flex-wrap gap-1.5">
                        {TRACKER_COLORS.map(c => <button key={c} onClick={() => handleUpdateItem(selectedItem.id, { color: c })} className={`w-5 h-5 rounded-full border border-gray-200 ${selectedItem.color === c ? "ring-2 ring-purple-500 ring-offset-1" : ""}`} style={{ backgroundColor: c }} />)}
                      </div></div>
                      <div><label className="text-[10px] text-gray-500 block mb-1">Marker</label><div className="flex gap-1.5">
                        {TRACKER_MARKERS.map(m => <button key={m.id} onClick={() => handleUpdateItem(selectedItem.id, { marker: m.id })} className={`p-1 rounded border ${selectedItem.marker === m.id ? "border-purple-500 bg-purple-50" : "border-gray-200"}`}>{m.icon}</button>)}
                      </div></div>
                    </>
                  )}
                  {selectedItem.type === "timer" && (
                    <div><label className="text-[10px] text-gray-500 block mb-1">Target Date</label>
                      <input type="date" className="w-full text-xs border border-gray-300 rounded p-1" value={selectedItem.content?.slice(0,10) || ""} onChange={e => handleUpdateItem(selectedItem.id, { content: new Date(e.target.value).toISOString() })} onPointerDown={e => e.stopPropagation()} />
                    </div>
                  )}
                  <button onClick={() => handleUpdateItem(selectedItem.id, null)} className="w-full flex items-center justify-center gap-1 text-red-600 bg-red-50 hover:bg-red-100 py-1.5 rounded-lg text-xs mt-1"><Trash2 size={12} /> Remove</button>
                </div>
              </div>
            )}

            {/* ─── MODALS ─── */}

            {/* Settings */}
            {showSettingsModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-900 flex items-center gap-2"><Settings size={18}/> Settings</h3><button onClick={() => setShowSettingsModal(false)}><X size={18} className="text-gray-400" /></button></div>
                  <div className="space-y-5">
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Background Color</label>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {COLORS.map(c => <button key={c.name} onClick={() => setBoardConfig({ ...boardConfig, backgroundColor: c.bg })} className={`w-7 h-7 rounded-full border border-gray-300 shadow-sm hover:scale-110 transition-transform ${boardConfig.backgroundColor === c.bg ? "ring-2 ring-purple-500 ring-offset-2" : ""}`} style={{ backgroundColor: c.bg }} title={c.name} />)}
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-3">
                      <button onClick={() => { requestClearBoard(); setShowSettingsModal(false); }} className="w-full py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-medium flex items-center justify-center gap-1"><Trash2 size={14}/> Clear Entire Board</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Confirm Modal */}
            {confirmModal.isOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5">
                  <div className="flex flex-col items-center text-center mb-4">
                    <div className="bg-orange-100 text-orange-600 p-2 rounded-full mb-2"><AlertTriangle size={20} /></div>
                    <h3 className="font-bold text-gray-900">Are you sure?</h3>
                    <p className="text-xs text-gray-500 mt-1">{confirmModal.message}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmModal({ isOpen: false })} className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
                    <button onClick={confirmModal.onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Confirm</button>
                  </div>
                </div>
              </div>
            )}

            {/* Template Modal */}
            {showTemplateModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2"><LayoutTemplate size={20} /><h3 className="text-lg font-bold">Start with a Template</h3></div>
                    <button onClick={() => setShowTemplateModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button>
                  </div>
                  <div className="p-6 grid md:grid-cols-3 gap-4 overflow-y-auto bg-gray-50/50">
                    {Object.entries(TEMPLATES).map(([key, tpl]) => (
                      <button key={key} onClick={() => applyTemplate(key)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-violet-300 transition-all text-left group">
                        <div className={`w-10 h-10 rounded-full mb-3 flex items-center justify-center text-white shadow-md ${key==="wellness"?"bg-cyan-500":key==="founder"?"bg-blue-600":key==="student"?"bg-purple-500":key==="travel"?"bg-sky-500":"bg-red-500"}`}>
                          {key==="wellness"?<Heart size={18}/>:key==="founder"?<Zap size={18}/>:key==="student"?<Book size={18}/>:key==="travel"?<Plane size={18}/>:<Dumbbell size={18}/>}
                        </div>
                        <h4 className="font-bold text-gray-900 mb-1">{tpl.name}</h4>
                        <p className="text-xs text-gray-500 mb-3">Pre-configured trackers, quotes & goals.</p>
                        <div className="text-violet-600 text-xs font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">Use <ChevronRight size={12}/></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Calendar Day Modal */}
            {calendarModalData && (() => {
              const { itemId, dateStr, data } = calendarModalData;
              const updateStatus = (status) => { const nd = { ...data, status: data.status === status ? null : status }; handleDayUpdate(itemId, dateStr, nd); setCalendarModalData({ ...calendarModalData, data: nd }); };
              const updateEvent = (text) => { const nd = { ...data, event: text }; handleDayUpdate(itemId, dateStr, nd); setCalendarModalData({ ...calendarModalData, data: nd }); };
              return (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4">
                    <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-gray-800 flex items-center gap-1.5"><Clock size={16} className="text-purple-500" />{dateStr}</h3><button onClick={() => setCalendarModalData(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded-full"><X size={18} /></button></div>
                    <div className="space-y-3">
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Status</label>
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus("done")} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${data.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}><CheckCircle2 size={14} /> Done</button>
                          <button onClick={() => updateStatus("planned")} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${data.status === "planned" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}><Calendar size={14} /> Planned</button>
                        </div>
                      </div>
                      <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Note</label>
                        <textarea className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 outline-none resize-none h-16" placeholder="Add details..." value={data.event} onChange={e => updateEvent(e.target.value)} />
                      </div>
                      <button onClick={() => setCalendarModalData(null)} className="w-full py-1.5 bg-gray-900 text-white rounded-lg hover:bg-black text-xs font-medium">Save & Close</button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Image URL Modal */}
            {showImageModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5">
                  <h3 className="font-bold mb-3">Add Image from URL</h3>
                  <input type="text" placeholder="Paste image address..." className="w-full border border-gray-300 rounded-lg p-2.5 mb-3 focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} autoFocus />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowImageModal(false)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
                    <button onClick={() => handleAddUrlImage(imageUrlInput)} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">Add</button>
                  </div>
                </div>
              </div>
            )}

            {/* Sticker Modal */}
            {showStickerModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-3 text-white flex justify-between items-center"><div className="flex items-center gap-2"><Smile size={18} /><h3 className="font-bold">Stickers</h3></div><button onClick={() => setShowStickerModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button></div>
                  <div className="p-4 overflow-y-auto">
                    <div className="space-y-4">
                      {Object.entries(STICKER_PACKS).map(([category, pack]) => {
                        const isLocked = userLevel < pack.levelReq;
                        return (
                          <div key={category} className={isLocked ? "opacity-50 grayscale" : ""}>
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex justify-between">{category} {isLocked && <span className="text-pink-500 flex items-center gap-0.5"><Lock size={9} /> Lv{pack.levelReq}</span>}</h4>
                            <div className="grid grid-cols-7 gap-1">
                              {pack.stickers.map((emoji, idx) => (
                                <button key={idx} onClick={() => { if (!isLocked) { addItem("sticker", emoji); setShowStickerModal(false); } }} disabled={isLocked}
                                  className={`text-2xl p-1.5 rounded-lg transition-transform ${isLocked ? "cursor-not-allowed" : "hover:bg-gray-100 hover:scale-125"}`}>{emoji}</button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Library Modal */}
            {showLibraryModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-3 text-white flex justify-between items-center"><div className="flex items-center gap-2"><BookOpen size={18} /><h3 className="font-bold">Learning Library</h3></div><button onClick={() => setShowLibraryModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button></div>
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <div className="space-y-6">
                      {LIBRARY_RESOURCES.map((cat, idx) => (
                        <div key={idx}>
                          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Book size={12} /> {cat.category}</h3>
                          <div className="grid md:grid-cols-2 gap-3">
                            {cat.items.map((item, i) => (
                              <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                <h4 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-teal-600">{item.title}</h4>
                                <p className="text-xs text-gray-600 leading-relaxed mb-2">{item.content}</p>
                                <div className="flex gap-2">
                                  <button onClick={() => { setShowLibraryModal(false); setShowChatModal(true); handleSendChat(`Tell me more about ${item.title}...`); }} className="text-[10px] font-medium text-teal-600 hover:bg-teal-50 px-1.5 py-0.5 rounded">Ask Coach</button>
                                  <button onClick={() => { addItem("note", `${item.title}:\n${item.content}`, { backgroundColor: "#ccfbf1" }); setShowLibraryModal(false); }} className="text-[10px] font-medium text-gray-500 hover:bg-gray-100 px-1.5 py-0.5 rounded">Add to Board</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Modal */}
            {showChatModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[550px] max-h-[88vh]">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-2"><div className="bg-white/20 p-1.5 rounded-full"><Bot size={18} /></div><div><h3 className="text-sm font-bold">Goal Coach AI</h3><p className="text-[9px] text-blue-100 uppercase tracking-wider">Powered by Claude</p></div></div>
                    <div className="flex gap-1"><button onClick={() => setChatHistory([{ role: "assistant", text: "Hi! I'm your Vision Coach ✨ What big dream are you working on?" }])} className="hover:bg-white/20 p-1.5 rounded-full"><RefreshCw size={16} /></button><button onClick={() => setShowChatModal(false)} className="hover:bg-white/20 p-1.5 rounded-full"><X size={16} /></button></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role !== "user" && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white mt-0.5"><Bot size={12} /></div>}
                        <div className={`max-w-[80%] p-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"}`}>
                          <FormatMessage text={typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text)} />
                        </div>
                        {msg.role === "user" && <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600 mt-0.5"><User size={12} /></div>}
                      </div>
                    ))}
                    {isChatLoading && <div className="flex gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white"><Bot size={12} /></div><div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} /><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} /></div></div>}
                    {chatHistory.length === 1 && !isChatLoading && (
                      <div className="grid gap-1.5 mt-3 px-1">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-0.5"><Lightbulb size={10} /> Try asking...</p>
                        {SUGGESTED_PROMPTS.map((prompt, i) => <button key={i} onClick={() => handleSendChat(prompt)} className="text-left text-xs p-2.5 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all">{prompt}</button>)}
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 bg-white border-t border-gray-200">
                    <div className="flex gap-2 relative">
                      <input type="text" placeholder="Ask for vision board ideas..." className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none pr-10" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !isChatLoading && handleSendChat()} disabled={isChatLoading} />
                      <button onClick={() => handleSendChat()} disabled={isChatLoading || !chatInput.trim()} className="absolute right-1 top-1 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50"><Send size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Modal */}
            {showAIModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 text-white flex justify-between items-center"><div className="flex items-center gap-2"><Sparkles size={18} /><h3 className="font-bold">AI Creative Assistant</h3></div><button onClick={() => setShowAIModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={18} /></button></div>
                  <div className="p-5 overflow-y-auto">
                    <div className="space-y-3">
                      {!aiResults ? (
                        <>
                          <p className="text-xs text-gray-500">Enter a goal or feeling to generate personalized affirmations.</p>
                          <input type="text" placeholder="e.g., career success, inner peace, fitness..." className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 outline-none text-sm" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && handleGenerateAffirmations()} autoFocus />
                          <button onClick={handleGenerateAffirmations} disabled={isAiLoading || !aiPrompt} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                            {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />} {isAiLoading ? "Thinking..." : "Inspire Me"}
                          </button>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-700">Click one to add to your board:</p>
                          {aiResults.map((text, idx) => (
                            <button key={idx} onClick={() => { addItem("note", typeof text === "string" ? text : String(text), { backgroundColor: "#dbeafe" }); setShowAIModal(false); setAiResults(null); }}
                              className="w-full text-left p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg text-indigo-900 font-medium text-xs">
                              "{typeof text === "string" ? text : String(text)}"
                            </button>
                          ))}
                          <button onClick={() => setAiResults(null)} className="w-full py-1.5 text-gray-400 text-xs hover:text-gray-600">Try again</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
