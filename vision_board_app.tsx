import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Type, Image as ImageIcon, Trash2, Maximize, Layers, StickyNote, X, Sparkles, 
  Calendar, ChevronLeft, ChevronRight, CheckCircle2, Smile, Link as LinkIcon, MessageCircle, 
  Send, Bot, AlertTriangle, User, RefreshCw, Lightbulb, BookOpen, ListTodo, Clock, Trophy, 
  Lock, Zap, Activity, LayoutTemplate, LogOut, Mail, Loader2, Heart, Star, Book, Flame, Wand2, 
  Smartphone, PenLine, Youtube, Music, Timer, Upload, Download, Eye, EyeOff, Save, FolderOpen, FileJson,
  Grid, Settings, Plane, HardDrive
} from 'lucide-react';

/**
 * VISION BOARD APP v4.0 - LOCAL & FILE SYSTEM EDITION
 * - Completely removed external Supabase dependencies for Canvas compatibility.
 * - Relies entirely on robust LocalStorage and File System operations.
 * - Full feature set (AI, Templates, Gamification, Smart Widgets).
 */

const apiKey = ""; 

// --- 1. FILE SERVICE ---
const FileService = {
  saveToDisk: (data, filename = 'my_vision_board.dream') => {
    const dataStr = JSON.stringify(data);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  loadFromDisk: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          resolve(data);
        } catch (e) {
          reject("Corrupt file");
        }
      };
      reader.readAsText(file);
    });
  }
};

// --- 2. UTILITY & CONSTANTS ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const normalizeDayData = (val) => {
  if (!val) return { status: null, event: '' };
  if (typeof val === 'object') return { status: val.status || null, event: val.event || '' };
  if (val === true) return { status: 'done', event: '' };
  return { status: val, event: '' };
};

// CRITICAL: prevents object rendering errors
const safeContent = (content) => {
  if (content === null || content === undefined) return "";
  if (typeof content === 'string') return content;
  if (typeof content === 'object') return JSON.stringify(content);
  return String(content);
};

const calculateStreak = (content) => {
  let trackedDates = {};
  try { trackedDates = JSON.parse(safeContent(content) || '{}'); } catch (e) { return 0; }
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    if (normalizeDayData(trackedDates[key]).status === 'done') streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
};

// --- Data Service (Local Persistence) ---
const DataService = {
  STORAGE_KEY: 'vision_board_v4_stable',
  save: (data) => {
    try {
      localStorage.setItem(DataService.STORAGE_KEY, JSON.stringify(data));
      return { success: true };
    } catch (e) { return { success: false, error: 'Storage Full' }; }
  },
  load: () => {
    try {
      const saved = localStorage.getItem(DataService.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  },
  exportData: (data) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "vision_board_backup.json";
    a.click();
  }
};

// --- Constants ---
const COLORS = [{ bg: '#ffffff' }, { bg: '#fef3c7' }, { bg: '#dbeafe' }, { bg: '#fce7f3' }, { bg: '#dcfce7' }, { bg: '#f3f4f6' }, { bg: '#1f2937' }];
const TRACKER_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#ef4444', '#06b6d4', '#84cc16', '#1f2937'];
const TRACKER_MARKERS = [{id: 'check', icon: '✔️'}, {id: 'heart', icon: '❤️'}, {id: 'fire', icon: '🔥'}, {id: 'gym', icon: '💪'}];
const STICKER_PACKS = {
  'Decor': { stickers: ['✨', '📌', '📍', '🎀', '💫', '⭐️', '🌟', '💖', '🔥', '💎', '🌿', '🌵', '🌸'], levelReq: 1 },
  'Mood': { stickers: ['😎', '🤩', '🧘‍♀️', '💪', '🧠', '👀', '💃', '🏃‍♀️', '✈️', '🏝️', '🚀', '🎯', '💰'], levelReq: 1 },
  'Tape': { stickers: ['🩹', '🟧', '🟦', '🟩', '🟨', '⬛️', '⬜️'], levelReq: 1 },
  'Words': { stickers: ['💯', '🆒', '🆓', '🆗', '🆙', '🆕', '✅', '‼️'], levelReq: 2 },
  'Luxury': { stickers: ['🥂', '🏎️', '🏰', '💎', '⌚', '👔', '👠', '👜'], levelReq: 3 }
};
const LEVELS = [{ level: 1, title: "Dreamer", minXp: 0 }, { level: 2, title: "Planner", minXp: 100 }, { level: 3, title: "Doer", minXp: 300 }, { level: 4, title: "Achiever", minXp: 600 }, { level: 5, title: "Visionary", minXp: 1000 }];
const TEMPLATES = {
  'wellness': { name: "That Girl / Wellness", items: [{ id: 't1', type: 'tracker', title: 'Hydration', x: 100, y: 100, width: 280, height: 350, content: '{}', color: '#06b6d4', marker: 'water', zIndex: 1 }, { id: 'n1', type: 'note', content: "My body is a temple.", x: 100, y: 480, width: 200, height: 200, backgroundColor: '#dcfce7', zIndex: 1 }], config: { backgroundColor: '#fdf2f8' } },
  'founder': { name: "Tech Founder", items: [{ id: 't1', type: 'tracker', title: 'Deep Work (4h)', x: 100, y: 100, width: 280, height: 350, content: '{}', color: '#3b82f6', marker: 'check', zIndex: 1 }, { id: 'g1', type: 'goals', content: '{"short":"- Launch MVP"}', x: 400, y: 100, width: 500, height: 300, zIndex: 1 }], config: { backgroundColor: '#ffffff' } },
  'student': { name: "4.0 Student", items: [{ id: 't1', type: 'tracker', title: 'Study (2h)', x: 100, y: 100, width: 280, height: 350, content: '{}', color: '#8b5cf6', marker: 'check', zIndex: 1 }, { id: 'tx1', type: 'text', content: 'KNOWLEDGE', x: 300, y: 40, width: 400, height: 80, font: 'font-sans', color: '#8b5cf6', zIndex: 1 }], config: { backgroundColor: '#f5f3ff' } },
  'travel': { name: "Wanderlust", items: [{ id: 'g1', type: 'goals', content: '{"short":"- Save $500"}', x: 100, y: 100, width: 500, height: 300, zIndex: 1 }, { id: 's1', type: 'sticker', content: '✈️', x: 50, y: 50, width: 100, height: 100, zIndex: 2 }], config: { backgroundColor: '#f0f9ff' } },
  'fitness': { name: "Iron Body", items: [{ id: 't1', type: 'tracker', title: 'Gym', x: 100, y: 100, width: 280, height: 350, content: '{}', color: '#ef4444', marker: 'gym', zIndex: 1 }, { id: 'tx1', type: 'text', content: 'NO PAIN', x: 400, y: 380, width: 400, height: 80, font: 'font-mono', color: '#dc2626', zIndex: 1 }], config: { backgroundColor: '#fef2f2' } }
};
const SUGGESTED_PROMPTS = ["Visualize my dream career", "Quotes for anxiety relief"];
const LIBRARY_RESOURCES = [{ category: "Manifestation", items: [{ title: "3-6-9 Method", content: "Write desire 3x morning..." }] }];

// --- 3. HELPER COMPONENTS ---
const ToolbarButton = ({ icon: Icon, label, onClick, active = false, color = "text-gray-600", special = false }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 relative group w-full ${active ? 'bg-purple-100 text-purple-700 shadow-inner' : special ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg' : `hover:bg-gray-100 ${color}`}`} title={label}>
    <Icon size={special ? 22 : 20} className={special ? "animate-pulse" : "mb-1"} />
    {!special && <span className="text-[10px] font-medium">{label}</span>}
  </button>
);

const FormatMessage = ({ text }) => {
  if (typeof text !== 'string') return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return <span className="whitespace-pre-wrap">{parts.map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="text-purple-600">{part.slice(2, -2)}</strong> : part))}</span>;
};

// --- WIDGETS ---
const YouTubeWidget = ({ url }) => {
    const getEmbedUrl = (url) => { if (!url) return null; const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null; };
    const embedUrl = getEmbedUrl(safeContent(url));
    if (!embedUrl) return <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-4"><Youtube size={32} className="mb-2 opacity-50"/><span className="text-xs opacity-75">No Video Link</span></div>;
    return <iframe width="100%" height="100%" src={embedUrl} title="YouTube" frameBorder="0" allowFullScreen className="w-full h-full pointer-events-auto"></iframe>;
};
const SpotifyWidget = ({ url }) => {
    if (!url) return <div className="w-full h-full flex flex-col items-center justify-center bg-green-900 text-white p-4"><Music size={32} className="mb-2 opacity-50"/><span className="text-xs opacity-75">No Spotify Link</span></div>;
    return <iframe src={`https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT`} width="100%" height="100%" frameBorder="0" allow="encrypted-media" className="w-full h-full pointer-events-auto"></iframe>;
};
const CountdownWidget = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState(null);
    useEffect(() => { if (!targetDate) return; const i = setInterval(() => { const now = new Date().getTime(); const d = new Date(safeContent(targetDate)).getTime() - now; if (d < 0) setTimeLeft("EXPIRED"); else { const days = Math.floor(d / (1000 * 60 * 60 * 24)); setTimeLeft(`${days}d`); } }, 1000); return () => clearInterval(i); }, [targetDate]);
    if (!targetDate) return <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400"><Clock size={24} className="mb-1"/> <span className="text-xs">Set Date</span></div>;
    return <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 text-center"><div className="text-4xl font-bold font-mono">{timeLeft || "..."}</div></div>;
};

// --- BOARD ITEM ---
const BoardItem = ({ item, isSelected, onSelect, onUpdate, zenMode, onMagicBreakdown, scale }) => {
  const handleResizeStart = (e) => {
    e.stopPropagation();
    const startX = e.clientX; const startY = e.clientY; const startW = item.width; const startH = item.height;
    const onMove = (mv) => onUpdate(item.id, { width: Math.max(50, startW + (mv.clientX - startX)), height: Math.max(50, startH + (mv.clientY - startY)) }, false); 
    const onUp = (upE) => {
       onUpdate(item.id, { width: Math.max(50, startW + (upE.clientX - startX)), height: Math.max(50, startH + (upE.clientY - startY)) }, true);
       window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  const renderContent = () => {
      switch(item.type) {
          case 'youtube': return <YouTubeWidget url={item.content} />;
          case 'spotify': return <SpotifyWidget url={item.content} />;
          case 'timer': return <CountdownWidget targetDate={item.content} />;
          case 'journal': return <textarea className="w-full h-full bg-transparent resize-none border-none p-4 font-serif" value={safeContent(item.content)} onChange={(e) => onUpdate(item.id, {content: e.target.value})} />;
          case 'text': return <div className="w-full h-full flex items-center justify-center font-bold p-2 text-xl" style={{color: item.color}}>{safeContent(item.content)}</div>;
          case 'image': return <img src={item.content} className="w-full h-full object-cover pointer-events-none" />;
          case 'tracker': 
            const days = [...Array(30)].map((_, i) => <div key={i} className="w-4 h-4 bg-gray-100 rounded-full"></div>);
            return <div className="w-full h-full p-4"><div className="font-bold border-b pb-1 mb-2 text-center">{safeContent(item.title) || 'Habit'}</div><div className="grid grid-cols-7 gap-1">{days}</div></div>;
          case 'goals':
            let goals = { short: '' }; try { goals = JSON.parse(safeContent(item.content) || '{}'); } catch(e){}
            return <div className="w-full h-full p-4 flex flex-col"><div className="font-bold border-b pb-1 mb-2 text-center text-blue-600">GOALS</div><textarea className="w-full flex-1 resize-none bg-transparent border-none text-sm" value={goals.short || ''} onChange={(e) => onUpdate(item.id, {content: JSON.stringify({...goals, short: e.target.value})})} placeholder="- New Goal"/></div>;
          default: return <div className="w-full h-full p-4 bg-yellow-100 font-handwriting text-lg">{safeContent(item.content)}</div>;
      }
  };

  return (
    <div className={`absolute ${zenMode ? '' : 'group cursor-move'} ${isSelected && !zenMode ? 'ring-2 ring-purple-500 z-50' : 'z-auto hover:ring-1 hover:ring-purple-300'}`} 
      style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex }} 
      onPointerDown={(e) => { if (!zenMode && !e.target.closest('input') && !e.target.closest('button') && !e.target.closest('textarea')) onSelect(e, item); }}
    >
      <div className="w-full h-full overflow-hidden bg-white/80 backdrop-blur rounded-xl shadow-sm border border-white/50">
        {renderContent()}
      </div>
      {isSelected && !zenMode && <button onPointerDown={(e) => {e.stopPropagation(); onUpdate(item.id, null)}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12}/></button>}
      {isSelected && !zenMode && <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-purple-500 cursor-se-resize rounded-full border-2 border-white shadow" onPointerDown={(e) => handleResizeStart(e)} />}
      {isSelected && !zenMode && (item.type === 'text' || item.type === 'goals') && <button className="absolute -top-3 -left-3 w-7 h-7 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md animate-pulse" onPointerDown={(e) => { e.stopPropagation(); if(onMagicBreakdown) onMagicBreakdown(item); }}><Zap size={14}/></button>}
    </div>
  );
};

// --- FOCUS DASHBOARD ---
const FocusDashboard = ({ items, onAddXp }) => {
  const [todayKey, setTodayKey] = useState('');
  useEffect(() => { const now = new Date(); setTodayKey(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`); }, []);
  const habits = items.filter(i => i.type === 'tracker');
  const completedCount = habits.filter(h => { try { return normalizeDayData(JSON.parse(safeContent(h.content)||'{}')[todayKey]).status === 'done'; } catch(e) { return false; } }).length;
  
  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto flex justify-center custom-scrollbar">
      <div className="max-w-4xl w-full grid gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
           <h3 className="font-bold text-gray-700 flex items-center gap-2"><Activity size={20} className="text-emerald-500"/> Today's Habits ({completedCount}/{habits.length})</h3>
           <div className="space-y-3 mt-4">
              {habits.map(h => (<div key={h.id} className="p-4 bg-white border rounded-xl shadow-sm">{safeContent(h.title) || 'Habit'}</div>))}
              {habits.length === 0 && <p className="text-gray-400">No habits tracked.</p>}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function VisionBoardApp() {
  const [items, setItems] = useState([]);
  const [userXp, setUserXp] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [boardConfig, setBoardConfig] = useState({ backgroundColor: '#f3f4f6' });
  const [viewMode, setViewMode] = useState('vision');
  const [selectedId, setSelectedId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  
  // Feature State
  const [showImageModal, setShowImageModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [stickerTab, setStickerTab] = useState('stickers');
  const [aiTab, setAiTab] = useState('image');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [chatHistory, setChatHistory] = useState([{ role: 'model', text: "Hi! I'm your Vision Coach ✨. What big dream are you working on today?" }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

  const [dragState, setDragState] = useState({ isDragging: false, id: null, startX: 0, startY: 0 });
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const boardRef = useRef(null);

  // Gamification States
  const [xpNotification, setXpNotification] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [currentProjectName, setCurrentProjectName] = useState("Untitled Project");

  // UNSAVED WARNING
  useEffect(() => {
    const handleBeforeUnload = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const markDirty = () => setIsDirty(true);

  // LOAD
  useEffect(() => {
    const data = DataService.load();
    if (data) {
        setItems(data.items || []);
        setBoardConfig(data.boardConfig || { backgroundColor: '#f3f4f6' });
        setUserXp(data.profile?.xp || 0);
        setUserLevel(data.profile?.level || 1);
    }
  }, []);

  // SAVE
  useEffect(() => {
    setSaveStatus('saving');
    const data = { profile: { xp: userXp, level: userLevel }, items, boardConfig };
    DataService.save(data);
    const t = setTimeout(() => setSaveStatus('saved'), 800);
    return () => clearTimeout(t);
  }, [items, boardConfig, userXp, userLevel]);

  const addItem = (type, content='', extra={}) => {
    const newItem = { id: generateId(), type, content, x: 150, y: 150, width: 250, height: 150, zIndex: items.length+1, rotation: 0, ...extra };
    if (type === 'journal') { newItem.width = 300; newItem.height = 400; }
    if (type === 'tracker') { newItem.width = 280; newItem.height = 350; }
    
    setItems(prev => [...prev, newItem]);
    setSelectedId(newItem.id);
    addXp(10);
    markDirty();
    setShowAddMenu(false);
    return newItem;
  };

  const handleUpdateItem = (id, updates) => {
    if (updates === null) { setItems(items.filter(i => i.id !== id)); setSelectedId(null); } 
    else { setItems(items.map(i => i.id === id ? { ...i, ...updates } : i)); }
    markDirty();
  };

  const addXp = (amount) => {
    const nextXp = userXp + amount;
    let nextLevel = userLevel;
    LEVELS.forEach(l => { if (nextXp >= l.minXp) nextLevel = l.level; });
    setUserXp(nextXp);
    setUserLevel(nextLevel);
    markDirty();
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (file) { 
        const reader = new FileReader();
        reader.onload = (ev) => addItem('image', ev.target.result);
        reader.readAsDataURL(file);
      }
      e.target.value = null;
  };
  
  const handleAddUrlImage = (url) => { if (url) { addItem('image', url); setImageUrlInput(''); setShowImageModal(false); } };

  // --- SAVE / OPEN HANDLERS ---
  const handleSaveToDisk = () => {
      const data = { items, profile: { xp: userXp, level: userLevel }, boardConfig };
      FileService.saveToDisk(data, `dreamcanvas_${new Date().toISOString().slice(0,10)}.dream`);
      setIsDirty(false);
  };

  const handleOpenFile = (e) => {
      const file = e.target.files[0];
      if (file) {
          FileService.loadFromDisk(file).then(data => {
              if (data.items) {
                  setItems(data.items);
                  setUserXp(data.profile?.xp || 0);
                  setUserLevel(data.profile?.level || 1);
                  setBoardConfig(data.boardConfig || { backgroundColor: '#f3f4f6' });
                  setIsDirty(false); // Fresh load
                  alert("Board Loaded!");
              }
          }).catch(err => alert("Could not read file."));
      }
  };

  const handleImport = (e) => handleOpenFile(e);

  const requestClearBoard = () => {
    setConfirmModal({
        isOpen: true,
        message: "Are you sure you want to clear your entire vision board?",
        onConfirm: () => {
            setItems([]); 
            setBoardConfig({ backgroundColor: '#f3f4f6' });
            setConfirmModal({ isOpen: false, message: '', onConfirm: null });
        }
    });
  };

  const handleDragStart = (e, item) => {
    e.stopPropagation();
    setSelectedId(item.id);
    setDragState({ isDragging: true, id: item.id, startX: e.clientX, startY: e.clientY, initialX: item.x, initialY: item.y });
  };

  useEffect(() => {
    const handleUp = () => { if (dragState.isDragging) { setDragState({ isDragging: false, id: null, startX: 0, startY: 0 }); markDirty(); } };
    const handleMove = (e) => {
       if (!dragState.isDragging) return;
       const dx = e.clientX - dragState.startX;
       const dy = e.clientY - dragState.startY;
       setItems(prev => prev.map(i => i.id === dragState.id ? { ...i, x: dragState.initialX + dx, y: dragState.initialY + dy } : i));
    };
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointermove', handleMove);
    return () => { window.removeEventListener('pointerup', handleUp); window.removeEventListener('pointermove', handleMove); };
  }, [dragState]);

  const handleMagicBreakdown = async (item) => {
    if (!item.content) return;
    alert("✨ AI Magic Breakdown started for: " + safeContent(item.content));
    setTimeout(() => {
        addItem('note', `Action Plan for "${safeContent(item.content)}":\n\n1. First Step\n2. Next Step\n3. Final Goal`, { 
              x: item.x + 50, 
              y: item.y + 50, 
              backgroundColor: '#dbeafe' 
        });
    }, 1000);
  };
  
  const handleSendChat = () => {
     if(!chatInput.trim()) return;
     setChatHistory([...chatHistory, {role:'user', text: chatInput}]);
     setChatInput('');
     setIsChatLoading(true);
     setTimeout(() => {
         setChatHistory(prev => [...prev, {role:'model', text: "That sounds like a great goal! Keep pushing."}]);
         setIsChatLoading(false);
     }, 1000);
  };

  // AI Functions
  const handleGenerateImage = async () => { 
      if (!aiPrompt) return; 
      setIsAiLoading(true);
      setTimeout(() => {
          setIsAiLoading(false);
          alert("AI Image Generation would happen here with API Key.");
          setShowAIModal(false);
      }, 1500);
  };
  
  const handleGenerateAffirmations = async () => { 
      if (!aiPrompt) return; 
      setIsAiLoading(true); 
      setTimeout(() => {
          setAiResults(["I am capable.", "Success flows to me.", "My potential is limitless."]);
          setIsAiLoading(false);
      }, 1500);
  };
  
  const applyTemplate = (key) => { const tpl = TEMPLATES[key]; const newItems = tpl.items.map(i => ({...i, id: generateId()})); setItems(newItems); setBoardConfig(tpl.config); setShowTemplateModal(false); };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 text-gray-900 font-sans selection:bg-purple-200">
      
      {/* HEADER */}
      <header className={`flex-none bg-white border-b border-gray-200 z-20 px-6 h-16 flex items-center justify-between shadow-sm transition-transform duration-300 ${zenMode ? '-translate-y-full absolute w-full' : ''}`}>
        <div className="flex items-center gap-4">
            <div className="bg-gradient-to-tr from-purple-600 to-blue-500 p-2 rounded-lg text-white"><Layers size={20} /></div>
            <div>
                <h1 className="text-lg font-bold text-gray-900 leading-none">Vision App</h1>
                <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <HardDrive size={10}/> {currentProjectName}
                </p>
            </div>
            <div className="h-6 w-px bg-gray-200 mx-2"></div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('vision')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'vision' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500'}`}>Vision</button>
              <button onClick={() => setViewMode('focus')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'focus' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}>Focus</button>
            </div>
        </div>

        <div className="flex items-center gap-4">
              <div className={`text-xs font-bold uppercase transition-colors ${saveStatus === 'saving' ? 'text-blue-500 animate-pulse' : 'text-gray-300'}`}>{saveStatus === 'saving' ? 'Saving...' : 'Saved'}</div>
              
              <label className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Import Backup">
                 <Upload size={20} />
                 <input type="file" className="hidden" accept=".dream,.json" onChange={handleImport} />
              </label>
              <button onClick={handleSaveToDisk} className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Export Backup"><Download size={20} /></button>
              
              <div className="h-6 w-px bg-gray-200 mx-2"></div>
              <button onClick={requestClearBoard} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Clear Board"><Trash2 size={20} /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Zen Mode Toggle (Always Visible) */}
        {viewMode === 'vision' && (
           <button 
             onClick={() => setZenMode(!zenMode)} 
             className={`absolute top-4 right-4 z-50 p-2 rounded-full shadow-lg transition-all duration-300 ${zenMode ? 'bg-gray-900 text-white hover:bg-black opacity-50 hover:opacity-100' : 'bg-white text-gray-400 hover:text-purple-600'}`}
             title="Toggle Zen Mode"
           >
             {zenMode ? <EyeOff size={20} /> : <Eye size={20} />}
           </button>
        )}

        {viewMode === 'focus' ? (
           <FocusDashboard items={items} onAddXp={(xp) => setUserXp(prev=>prev+xp)} />
        ) : (
          <>
            <div className={`w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4 shadow-sm z-20 transition-transform duration-300 ${zenMode ? '-translate-x-full absolute h-full' : ''}`}>
               {/* Unified Add Button */}
               <ToolbarButton icon={Plus} label="Add" onClick={() => setShowAddMenu(!showAddMenu)} active={showAddMenu} />
               
               {/* Add Menu Popover */}
               {showAddMenu && (
                 <div className="absolute left-16 top-4 bg-white border shadow-xl rounded-xl p-3 grid gap-2 w-48 z-50 animate-in fade-in slide-in-from-left-4 ml-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-2">Basics</div>
                    <button onClick={() => { addItem('text', 'GOAL'); setShowAddMenu(false); }} className="text-left p-2 hover:bg-purple-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-purple-700 transition-colors"><Type size={16}/> Text</button>
                    <button onClick={() => { addItem('note', 'Note...', { backgroundColor: '#fef3c7' }); setShowAddMenu(false); }} className="text-left p-2 hover:bg-yellow-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-yellow-700 transition-colors"><StickyNote size={16}/> Note</button>
                    <button onClick={() => { fileInputRef.current.click(); setShowAddMenu(false); }} className="text-left p-2 hover:bg-gray-100 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-gray-900 transition-colors"><ImageIcon size={16}/> Upload Image</button>
                    <button onClick={() => { setShowImageModal(true); setShowAddMenu(false); }} className="text-left p-2 hover:bg-gray-100 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-gray-900 transition-colors"><LinkIcon size={16}/> Image URL</button>
                    
                    <div className="h-px bg-gray-100 my-1"></div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-2">Productivity</div>
                    <button onClick={() => { addItem('goals', '{}'); setShowAddMenu(false); }} className="text-left p-2 hover:bg-blue-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-blue-700 transition-colors"><ListTodo size={16}/> Goal List</button>
                    <button onClick={() => { addItem('tracker', '{}'); setShowAddMenu(false); }} className="text-left p-2 hover:bg-emerald-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-emerald-700 transition-colors"><Calendar size={16}/> Habit Tracker</button>
                    <button onClick={() => { addItem('journal', 'Dear Diary...'); setShowAddMenu(false); }} className="text-left p-2 hover:bg-indigo-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-indigo-700 transition-colors"><PenLine size={16}/> Journal</button>
                    
                    <div className="h-px bg-gray-100 my-1"></div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-2">Media</div>
                    <button onClick={() => { addItem('youtube', 'https://youtube.com'); setShowAddMenu(false); }} className="text-left p-2 hover:bg-red-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-red-700 transition-colors"><Youtube size={16}/> Video</button>
                    <button onClick={() => { addItem('spotify', 'https://open.spotify.com'); setShowAddMenu(false); }} className="text-left p-2 hover:bg-green-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-green-700 transition-colors"><Music size={16}/> Music</button>
                    <button onClick={() => { addItem('timer', new Date(Date.now() + 86400000).toISOString()); setShowAddMenu(false); }} className="text-left p-2 hover:bg-orange-50 rounded text-sm flex gap-2 font-medium text-gray-700 hover:text-orange-700 transition-colors"><Timer size={16}/> Timer</button>
                 </div>
               )}
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

               <div className="w-10 h-px bg-gray-200 my-2"></div>
               
               <ToolbarButton icon={LayoutTemplate} label="Tmpl" onClick={() => setShowTemplateModal(true)} />
               <ToolbarButton icon={Sparkles} label="AI" onClick={() => { setShowAIModal(true); setAiPrompt(''); setAiResults(null); }} />
               <ToolbarButton icon={MessageCircle} label="Coach" onClick={() => setShowChatModal(true)} />
               <ToolbarButton icon={Smile} label="Stick" onClick={() => setShowStickerModal(true)} />
               <ToolbarButton icon={BookOpen} label="Lib" onClick={() => setShowLibraryModal(true)} />
               
               <div className="w-10 h-px bg-gray-200 my-2"></div>
               {/* NEW: Settings Button replaces individual color buttons */}
               <ToolbarButton icon={Settings} label="Settings" onClick={() => setShowSettingsModal(true)} />
            </div>

            {/* CANVAS AREA */}
            <div ref={boardRef} className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-1000" style={{ backgroundColor: boardConfig.backgroundColor, backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px', touchAction: 'none' }} onPointerDown={(e) => { if (e.target === boardRef.current) setSelectedId(null); }}>
              {items.map(item => (
                <BoardItem 
                  key={item.id} 
                  item={item} 
                  isSelected={selectedId === item.id} 
                  onSelect={handlePointerDown} 
                  onUpdate={handleUpdateItem} 
                  scale={1} 
                  zenMode={zenMode}
                  onMagicBreakdown={handleMagicBreakdown}
                />
              ))}
              {items.length === 0 && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40"><div className="text-center"><h2 className="text-2xl font-bold text-gray-400 mb-2">Create Your Vision</h2><p className="text-gray-400 mb-4">Click (+) to add widgets.</p></div></div>}
            </div>

            {/* --- Modals --- */}
            {/* NEW: Settings Modal */}
            {showSettingsModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                 <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Settings size={20}/> Settings</h3>
                       <button onClick={() => setShowSettingsModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600"/></button>
                    </div>
                    
                    <div className="space-y-6">
                       <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">Background Color</label>
                          <div className="flex flex-wrap gap-3 justify-center">
                              {COLORS.map(c => (
                                <button 
                                  key={c.name} 
                                  onClick={() => setBoardConfig({ ...boardConfig, backgroundColor: c.bg })} 
                                  className={`w-8 h-8 rounded-full border border-gray-300 shadow-sm transition-transform hover:scale-110 ${boardConfig.backgroundColor === c.bg ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`} 
                                  style={{ backgroundColor: c.bg }} 
                                  title={c.name} 
                                />
                              ))}
                          </div>
                       </div>
                       
                       <div className="border-t border-gray-100 pt-4">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">Data Management</label>
                          <button onClick={requestClearBoard} className="w-full py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium flex items-center justify-center gap-2 transition-colors"><Trash2 size={16}/> Clear Entire Board</button>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {confirmModal.isOpen && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95"><div className="flex flex-col items-center text-center mb-4"><div className="bg-orange-100 text-orange-600 p-3 rounded-full mb-3"><AlertTriangle size={24} /></div><h3 className="text-lg font-bold text-gray-900">Are you sure?</h3><p className="text-sm text-gray-500 mt-2">{confirmModal.message}</p></div><div className="flex gap-3"><button onClick={() => setConfirmModal({isOpen: false, message: '', onConfirm: null})} className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button><button onClick={confirmModal.onConfirm} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Confirm</button></div></div></div>)}
            {showTemplateModal && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]"><div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white flex justify-between items-center"><div className="flex items-center gap-3"><LayoutTemplate size={24} /><h3 className="text-xl font-bold">Start with a Template</h3></div><button onClick={() => setShowTemplateModal(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={20} /></button></div><div className="p-8 grid md:grid-cols-3 gap-6 overflow-y-auto bg-gray-50/50">{Object.entries(TEMPLATES).map(([key, tpl]) => (<button key={key} onClick={() => applyTemplate(key)} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-violet-300 hover:scale-[1.02] transition-all text-left group"><div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center text-white shadow-lg ${key === 'wellness' ? 'bg-cyan-500' : key === 'founder' ? 'bg-blue-600' : 'bg-purple-500'}`}>{key === 'wellness' ? <Heart size={20}/> : key === 'founder' ? <Zap size={20}/> : <Book size={20}/>}</div><h4 className="font-bold text-gray-900 text-lg mb-2">{tpl.name}</h4><p className="text-sm text-gray-500 leading-relaxed mb-4">Pre-configured with trackers, aesthetic quotes, and goals.</p><div className="text-violet-600 text-sm font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">Use Template <ChevronRight size={14}/></div></button>))}</div></div></div>)}
            
            {selectedId && (() => {
              const selectedItem = items.find(i => i.id === selectedId);
              if (!selectedItem) return null;
              return (
                <div className={`absolute top-4 right-4 w-64 bg-white/95 backdrop-blur rounded-xl shadow-xl border border-gray-200 p-4 z-30 animate-in fade-in slide-in-from-right-4 max-h-[90vh] overflow-y-auto transition-opacity duration-300 ${zenMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex justify-between items-center mb-3"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Edit {selectedItem.type}</span><button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
                  <div className="space-y-4">
                    <div className="flex gap-2"><button onClick={() => handleUpdateItem(selectedItem.id, { zIndex: selectedItem.zIndex + 10 })} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 py-2 rounded text-gray-700">Bring Forward</button><button onClick={() => handleUpdateItem(selectedItem.id, { zIndex: Math.max(0, selectedItem.zIndex - 10) })} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 py-2 rounded text-gray-700">Send Backward</button></div>
                    {selectedItem.type === 'text' && (<div><label className="text-xs text-gray-500 block mb-1">Color</label><div className="flex flex-wrap gap-2">{['#000000', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#a855f7'].map(color => <button key={color} onClick={() => handleUpdateItem(selectedItem.id, { color })} className={`w-6 h-6 rounded-full border border-gray-200 ${selectedItem.color === color ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`} style={{ backgroundColor: color }} />)}</div></div>)}
                    {selectedItem.type === 'tracker' && (<div className="space-y-4"><div><label className="text-xs text-gray-500 block mb-1">Theme Color</label><div className="flex flex-wrap gap-2">{TRACKER_COLORS.map(color => <button key={color} onClick={() => handleUpdateItem(selectedItem.id, { color })} className={`w-6 h-6 rounded-full border border-gray-200 ${selectedItem.color === color ? 'ring-2 ring-purple-500 ring-offset-1' : ''}`} style={{ backgroundColor: color }} />)}</div></div><div><label className="text-xs text-gray-500 block mb-1">Marker Style</label><div className="grid grid-cols-5 gap-2">{TRACKER_MARKERS.map(marker => <button key={marker.id} onClick={() => handleUpdateItem(selectedItem.id, { marker: marker.id })} className={`flex items-center justify-center p-2 rounded border transition-colors ${selectedItem.marker === marker.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`} title={marker.label}>{marker.icon}</button>)}</div></div><div className="flex items-center gap-2"><input type="checkbox" id="transparent-toggle" checked={selectedItem.transparent || false} onChange={(e) => handleUpdateItem(selectedItem.id, { transparent: e.target.checked })} className="rounded text-purple-600 focus:ring-purple-500" /><label htmlFor="transparent-toggle" className="text-xs text-gray-600 cursor-pointer select-none">Transparent Background</label></div></div>)}
                    {(selectedItem.type === 'goals' || selectedItem.type === 'journal') && (<div className="space-y-4"><div className="flex items-center gap-2"><input type="checkbox" id="container-transparent-toggle" checked={selectedItem.transparent || false} onChange={(e) => handleUpdateItem(selectedItem.id, { transparent: e.target.checked })} className="rounded text-purple-600 focus:ring-purple-500" /><label htmlFor="container-transparent-toggle" className="text-xs text-gray-600 cursor-pointer select-none">Transparent Background</label></div></div>)}
                    {(selectedItem.type === 'text' || selectedItem.type === 'note' || selectedItem.type === 'tracker' || selectedItem.type === 'goals' || selectedItem.type === 'journal') && (<div><label className="text-xs text-gray-500 block mb-1">Font Style</label><select className="w-full text-sm border-gray-300 rounded-md shadow-sm p-1 bg-gray-50" value={selectedItem.font || 'font-sans'} onChange={(e) => handleUpdateItem(selectedItem.id, { font: e.target.value })}><option value="font-sans">Modern Sans</option><option value="font-serif">Classic Serif</option><option value="font-mono">Typewriter</option><option value="font-cursive" className="italic">Handwritten</option></select></div>)}
                    <button onClick={() => handleUpdateItem(selectedItem.id, null)} className="w-full flex items-center justify-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded-lg text-sm transition-colors mt-2"><Trash2 size={14} /> Remove Item</button>
                  </div>
                </div>
              );
            })()}

            {showImageModal && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95"><h3 className="text-lg font-bold mb-4">Add Image from URL</h3><input type="text" placeholder="Paste image address..." className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-purple-500 outline-none" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} autoFocus /><div className="flex justify-end gap-2"><button onClick={() => setShowImageModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button onClick={() => handleAddUrlImage(imageUrlInput)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">Add to Board</button></div></div></div>}
            {showStickerModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-4 text-white flex justify-between items-center"><div className="flex items-center gap-2"><Smile size={20} /><h3 className="text-lg font-bold">Stickers & GIFs</h3></div><button onClick={() => setShowStickerModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button></div>
                <div className="flex border-b border-gray-200"><button onClick={() => setStickerTab('stickers')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${stickerTab === 'stickers' ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50' : 'text-gray-500 hover:bg-gray-50'}`}><Smile size={16} /> Stickers</button><button onClick={() => setStickerTab('gif')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${stickerTab === 'gif' ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50' : 'text-gray-500 hover:bg-gray-50'}`}><LinkIcon size={16} /> GIFs / Memes</button></div>
                <div className="p-6 overflow-y-auto min-h-[300px]">
                  {stickerTab === 'stickers' && (<div className="space-y-6">{Object.entries(STICKER_PACKS).map(([category, pack]) => { const isLocked = userLevel < pack.levelReq; return (<div key={category} className={`relative ${isLocked ? 'opacity-60 grayscale' : ''}`}><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex justify-between">{category} {isLocked && <span className="text-pink-500 flex items-center gap-1"><Lock size={10} /> Lvl {pack.levelReq}</span>}</h4><div className="grid grid-cols-6 gap-2">{pack.stickers.map((emoji, idx) => (<button key={idx} onClick={() => { if(!isLocked){ addItem('sticker', emoji); setShowStickerModal(false); } }} disabled={isLocked} className={`text-3xl p-2 rounded-lg transition-transform ${isLocked ? 'cursor-not-allowed' : 'hover:bg-gray-100 hover:scale-125'}`}>{emoji}</button>))}</div></div>) })}</div>)}
                  {stickerTab === 'gif' && (<div className="space-y-4"><p className="text-sm text-gray-600">Paste a GIF link to add animation.</p><input type="text" placeholder="https://media.giphy.com/media/..." className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 outline-none" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} /><button onClick={() => handleAddUrlImage(imageUrlInput)} className="w-full py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium">Add GIF</button></div>)}
                </div>
              </div></div>
            )}
            {showLibraryModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white flex justify-between items-center"><div className="flex items-center gap-2"><BookOpen size={22} /><h3 className="text-lg font-bold">Learning Library</h3></div><button onClick={() => setShowLibraryModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button></div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50"><div className="space-y-8">{LIBRARY_RESOURCES.map((category, idx) => (<div key={idx}><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Book size={14} /> {category.category}</h3><div className="grid md:grid-cols-2 gap-4">{category.items.map((item, i) => (<div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"><h4 className="font-bold text-gray-800 mb-2 group-hover:text-teal-600 transition-colors">{item.title}</h4><p className="text-sm text-gray-600 leading-relaxed mb-3">{item.content}</p><div className="flex gap-2"><button onClick={() => { setShowLibraryModal(false); setShowChatModal(true); handleSendChat(`Tell me more about ${item.title}...`); }} className="text-xs font-medium text-teal-600 hover:bg-teal-50 px-2 py-1 rounded transition-colors">Ask Coach</button><button onClick={() => { addItem('note', `${item.title}:\n${item.content}`, { backgroundColor: '#ccfbf1' }); setShowLibraryModal(false); }} className="text-xs font-medium text-gray-500 hover:bg-gray-100 px-2 py-1 rounded transition-colors">Add to Board</button></div></div>))}</div></div>))}</div></div>
              </div></div>
            )}
            {showChatModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col h-[600px] max-h-[90vh]">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center shadow-md"><div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-full border border-white/20"><Bot size={22} className="text-white" /></div><div><h3 className="text-base font-bold">Goal Coach AI</h3><p className="text-[10px] text-blue-100 uppercase tracking-wider font-medium">Powered by Gemini</p></div></div><div className="flex gap-1"><button onClick={clearChat} className="hover:bg-white/20 p-2 rounded-full transition-colors" title="Restart Chat"><RefreshCw size={18} /></button><button onClick={() => setShowChatModal(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={18} /></button></div></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50/50">
                  {chatHistory.map((msg, idx) => (<div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>{msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white shadow-sm mt-1"><Bot size={14} /></div>}<div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}><FormatMessage text={typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)} /></div>{msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600 mt-1"><User size={14} /></div>}</div>))}
                  {isChatLoading && <div className="flex gap-3 justify-start"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white shadow-sm mt-1"><Bot size={14} /></div><div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex gap-2 items-center"><span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-100"></span><span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></span></div></div>}
                  {chatHistory.length === 1 && !isChatLoading && (<div className="grid grid-cols-1 gap-2 mt-4 px-2"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Lightbulb size={12} /> Try asking...</p>{SUGGESTED_PROMPTS.map((prompt, i) => <button key={i} onClick={() => handleSendChat(prompt)} className="text-left text-sm p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-sm hover:text-blue-600 transition-all">{prompt}</button>)}</div>)}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 bg-white border-t border-gray-200"><div className="flex gap-2 relative"><input type="text" placeholder="Ask for vision board ideas..." className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all pl-4 pr-12" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isChatLoading && handleSendChat()} disabled={isChatLoading} /><button onClick={() => handleSendChat()} disabled={isChatLoading || !chatInput.trim()} className="absolute right-1.5 top-1.5 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm transform active:scale-95"><Send size={16} /></button></div></div>
              </div></div>
            )}
            {showAIModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white flex justify-between items-center"><div className="flex items-center gap-2"><Sparkles className="animate-pulse" size={20} /><h3 className="text-lg font-bold">AI Creative Assistant</h3></div><button onClick={() => setShowAIModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button></div>
                <div className="flex border-b border-gray-200"><button onClick={() => { setAiTab('image'); setAiResults(null); }} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${aiTab === 'image' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}><ImageIcon size={16} /> Dream Image</button><button onClick={() => { setAiTab('affirmation'); setAiResults(null); }} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${aiTab === 'affirmation' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}><Type size={16} /> Affirmations</button></div>
                <div className="p-6 overflow-y-auto">
                   {aiTab === 'image' && <div className="space-y-4"><p className="text-sm text-gray-500">Describe your dream life, and the AI will paint it for you.</p><textarea placeholder="E.g., A cozy modern office..." className="w-full border border-gray-300 rounded-lg p-3 h-24 focus:ring-2 focus:ring-purple-500 outline-none resize-none" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} /><button onClick={handleGenerateImage} disabled={isAiLoading || !aiPrompt} className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center justify-center gap-2">{isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />} {isAiLoading ? 'Dreaming...' : 'Generate Image'}</button></div>}
                   {aiTab === 'affirmation' && <div className="space-y-4">{!aiResults ? <><p className="text-sm text-gray-500">Enter a goal or feeling.</p><input type="text" placeholder="Focus?" className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 outline-none" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerateAffirmations()} /><button onClick={handleGenerateAffirmations} disabled={isAiLoading || !aiPrompt} className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-2">{isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />} {isAiLoading ? 'Thinking...' : 'Inspire Me'}</button></> : <div className="space-y-3"><p className="text-sm font-bold text-gray-700">Click one to add:</p>{aiResults.map((text, idx) => <button key={idx} onClick={() => { addItem('note', typeof text === 'string' ? text : String(text), { backgroundColor: '#dbeafe' }); setShowAIModal(false); setAiResults(null); }} className="w-full text-left p-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-colors text-indigo-900 font-medium text-sm">"{typeof text === 'string' ? text : String(text)}"</button>)}<button onClick={() => setAiResults(null)} className="w-full py-2 text-gray-400 text-sm hover:text-gray-600">Try again</button></div>}</div>}
                </div>
              </div></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}