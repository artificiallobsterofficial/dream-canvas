import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Type, Trash2, Layers, StickyNote, Sparkles, Loader2, Calendar,
  Link as LinkIcon, MessageCircle, BookOpen, ListTodo, Crown, Zap,
  LayoutTemplate, PenLine, Eye, EyeOff, Download, Upload, Settings, Smile,
  Timer, ZoomIn, ZoomOut, BarChart3, LocateFixed,
} from "lucide-react";

import { generateId, normalizeDayData, safeContent, todayKey, calculateStreak } from "./utils/helpers";
import { StorageService, SnapshotService, requestPersistence } from "./services/storage";
import { callAI, buildBoardContext, COACH_SYSTEM_WITH_BOARD } from "./services/ai";
import { generateWeeklyReview } from "./services/review";
import { mirrorReminderState, maybeNotify } from "./services/reminders";
import InstallPrompt from "./components/InstallPrompt";
import { LEVELS } from "./constants/levels";
import { TEMPLATES } from "./constants/templates";

import ToolbarButton from "./components/ToolbarButton";
import BoardItem from "./components/BoardItem";
import FocusDashboard from "./components/FocusDashboard";
import PropertiesPanel from "./components/PropertiesPanel";
import SettingsModal from "./components/modals/SettingsModal";
import TemplateModal from "./components/modals/TemplateModal";
import StickerModal from "./components/modals/StickerModal";
import LibraryModal from "./components/modals/LibraryModal";
import ChatModal from "./components/modals/ChatModal";
import AIModal from "./components/modals/AIModal";
import CalendarDayModal from "./components/modals/CalendarDayModal";
import ReviewModal from "./components/modals/ReviewModal";
import ImageModal from "./components/modals/ImageModal";
import ConfirmModal from "./components/modals/ConfirmModal";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const DEFAULT_GREETING = { role: "assistant", text: "Hi! I'm your Vision Coach ✨ What big dream are you working on? I can help with goals, affirmations, or ideas!" };

export default function App() {
  const [userXp, setUserXp] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [xpNotif, setXpNotif] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  // The edit panel opens only via an item's gear button — never on mere selection.
  const [showProps, setShowProps] = useState(false);
  const [boardConfig, setBoardConfig] = useState({ backgroundColor: "#f3f4f6" });
  const [dragState, setDragState] = useState({ isDragging: false });
  const [viewMode, setViewMode] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "focus" : "vision"));
  const [zenMode, setZenMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastExportAt, setLastExportAt] = useState(null);
  // Ledger of habit-days that already paid XP ("itemId|dateKey" -> ts).
  // Prevents farming via done→undone→done toggles or note-edit re-saves.
  const [awardedDays, setAwardedDays] = useState({});

  // Pan & zoom: world coords -> screen via translate(view.x, view.y) scale(view.zoom)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [panState, setPanState] = useState(null);
  // Touch pinch state lives in a ref — only setView triggers renders.
  const pinchRef = useRef({ pointers: new Map(), pinch: null });
  const viewRef = useRef(view);
  viewRef.current = view;

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
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [review, setReview] = useState(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [chatHistory, setChatHistory] = useState([DEFAULT_GREETING]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const boardRef = useRef(null);
  const importRef = useRef(null);

  const selectedItem = items.find((i) => i.id === selectedId);

  // ─ Load on mount ─
  useEffect(() => {
    const data = StorageService.load();
    if (data) {
      setItems(data.items || []);
      setBoardConfig(data.boardConfig || { backgroundColor: "#f3f4f6" });
      setUserXp(data.profile?.xp || 0);
      setUserLevel(data.profile?.level || 1);
      setAwardedDays(data.profile?.awardedDays || {});
      setLastExportAt(data.lastExportAt || null);
      SnapshotService.take(data, "daily");
    }
    requestPersistence();
    setLoaded(true);
  }, []);

  // ─ Auto-save ─
  useEffect(() => {
    if (!loaded) return;
    StorageService.save({ profile: { xp: userXp, level: userLevel, awardedDays }, items, boardConfig, lastExportAt, lastActive: Date.now() });
    mirrorReminderState(items, boardConfig.reminder); // keep the SW's view fresh
  }, [items, boardConfig, userXp, userLevel, awardedDays, lastExportAt, loaded]);

  // ─ Foreground reminder check (once a minute while the app is open) ─
  const reminderRef = useRef({ items: [], reminder: null });
  reminderRef.current = { items, reminder: boardConfig.reminder };
  useEffect(() => {
    if (!loaded) return;
    const check = () => maybeNotify(reminderRef.current.items, reminderRef.current.reminder);
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [loaded]);

  const currentState = () => ({ profile: { xp: userXp, level: userLevel, awardedDays }, items, boardConfig, lastExportAt });

  // ─ XP + leveling ─
  // XP is feedback on completions (habits done, streak milestones) — not a
  // reward for adding items, which made decorating the fastest way to level.
  const addXp = (amount, label) => {
    let newLevel = userLevel;
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (userXp + amount >= LEVELS[i].minXp) {
        newLevel = LEVELS[i].level;
        break;
      }
    }
    setUserXp((prev) => prev + amount);
    setXpNotif(label || `+${amount} XP`);
    if (newLevel > userLevel) {
      setUserLevel(newLevel);
      setXpNotif(`🎉 LEVEL UP! ${LEVELS.find((l) => l.level === newLevel).title}!`);
    }
    setTimeout(() => setXpNotif(null), 2500);
  };

  // Completion credit for marking a habit done, including streak milestones.
  // Each habit-day pays out at most once, ever — re-marking an unmarked day,
  // or editing its note, never re-awards.
  const awardHabitDone = (itemId, dateKey, newContent) => {
    const ledgerKey = `${itemId}|${dateKey}`;
    if (awardedDays[ledgerKey]) return;
    setAwardedDays((prev) => {
      const next = { ...prev, [ledgerKey]: Date.now() };
      // Keep the ledger bounded: drop entries older than 90 days.
      const cutoff = Date.now() - 90 * 86400000;
      for (const k of Object.keys(next)) if (next[k] < cutoff) delete next[k];
      return next;
    });
    const streak = calculateStreak(newContent);
    if (streak === 7) addXp(70, "🔥 7-day streak! +70 XP");
    else if (streak === 30) addXp(220, "🏆 30-day habit! +220 XP");
    else addXp(20, "✓ Habit done +20 XP");
  };

  // ─ Item drag + canvas pan + touch pinch (window-level pointer listeners) ─
  useEffect(() => {
    const handleUp = (e) => {
      const pr = pinchRef.current;
      pr.pointers.delete(e.pointerId);
      if (pr.pointers.size < 2) pr.pinch = null;
      if (dragState.isDragging) setDragState({ isDragging: false });
      if (panState) setPanState(null);
    };
    const handleMove = (e) => {
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      if (cx == null) return;

      const pr = pinchRef.current;
      if (pr.pointers.has(e.pointerId)) pr.pointers.set(e.pointerId, { x: cx, y: cy });
      if (pr.pinch && pr.pointers.size >= 2) {
        e.preventDefault();
        const [p1, p2] = [...pr.pointers.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const rect = boardRef.current?.getBoundingClientRect();
        if (!rect || pr.pinch.startDist === 0) return;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pr.pinch.startZoom * (dist / pr.pinch.startDist)));
        const scale = newZoom / pr.pinch.startView.zoom;
        const sx = pr.pinch.startMid.x - rect.left;
        const sy = pr.pinch.startMid.y - rect.top;
        setView({
          zoom: newZoom,
          x: mid.x - rect.left - (sx - pr.pinch.startView.x) * scale,
          y: mid.y - rect.top - (sy - pr.pinch.startView.y) * scale,
        });
        return;
      }

      if (dragState.isDragging && e.pointerId === dragState.pointerId) {
        e.preventDefault();
        const dx = (cx - dragState.startX) / view.zoom;
        const dy = (cy - dragState.startY) / view.zoom;
        setItems((prev) => prev.map((i) => (i.id === dragState.id ? { ...i, x: dragState.ix + dx, y: dragState.iy + dy } : i)));
      } else if (panState && e.pointerId === panState.pointerId) {
        e.preventDefault();
        setView((v) => ({ ...v, x: panState.vx + (cx - panState.startX), y: panState.vy + (cy - panState.startY) }));
      }
    };
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    window.addEventListener("pointermove", handleMove);
    return () => {
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("pointermove", handleMove);
    };
  }, [dragState, panState, view.zoom]);

  // ─ Zoom (ctrl/cmd + wheel zooms toward cursor; plain wheel pans) ─
  const applyZoom = useCallback((factor, cx, cy) => {
    setView((v) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const scale = newZoom / v.zoom;
      return { zoom: newZoom, x: cx - (cx - v.x) * scale, y: cy - (cy - v.y) * scale };
    });
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el || viewMode !== "vision") return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        applyZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, cx, cy);
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewMode, applyZoom, loaded]);

  const zoomAtCenter = (factor) => {
    const br = boardRef.current?.getBoundingClientRect();
    applyZoom(factor, br ? br.width / 2 : 400, br ? br.height / 2 : 300);
  };
  const resetView = () => setView({ x: 0, y: 0, zoom: 1 });

  // "Find my board": fit every item into the viewport. The rescue hatch for
  // an infinite canvas — works no matter how lost the view is.
  const fitView = () => {
    const br = boardRef.current?.getBoundingClientRect();
    if (!br || items.length === 0) {
      resetView();
      return;
    }
    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.width));
    const maxY = Math.max(...items.map((i) => i.y + i.height));
    const pad = 60;
    const zoom = Math.min(
      1.25, // don't blow a tiny board up past readable scale
      Math.max(MIN_ZOOM, Math.min(br.width / (maxX - minX + pad * 2), br.height / (maxY - minY + pad * 2)))
    );
    setView({
      zoom,
      x: br.width / 2 - ((minX + maxX) / 2) * zoom,
      y: br.height / 2 - ((minY + maxY) / 2) * zoom,
    });
  };

  // ─ Add item (centered in the current viewport, in world coords) ─
  const addItem = (type, content = "", extraProps = {}) => {
    const br = boardRef.current?.getBoundingClientRect();
    const w = type === "note" ? 200 : type === "sticker" ? 80 : type === "goals" ? 480 : type === "journal" ? 350 : type === "timer" ? 180 : 220;
    const h = type === "note" ? 200 : type === "sticker" ? 80 : type === "goals" ? 280 : type === "journal" ? 400 : type === "tracker" ? 340 : type === "timer" ? 120 : 120;
    const cx = br ? (br.width / 2 - view.x) / view.zoom - w / 2 : 300;
    const cy = br ? (br.height / 2 - view.y) / view.zoom - h / 2 : 200;
    const off = Math.random() * 40 - 20;
    const newItem = {
      id: generateId(),
      type,
      content,
      x: cx + off,
      y: cy + off,
      width: w,
      height: h,
      zIndex: items.length + 1,
      rotation: type === "sticker" ? Math.random() * 20 - 10 : 0,
      ...extraProps,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
    setShowAddMenu(false);
    return newItem;
  };

  const handleUpdateItem = (id, updates) => {
    if (updates === null) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId(null);
    } else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    }
  };

  const handleDayUpdate = (itemId, dateKey, newData) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    let td = {};
    try {
      td = JSON.parse(item.content || "{}");
    } catch {}
    const prevStatus = normalizeDayData(td[dateKey]).status;
    if (!newData.status && !newData.event) delete td[dateKey];
    else td[dateKey] = newData;
    const newContent = JSON.stringify(td);
    // Award only on a real status transition — note edits re-fire this handler.
    if (newData.status === "done" && prevStatus !== "done") awardHabitDone(itemId, dateKey, newContent);
    else if (newData.status === "planned" && prevStatus !== "planned") addXp(5, "📅 Planned +5 XP");
    handleUpdateItem(itemId, { content: newContent });
  };

  const handlePointerDownItem = (e, item) => {
    e.stopPropagation();
    if (pinchRef.current.pinch) return; // second finger during a pinch isn't a drag
    if (item.id !== selectedId) setShowProps(false);
    setSelectedId(item.id);
    const maxZ = Math.max(...items.map((i) => i.zIndex || 0), 0);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, zIndex: maxZ + 1 } : i)));
    setDragState({ isDragging: true, pointerId: e.pointerId, id: item.id, startX: e.clientX, startY: e.clientY, ix: item.x, iy: item.y });
  };

  // Track every pointer that lands on the board — capture phase, so item
  // handlers' stopPropagation can't hide fingers from the pinch detector.
  useEffect(() => {
    const el = boardRef.current;
    if (!el || viewMode !== "vision") return;
    const onDownCapture = (e) => {
      const pr = pinchRef.current;
      pr.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pr.pointers.size === 2) {
        const [p1, p2] = [...pr.pointers.values()];
        const v = viewRef.current;
        pr.pinch = {
          startDist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
          startZoom: v.zoom,
          startView: { ...v },
          startMid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        };
        // A pinch overrides any in-progress drag or pan.
        setDragState({ isDragging: false });
        setPanState(null);
      }
    };
    el.addEventListener("pointerdown", onDownCapture, true);
    return () => el.removeEventListener("pointerdown", onDownCapture, true);
  }, [viewMode, loaded]);

  const handleBoardPointerDown = (e) => {
    // Empty-canvas press: deselect and start panning (capture listener above
    // has already recorded the pointer and possibly started a pinch).
    if (e.target.closest(".board-item") || e.target.closest("button")) return;
    const pr = pinchRef.current;
    if (pr.pinch || pr.pointers.size >= 2) return;
    setSelectedId(null);
    setShowProps(false);
    setShowAddMenu(false);
    setPanState({ pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y });
  };

  // ─ Templates / clear / export / import ─
  const requestClearBoard = () => {
    setConfirmModal({
      isOpen: true,
      message: "Clear your entire vision board? A backup snapshot will be kept in Settings → Backups.",
      onConfirm: () => {
        SnapshotService.take(currentState(), "before-clear");
        setItems([]);
        setBoardConfig({ backgroundColor: "#f3f4f6" });
        setConfirmModal({ isOpen: false });
      },
    });
  };

  const applyTemplate = (key) => {
    const apply = () => {
      SnapshotService.take(currentState(), "before-template");
      const tpl = TEMPLATES[key];
      setItems(tpl.items.map((i) => ({ ...i, id: generateId() })));
      setBoardConfig(tpl.config);
      setShowTemplateModal(false);
      resetView();
      setConfirmModal({ isOpen: false });
    };
    if (items.length > 0) setConfirmModal({ isOpen: true, message: "This will replace your current board. Continue?", onConfirm: apply });
    else apply();
  };

  const handleExport = () => {
    const data = { profile: { xp: userXp, level: userLevel }, items, boardConfig };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dreamcanvas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportAt(Date.now());
  };

  const handleRestoreSnapshot = async (id) => {
    const data = await SnapshotService.get(id);
    if (!data) return;
    setConfirmModal({
      isOpen: true,
      message: "Restore this backup? Your current board will be replaced (a snapshot of it is kept first).",
      onConfirm: () => {
        SnapshotService.take(currentState(), "before-restore");
        setItems(data.items || []);
        setBoardConfig(data.boardConfig || { backgroundColor: "#f3f4f6" });
        if (data.profile) {
          setUserXp(data.profile.xp || 0);
          setUserLevel(data.profile.level || 1);
        }
        resetView();
        setShowSettingsModal(false);
        setConfirmModal({ isOpen: false });
      },
    });
  };

  const handleImportFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.items)) throw new Error("no items array");
        const restore = () => {
          SnapshotService.take(currentState(), "before-import");
          setItems(data.items);
          setBoardConfig(data.boardConfig || { backgroundColor: "#f3f4f6" });
          if (data.profile) {
            setUserXp(data.profile.xp || 0);
            setUserLevel(data.profile.level || 1);
          }
          resetView();
          setConfirmModal({ isOpen: false });
        };
        if (items.length > 0) setConfirmModal({ isOpen: true, message: "Importing will replace your current board. Continue?", onConfirm: restore });
        else restore();
      } catch {
        setConfirmModal({ isOpen: true, message: "That file doesn't look like a DreamCanvas export.", onConfirm: () => setConfirmModal({ isOpen: false }) });
      }
    };
    reader.readAsText(file);
  };

  // ─ AI handlers ─
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
      } catch {
        setAiResults([text.slice(0, 120)]);
      }
    } else {
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
    const newHistory = [...chatHistory, { role: "user", text }];
    setChatHistory(newHistory);
    setChatInput("");
    setIsChatLoading(true);
    const aiText = await callAI(
      newHistory.map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.text}`).join("\n") + "\nCoach:",
      COACH_SYSTEM_WITH_BOARD(buildBoardContext(items, { xp: userXp, level: userLevel }))
    );
    if (aiText) {
      setChatHistory((prev) => [...prev, { role: "assistant", text: aiText }]);
    } else {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", text: "That's a wonderful goal! Try breaking it into 3 small steps you can take this week. Visualize how you'll feel when you achieve it. What's the first tiny action you could take today? 💫" },
      ]);
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
    addItem("note", `Steps for ${content.slice(0, 30)}…\n\n${steps}`, { x: item.x + 40, y: item.y + 40, backgroundColor: "#dbeafe" });
  };

  const handleOpenReview = async () => {
    setShowReviewModal(true);
    setIsReviewLoading(true);
    const r = await generateWeeklyReview(items, { xp: userXp, level: userLevel });
    setReview(r);
    setIsReviewLoading(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isChatLoading]);

  // ─ Board brightness tied to today's habit completion ─
  const trackers = items.filter((i) => i.type === "tracker");
  const completionRate =
    trackers.reduce((acc, item) => {
      try {
        const data = JSON.parse(item.content || "{}");
        return acc + (normalizeDayData(data[todayKey()]).status === "done" ? 1 : 0);
      } catch {
        return acc;
      }
    }, 0) / (trackers.length || 1);
  const boardBrightness = 0.92 + completionRate * 0.15;

  const backupOverdue = items.length >= 8 && (!lastExportAt || Date.now() - lastExportAt > 7 * 86400000);

  const currentLevelInfo = LEVELS.find((l) => l.level === userLevel) || LEVELS[0];
  const nextLevelInfo = LEVELS.find((l) => l.level === userLevel + 1);
  const xpForNext = nextLevelInfo ? nextLevelInfo.minXp : userXp + 1000;
  const progressPercent = Math.min(100, Math.max(0, ((userXp - currentLevelInfo.minXp) / (xpForNext - currentLevelInfo.minXp)) * 100));

  if (!loaded)
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 text-gray-900 font-sans">
      {/* HEADER */}
      <header
        className={`flex-none bg-white border-b border-gray-200 z-20 px-4 h-14 flex items-center justify-between shadow-sm transition-transform ${
          zenMode ? "-translate-y-full absolute w-full" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-purple-600 to-blue-500 p-1.5 rounded-lg text-white">
            <Layers size={18} />
          </div>
          <h1 className="text-base font-bold text-gray-900 leading-none hidden sm:block">DreamCanvas</h1>
          <div className="h-5 w-px bg-gray-200 mx-1 hidden sm:block" />
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode("vision")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${
                viewMode === "vision" ? "bg-white shadow-sm text-purple-600" : "text-gray-500"
              }`}
            >
              Vision
            </button>
            <button
              onClick={() => setViewMode("focus")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${
                viewMode === "focus" ? "bg-white shadow-sm text-emerald-600" : "text-gray-500"
              }`}
            >
              Focus
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {xpNotif && <div className="animate-bounce text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{xpNotif}</div>}
          <div className="hidden md:flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            <Crown size={12} className="text-yellow-500" />
            <span className="text-[10px] font-bold text-gray-600">Lv{userLevel}</span>
            <div className="w-16 h-1 bg-gray-200 rounded-full">
              <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] text-gray-400">{userXp}xp</span>
          </div>
          <button onClick={() => importRef.current?.click()} className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg" title="Import board (JSON)">
            <Upload size={16} />
          </button>
          <button
            onClick={handleExport}
            className="relative p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
            title={backupOverdue ? "It's been a while — export a backup of your board" : "Export board (JSON)"}
          >
            <Download size={16} />
            {backupOverdue && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-400 rounded-full" />}
          </button>
          <button onClick={requestClearBoard} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Clear">
            <Trash2 size={16} />
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              handleImportFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {viewMode === "vision" && (
          <button
            onClick={() => setZenMode(!zenMode)}
            className={`absolute top-3 right-3 z-50 p-1.5 rounded-full shadow-lg transition-all ${
              zenMode ? "bg-gray-900 text-white opacity-40 hover:opacity-100" : "bg-white text-gray-400 hover:text-purple-600"
            }`}
            title="Zen Mode"
          >
            {zenMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {viewMode === "focus" ? (
          <FocusDashboard items={items} userLevel={userLevel} userXp={userXp} onUpdateItem={handleUpdateItem} onHabitDone={awardHabitDone} levels={LEVELS} />
        ) : (
          <>
            {/* TOOLBAR */}
            <div
              className={`w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-2 shadow-sm z-20 transition-transform ${
                zenMode ? "-translate-x-full absolute h-full" : ""
              }`}
            >
              <ToolbarButton icon={Plus} label="Add" onClick={() => setShowAddMenu(!showAddMenu)} active={showAddMenu} />
              {showAddMenu && (
                <div className="absolute left-14 top-3 bg-white border shadow-xl rounded-xl p-2 grid gap-1 w-44 z-50 ml-1">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-2">Basics</div>
                  <button onClick={() => addItem("text", "GOAL")} className="text-left p-1.5 hover:bg-purple-50 rounded text-xs flex gap-2 text-gray-700">
                    <Type size={14} /> Text
                  </button>
                  <button onClick={() => addItem("note", "Note...", { backgroundColor: "#fef3c7" })} className="text-left p-1.5 hover:bg-yellow-50 rounded text-xs flex gap-2 text-gray-700">
                    <StickyNote size={14} /> Sticky Note
                  </button>
                  <button onClick={() => { setShowImageModal(true); setShowAddMenu(false); }} className="text-left p-1.5 hover:bg-gray-100 rounded text-xs flex gap-2 text-gray-700">
                    <LinkIcon size={14} /> Image
                  </button>
                  <div className="h-px bg-gray-100 my-0.5" />
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-2">Productivity</div>
                  <button onClick={() => addItem("goals", "{}")} className="text-left p-1.5 hover:bg-blue-50 rounded text-xs flex gap-2 text-gray-700">
                    <ListTodo size={14} /> Goal List
                  </button>
                  <button onClick={() => addItem("tracker", "{}", { width: 280, height: 340 })} className="text-left p-1.5 hover:bg-emerald-50 rounded text-xs flex gap-2 text-gray-700">
                    <Calendar size={14} /> Habit Tracker
                  </button>
                  <button onClick={() => addItem("journal", "Dear Diary...")} className="text-left p-1.5 hover:bg-indigo-50 rounded text-xs flex gap-2 text-gray-700">
                    <PenLine size={14} /> Journal
                  </button>
                  <div className="h-px bg-gray-100 my-0.5" />
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 px-2">Widgets</div>
                  <button onClick={() => addItem("timer", new Date(Date.now() + 86400000 * 7).toISOString())} className="text-left p-1.5 hover:bg-orange-50 rounded text-xs flex gap-2 text-gray-700">
                    <Timer size={14} /> Countdown
                  </button>
                </div>
              )}
              <div className="w-8 h-px bg-gray-200 my-1" />
              <ToolbarButton icon={LayoutTemplate} label="Templates" onClick={() => setShowTemplateModal(true)} />
              <ToolbarButton icon={Sparkles} label="AI" onClick={() => { setShowAIModal(true); setAiPrompt(""); setAiResults(null); }} />
              <ToolbarButton icon={MessageCircle} label="Coach" onClick={() => setShowChatModal(true)} />
              <ToolbarButton icon={BarChart3} label="Review" onClick={handleOpenReview} />
              <ToolbarButton icon={Smile} label="Stickers" onClick={() => setShowStickerModal(true)} />
              <ToolbarButton icon={BookOpen} label="Library" onClick={() => setShowLibraryModal(true)} />
              <div className="w-8 h-px bg-gray-200 my-1" />
              <ToolbarButton icon={Settings} label="Settings" onClick={() => setShowSettingsModal(true)} />
            </div>

            {/* CANVAS */}
            <div
              ref={boardRef}
              className={`flex-1 relative overflow-hidden ${panState ? "cursor-grabbing" : "cursor-grab"} transition-colors`}
              style={{
                backgroundColor: boardConfig.backgroundColor,
                backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
                backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`,
                backgroundPosition: `${view.x}px ${view.y}px`,
                touchAction: "none",
                filter: `brightness(${boardBrightness})`,
              }}
              onPointerDown={handleBoardPointerDown}
            >
              <div className="absolute top-0 left-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0" }}>
                {items.map((item) => (
                  <div key={item.id} className="board-item contents">
                    <BoardItem
                      item={item}
                      isSelected={selectedId === item.id}
                      onSelect={handlePointerDownItem}
                      onUpdate={handleUpdateItem}
                      onDayClick={(itemId, dateStr, data) => setCalendarModalData({ itemId, dateStr, data })}
                      zenMode={zenMode}
                      zoom={view.zoom}
                      onMagicBreakdown={handleMagicBreakdown}
                      onOpenProps={() => setShowProps(true)}
                    />
                  </div>
                ))}
              </div>
              {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                  <div className="text-center">
                    <Layers size={48} className="mx-auto mb-3 text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-400 mb-1">Create Your Vision</h2>
                    <p className="text-gray-400 text-sm">Click + to add widgets, or pick a template</p>
                  </div>
                </div>
              )}

              {/* Zoom controls */}
              {!zenMode && (
                <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-white/90 backdrop-blur rounded-full shadow-lg border border-gray-200 px-1.5 py-1">
                  <button onClick={() => zoomAtCenter(1 / 1.2)} className="p-1.5 text-gray-500 hover:text-purple-600 rounded-full hover:bg-purple-50" title="Zoom out">
                    <ZoomOut size={15} />
                  </button>
                  <button onClick={resetView} className="text-[10px] font-bold text-gray-600 w-10 py-1 text-center hover:text-purple-600" title="Reset to 100%">
                    {Math.round(view.zoom * 100)}%
                  </button>
                  <button onClick={() => zoomAtCenter(1.2)} className="p-1.5 text-gray-500 hover:text-purple-600 rounded-full hover:bg-purple-50" title="Zoom in">
                    <ZoomIn size={15} />
                  </button>
                  <div className="w-px h-4 bg-gray-200 mx-0.5" />
                  <button onClick={fitView} className="p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 shadow-sm" title="Fit board into view">
                    <LocateFixed size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* PROPERTIES PANEL — opened via the selected item's gear button */}
            {selectedItem && showProps && !calendarModalData && !zenMode && (
              <PropertiesPanel item={selectedItem} onUpdate={handleUpdateItem} onClose={() => setShowProps(false)} />
            )}

            {/* MODALS */}
            {showSettingsModal && (
              <SettingsModal
                boardConfig={boardConfig}
                setBoardConfig={setBoardConfig}
                onClearBoard={() => { requestClearBoard(); setShowSettingsModal(false); }}
                onRestoreSnapshot={handleRestoreSnapshot}
                lastExportAt={lastExportAt}
                onClose={() => setShowSettingsModal(false)}
              />
            )}
            {showTemplateModal && <TemplateModal onApply={applyTemplate} onClose={() => setShowTemplateModal(false)} />}
            {calendarModalData &&
              (() => {
                const { itemId, dateStr, data } = calendarModalData;
                const updateStatus = (status) => {
                  const nd = { ...data, status: data.status === status ? null : status };
                  handleDayUpdate(itemId, dateStr, nd);
                  setCalendarModalData({ ...calendarModalData, data: nd });
                };
                const updateEvent = (text) => {
                  const nd = { ...data, event: text };
                  handleDayUpdate(itemId, dateStr, nd);
                  setCalendarModalData({ ...calendarModalData, data: nd });
                };
                return <CalendarDayModal data={data} dateStr={dateStr} onUpdateStatus={updateStatus} onUpdateEvent={updateEvent} onClose={() => setCalendarModalData(null)} />;
              })()}
            {showImageModal && (
              <ImageModal
                onAdd={(src) => {
                  addItem("image", src);
                  setShowImageModal(false);
                }}
                onClose={() => setShowImageModal(false)}
              />
            )}
            {showStickerModal && (
              <StickerModal
                userLevel={userLevel}
                onPick={(emoji) => {
                  addItem("sticker", emoji);
                  setShowStickerModal(false);
                }}
                onClose={() => setShowStickerModal(false)}
              />
            )}
            {showLibraryModal && (
              <LibraryModal
                onAskCoach={(item) => {
                  setShowLibraryModal(false);
                  setShowChatModal(true);
                  handleSendChat(`Tell me more about ${item.title}...`);
                }}
                onAddToBoard={(item) => {
                  addItem("note", `${item.title}:\n${item.content}`, { backgroundColor: "#ccfbf1" });
                  setShowLibraryModal(false);
                }}
                onClose={() => setShowLibraryModal(false)}
              />
            )}
            {showChatModal && (
              <ChatModal
                chatHistory={chatHistory}
                chatInput={chatInput}
                setChatInput={setChatInput}
                isChatLoading={isChatLoading}
                onSend={handleSendChat}
                onReset={() => setChatHistory([DEFAULT_GREETING])}
                onClose={() => setShowChatModal(false)}
                chatEndRef={chatEndRef}
              />
            )}
            {showReviewModal && (
              <ReviewModal
                review={review}
                isLoading={isReviewLoading}
                onAddToBoard={() => {
                  if (review?.text) addItem("note", review.text, { backgroundColor: "#dcfce7", width: 280, height: 320 });
                  setShowReviewModal(false);
                }}
                onRegenerate={handleOpenReview}
                onClose={() => setShowReviewModal(false)}
              />
            )}
            {showAIModal && (
              <AIModal
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
                aiResults={aiResults}
                setAiResults={setAiResults}
                isAiLoading={isAiLoading}
                onGenerate={handleGenerateAffirmations}
                onPickResult={(text) => {
                  addItem("note", text, { backgroundColor: "#dbeafe" });
                  setShowAIModal(false);
                  setAiResults(null);
                }}
                onClose={() => setShowAIModal(false)}
              />
            )}
          </>
        )}
        {confirmModal.isOpen && <ConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal({ isOpen: false })} />}
      </div>
      <InstallPrompt />
    </div>
  );
}
