import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Type, Trash2, Layers, StickyNote, Sparkles, Loader2, Calendar,
  Link as LinkIcon, MessageCircle, BookOpen, ListTodo, Crown, Zap,
  LayoutTemplate, PenLine, Eye, EyeOff, Download, Upload, Settings, Smile,
  Timer, ZoomIn, ZoomOut, BarChart3, LocateFixed, Undo2, Redo2,
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
const HISTORY_LIMIT = 50;
// Snap threshold in *screen* pixels — divided by zoom to get world units.
const SNAP_THRESHOLD = 6;
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
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // ─ Undo/redo: bounded stacks of items-array snapshots ─
  // Snapshots are captured on *discrete* mutations only (add, delete, duplicate,
  // property change, drag-end, resize-end) — never on every pointermove. XP,
  // view, and boardConfig are deliberately outside history.
  const historyRef = useRef({ undo: [], redo: [] });
  const lastPushRef = useRef({ key: null, ts: 0 });
  const [, setHistoryVersion] = useState(0); // re-render trigger for button disabled state
  const bumpHistory = () => setHistoryVersion((v) => v + 1);

  // `coalesceKey`: rapid same-key pushes (textarea keystrokes, color-slider drags,
  // arrow-key nudge bursts) within 1s collapse into one history entry.
  const pushHistory = useCallback((snapshot, coalesceKey = null) => {
    const now = Date.now();
    const lp = lastPushRef.current;
    if (coalesceKey && lp.key === coalesceKey && now - lp.ts < 1000) {
      lp.ts = now;
      return;
    }
    lastPushRef.current = { key: coalesceKey, ts: now };
    const h = historyRef.current;
    h.undo.push(snapshot);
    if (h.undo.length > HISTORY_LIMIT) h.undo.shift();
    h.redo = [];
    bumpHistory();
  }, []);

  // Wholesale board replacements (clear, template, import, restore) reset history —
  // they already keep their own SnapshotService backups.
  const resetHistory = useCallback(() => {
    historyRef.current = { undo: [], redo: [] };
    lastPushRef.current = { key: null, ts: 0 };
    bumpHistory();
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.undo.length === 0) return;
    const prev = h.undo.pop();
    h.redo.push(itemsRef.current);
    if (h.redo.length > HISTORY_LIMIT) h.redo.shift();
    lastPushRef.current = { key: null, ts: 0 };
    setItems(prev);
    setSelectedId((sid) => (sid && prev.some((i) => i.id === sid) ? sid : null));
    bumpHistory();
  }, []);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.redo.length === 0) return;
    const next = h.redo.pop();
    h.undo.push(itemsRef.current);
    if (h.undo.length > HISTORY_LIMIT) h.undo.shift();
    lastPushRef.current = { key: null, ts: 0 };
    setItems(next);
    setSelectedId((sid) => (sid && next.some((i) => i.id === sid) ? sid : null));
    bumpHistory();
  }, []);

  const canUndo = historyRef.current.undo.length > 0;
  const canRedo = historyRef.current.redo.length > 0;

  // Alignment guides while a drag is snapping: world coords of the active lines.
  const [snapGuides, setSnapGuides] = useState(null);

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

  // ─ Theme (light / dark / system) ─
  // Stored in boardConfig (persists with the rest of settings); applied by toggling
  // the `dark` class on <html> so Tailwind `dark:` variants take over.
  const themePref = boardConfig.theme || "system";
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const isDark = themePref === "dark" || (themePref === "system" && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    // Keep the browser/PWA chrome color in step with the app chrome.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#0f172a" : "#7c3aed");
  }, [isDark]);

  // "Home zone": a soft, decorative frame in world space that hugs your content and grows as the
  // board fills in (more items) and as you level up (bigger minimum footprint). Purely cosmetic —
  // the canvas stays infinite, you can always pan past it — but it gives the empty plane a sense of
  // "this is your space" and a gentle progression cue instead of reading as a cold endless void.
  const homeZone = useMemo(() => {
    if (items.length === 0) return null;
    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.width));
    const maxY = Math.max(...items.map((i) => i.y + i.height));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const pad = 140;
    // Minimum footprint expands with level — your space literally grows as you grow.
    const minW = 900 + (userLevel - 1) * 160;
    const minH = 620 + (userLevel - 1) * 110;
    const w = Math.max(maxX - minX + pad * 2, minW);
    const h = Math.max(maxY - minY + pad * 2, minH);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [items, userLevel]);

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
      setXpNotif(`Level up! ${LEVELS.find((l) => l.level === newLevel).title}!`);
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
    if (streak === 7) addXp(70, "7-day streak! +70 XP");
    else if (streak === 30) addXp(220, "30-day habit! +220 XP");
    else addXp(20, "Habit done +20 XP");
  };

  // ─ Item drag + canvas pan + touch pinch (window-level pointer listeners) ─
  useEffect(() => {
    const handleUp = (e) => {
      const pr = pinchRef.current;
      pr.pointers.delete(e.pointerId);
      if (pr.pointers.size < 2) pr.pinch = null;
      if (dragState.isDragging) {
        // Drag-end: one history entry for the whole gesture (pre-drag snapshot).
        // A click that never moved the item (zIndex-raise only) records nothing.
        const it = itemsRef.current.find((i) => i.id === dragState.id);
        if (it && (it.x !== dragState.ix || it.y !== dragState.iy)) pushHistory(dragState.preSnapshot);
        setDragState({ isDragging: false });
        setSnapGuides(null);
      }
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
        let nx = dragState.ix + dx;
        let ny = dragState.iy + dy;
        // Snap edges/centers to other items (candidates computed once at drag
        // start). Alt disables. Threshold is screen-space, so it scales with zoom.
        let gv = null;
        let gh = null;
        if (!e.altKey) {
          const th = SNAP_THRESHOLD / view.zoom;
          const snapAxis = (pos, size, candidates) => {
            let best = null;
            for (const c of candidates) {
              for (const off of [0, size / 2, size]) {
                const d = Math.abs(c - (pos + off));
                if (d <= th && (!best || d < best.d)) best = { d, c, off };
              }
            }
            return best;
          };
          const bx = snapAxis(nx, dragState.w, dragState.snapX);
          const by = snapAxis(ny, dragState.h, dragState.snapY);
          if (bx) { nx = bx.c - bx.off; gv = bx.c; }
          if (by) { ny = by.c - by.off; gh = by.c; }
        }
        setSnapGuides((prev) => (prev?.v === gv && prev?.h === gh ? prev : gv == null && gh == null ? null : { v: gv, h: gh }));
        setItems((prev) => prev.map((i) => (i.id === dragState.id ? { ...i, x: nx, y: ny } : i)));
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

  // Cozy first frame: when the app opens onto a board that already has content, fit it into view
  // instead of dropping the user onto an empty, too-wide expanse. Runs once after load.
  const didInitialFrame = useRef(false);
  useEffect(() => {
    if (!loaded || didInitialFrame.current) return;
    didInitialFrame.current = true;
    if (items.length > 0) requestAnimationFrame(() => fitView());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

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
    pushHistory(itemsRef.current);
    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
    setShowAddMenu(false);
    return newItem;
  };

  // opts.transient skips history — used for continuous gestures (resize moves),
  // whose single history entry is pushed at gesture end instead.
  const handleUpdateItem = (id, updates, opts = {}) => {
    if (updates === null) {
      pushHistory(itemsRef.current);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((sid) => (sid === id ? null : sid));
    } else {
      if (!opts.transient) pushHistory(itemsRef.current, `update:${id}`);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
    }
  };

  // Resize-end history: snapshot at handle-down, one entry at release if size changed.
  const resizeSnapRef = useRef(null);
  const handleItemResizeStart = () => {
    resizeSnapRef.current = itemsRef.current;
  };
  const handleItemResizeEnd = (id) => {
    const snap = resizeSnapRef.current;
    resizeSnapRef.current = null;
    if (!snap) return;
    const before = snap.find((i) => i.id === id);
    const after = itemsRef.current.find((i) => i.id === id);
    if (before && after && (before.width !== after.width || before.height !== after.height)) pushHistory(snap);
  };

  // Ctrl+D: clone the selected item slightly offset. New id, top z, no XP —
  // XP stays completion-only by design.
  const duplicateItem = useCallback((src) => {
    pushHistory(itemsRef.current);
    const copy = {
      ...src,
      id: generateId(),
      x: src.x + 16,
      y: src.y + 16,
      zIndex: Math.max(...itemsRef.current.map((i) => i.zIndex || 0), 0) + 1,
    };
    setItems((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }, [pushHistory]);

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
    else if (newData.status === "planned" && prevStatus !== "planned") addXp(5, "Planned +5 XP");
    handleUpdateItem(itemId, { content: newContent });
  };

  const handlePointerDownItem = (e, item) => {
    e.stopPropagation();
    if (pinchRef.current.pinch) return; // second finger during a pinch isn't a drag
    if (item.id !== selectedId) setShowProps(false);
    setSelectedId(item.id);
    const maxZ = Math.max(...items.map((i) => i.zIndex || 0), 0);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, zIndex: maxZ + 1 } : i)));
    // Snap candidates (other items' edges + centers) computed once per drag,
    // and the pre-drag snapshot for a single drag-end history entry.
    const snapX = [];
    const snapY = [];
    for (const o of items) {
      if (o.id === item.id) continue;
      snapX.push(o.x, o.x + o.width / 2, o.x + o.width);
      snapY.push(o.y, o.y + o.height / 2, o.y + o.height);
    }
    setDragState({
      isDragging: true, pointerId: e.pointerId, id: item.id,
      startX: e.clientX, startY: e.clientY, ix: item.x, iy: item.y,
      w: item.width, h: item.height, snapX, snapY, preSnapshot: items,
    });
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

  // ─ Keyboard shortcuts (desktop-additive; vision mode only) ─
  // Ignored while typing (input/textarea/contenteditable) or while a modal is up.
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const modalOpenRef = useRef(false);
  modalOpenRef.current =
    showImageModal || showAIModal || showStickerModal || showChatModal || showLibraryModal ||
    showTemplateModal || showSettingsModal || showReviewModal || !!calendarModalData || confirmModal.isOpen;

  useEffect(() => {
    if (!loaded || viewMode !== "vision") return;
    const onKeyDown = (e) => {
      const t = e.target;
      if (t instanceof Element && (t.closest("input, textarea, select") || t.isContentEditable || t.closest('[contenteditable="true"]'))) return;
      if (modalOpenRef.current) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setShowProps(false);
        return;
      }

      const sel = itemsRef.current.find((i) => i.id === selectedIdRef.current);
      if (!sel) return;

      if (mod && key === "d") {
        e.preventDefault();
        duplicateItem(sel);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        // Same behavior as the item's X button and the panel's Remove: no confirm.
        e.preventDefault();
        pushHistory(itemsRef.current);
        setItems((prev) => prev.filter((i) => i.id !== sel.id));
        setSelectedId(null);
        setShowProps(false);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (nudge) {
        e.preventDefault();
        // Coalesced: a burst of arrow presses is one undo step.
        pushHistory(itemsRef.current, `nudge:${sel.id}`);
        setItems((prev) => prev.map((i) => (i.id === sel.id ? { ...i, x: i.x + nudge[0], y: i.y + nudge[1] } : i)));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loaded, viewMode, undo, redo, duplicateItem, pushHistory]);

  // ─ Templates / clear / export / import ─
  const requestClearBoard = () => {
    setConfirmModal({
      isOpen: true,
      message: "Clear your entire vision board? A backup snapshot will be kept in Settings → Backups.",
      onConfirm: () => {
        SnapshotService.take(currentState(), "before-clear");
        resetHistory();
        setItems([]);
        setBoardConfig({ backgroundColor: "#f3f4f6" });
        setConfirmModal({ isOpen: false });
      },
    });
  };

  const applyTemplate = (key) => {
    const apply = () => {
      SnapshotService.take(currentState(), "before-template");
      resetHistory();
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
        resetHistory();
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
          resetHistory();
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

  // Canvas surface: in dark theme, the neutral light defaults follow the chrome into slate;
  // explicit color picks (Warm Paper, Rose, …) are respected as deliberate choices. The dot grid
  // and home-zone frame adapt to whichever surface actually shows, so the "Dark" board background
  // no longer clashes with the grid or the chrome.
  const canvasBg =
    isDark && ["#f3f4f6", "#ffffff"].includes(boardConfig.backgroundColor) ? "#0f172a" : boardConfig.backgroundColor;
  const canvasIsDark = ["#0f172a", "#1f2937"].includes(canvasBg);

  const currentLevelInfo = LEVELS.find((l) => l.level === userLevel) || LEVELS[0];
  const nextLevelInfo = LEVELS.find((l) => l.level === userLevel + 1);
  const xpForNext = nextLevelInfo ? nextLevelInfo.minXp : userXp + 1000;
  const progressPercent = Math.min(100, Math.max(0, ((userXp - currentLevelInfo.minXp) / (xpForNext - currentLevelInfo.minXp)) * 100));

  if (!loaded)
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100 font-sans">
      {/* HEADER */}
      <header
        className={`flex-none bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 z-20 px-4 h-14 flex items-center justify-between shadow-sm transition-transform ${
          zenMode ? "-translate-y-full absolute w-full" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-purple-600 to-blue-500 p-1.5 rounded-lg text-white">
            <Layers size={18} />
          </div>
          <h1 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-none hidden sm:block">DreamCanvas</h1>
          <div className="h-5 w-px bg-gray-200 dark:bg-slate-700 mx-1 hidden sm:block" />
          <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode("vision")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${
                viewMode === "vision" ? "bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400" : "text-gray-500 dark:text-slate-400"
              }`}
            >
              Vision
            </button>
            <button
              onClick={() => setViewMode("focus")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide ${
                viewMode === "focus" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-slate-400"
              }`}
            >
              Focus
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {xpNotif && (
            <div className="animate-bounce text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <Sparkles size={11} /> {xpNotif}
            </div>
          )}
          <div className="hidden md:flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-full border border-gray-100 dark:border-slate-700">
            <Crown size={12} className="text-yellow-500" />
            <span className="text-[10px] font-bold text-gray-600 dark:text-slate-300">Lv{userLevel}</span>
            <div className="w-16 h-1 bg-gray-200 dark:bg-slate-700 rounded-full">
              <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">{userXp}xp</span>
          </div>
          <button onClick={() => importRef.current?.click()} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg" title="Import board (JSON)">
            <Upload size={16} />
          </button>
          <button
            onClick={handleExport}
            className="relative p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            title={backupOverdue ? "It's been a while — export a backup of your board" : "Export board (JSON)"}
          >
            <Download size={16} />
            {backupOverdue && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-400 rounded-full" />}
          </button>
          <button onClick={requestClearBoard} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Clear">
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
              zenMode
                ? "bg-gray-900 dark:bg-slate-700 text-white opacity-40 hover:opacity-100"
                : "bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
            }`}
            title="Zen Mode"
          >
            {zenMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {viewMode === "focus" ? (
          <FocusDashboard
            items={items}
            userLevel={userLevel}
            userXp={userXp}
            onUpdateItem={handleUpdateItem}
            onHabitDone={awardHabitDone}
            levels={LEVELS}
            onGoToBoard={() => setViewMode("vision")}
          />
        ) : (
          <>
            {/* TOOLBAR */}
            <div
              className={`w-14 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col items-center py-3 gap-2 shadow-sm z-20 transition-transform ${
                zenMode ? "-translate-x-full absolute h-full" : ""
              }`}
            >
              <ToolbarButton icon={Plus} label="Add" onClick={() => setShowAddMenu(!showAddMenu)} active={showAddMenu} />
              {showAddMenu && (
                <div className="absolute left-14 top-3 bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-xl rounded-xl p-2 grid gap-1 w-44 z-50 ml-1">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 px-2">Basics</div>
                  <button onClick={() => addItem("text", "GOAL")} className="text-left p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300">
                    <Type size={14} /> Text
                  </button>
                  <button onClick={() => addItem("note", "Note...", { backgroundColor: "#fef3c7" })} className="text-left p-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300">
                    <StickyNote size={14} /> Sticky Note
                  </button>
                  <button onClick={() => { setShowImageModal(true); setShowAddMenu(false); }} className="text-left p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300">
                    <LinkIcon size={14} /> Image
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-slate-700 my-0.5" />
                  <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 px-2">Productivity</div>
                  <button onClick={() => addItem("goals", "{}")} className="text-left p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300">
                    <ListTodo size={14} /> Goal List
                  </button>
                  <button onClick={() => addItem("tracker", "{}", { width: 280, height: 340 })} className="text-left p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300">
                    <Calendar size={14} /> Habit Tracker
                  </button>
                  <button onClick={() => addItem("journal", "Dear Diary...")} className="text-left p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300">
                    <PenLine size={14} /> Journal
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-slate-700 my-0.5" />
                  <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-0.5 px-2">Widgets</div>
                  <button onClick={() => addItem("timer", new Date(Date.now() + 86400000 * 7).toISOString())} className="text-left p-1.5 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300">
                    <Timer size={14} /> Countdown
                  </button>
                </div>
              )}
              <div className="w-8 h-px bg-gray-200 dark:bg-slate-700 my-1" />
              <ToolbarButton icon={LayoutTemplate} label="Templates" onClick={() => setShowTemplateModal(true)} />
              <ToolbarButton icon={Sparkles} label="AI" onClick={() => { setShowAIModal(true); setAiPrompt(""); setAiResults(null); }} />
              <ToolbarButton icon={MessageCircle} label="Coach" onClick={() => setShowChatModal(true)} />
              <ToolbarButton icon={BarChart3} label="Review" onClick={handleOpenReview} />
              <ToolbarButton icon={Smile} label="Stickers" onClick={() => setShowStickerModal(true)} />
              <ToolbarButton icon={BookOpen} label="Library" onClick={() => setShowLibraryModal(true)} />
              <div className="w-8 h-px bg-gray-200 dark:bg-slate-700 my-1" />
              <ToolbarButton icon={Settings} label="Settings" onClick={() => setShowSettingsModal(true)} />
            </div>

            {/* CANVAS */}
            <div
              ref={boardRef}
              className={`flex-1 relative overflow-hidden ${panState ? "cursor-grabbing" : "cursor-grab"} transition-colors`}
              style={{
                backgroundColor: canvasBg,
                touchAction: "none",
                filter: `brightness(${boardBrightness})`,
              }}
              onPointerDown={handleBoardPointerDown}
            >
              {/* Dot grid as its own layer so it can fade toward the edges — keeps the infinite
                  canvas from reading as a cold endless void while still scrolling with the view. */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(${canvasIsDark ? "#475569" : "#cbd5e1"} 1px, transparent 1px)`,
                  backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`,
                  backgroundPosition: `${view.x}px ${view.y}px`,
                  WebkitMaskImage: "radial-gradient(ellipse 78% 78% at 50% 45%, #000 50%, transparent 100%)",
                  maskImage: "radial-gradient(ellipse 78% 78% at 50% 45%, #000 50%, transparent 100%)",
                }}
              />
              <div className="absolute top-0 left-0" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0" }}>
                {homeZone && (
                  <div
                    className="absolute rounded-[2rem] pointer-events-none transition-all duration-500 ease-out"
                    style={{
                      left: homeZone.x,
                      top: homeZone.y,
                      width: homeZone.w,
                      height: homeZone.h,
                      border: canvasIsDark ? "2px dashed rgba(100,116,139,0.4)" : "2px dashed rgba(148,163,184,0.35)",
                      background: canvasIsDark
                        ? "radial-gradient(ellipse at center, rgba(148,163,184,0.07), rgba(148,163,184,0) 70%)"
                        : "radial-gradient(ellipse at center, rgba(255,255,255,0.45), rgba(255,255,255,0) 70%)",
                    }}
                  />
                )}
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
                      onResizeStart={handleItemResizeStart}
                      onResizeEnd={handleItemResizeEnd}
                    />
                  </div>
                ))}
              </div>
              {/* Alignment guides: 1px screen-space lines where the dragged item is snapping */}
              {snapGuides && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  {snapGuides.v != null && (
                    <div className="absolute top-0 bottom-0 w-px bg-purple-500" style={{ left: snapGuides.v * view.zoom + view.x }} />
                  )}
                  {snapGuides.h != null && (
                    <div className="absolute left-0 right-0 h-px bg-purple-500" style={{ top: snapGuides.h * view.zoom + view.y }} />
                  )}
                </div>
              )}
              {items.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                  <div className="pointer-events-auto text-center max-w-sm w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl border border-gray-200/80 dark:border-slate-700/80 shadow-xl p-8">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-500 text-white flex items-center justify-center shadow-md">
                      <Layers size={22} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Create your vision</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-5 leading-relaxed">
                      Goals stick when you can see them — pair a picture of where you're going with trackers and if-then plans for how.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => setShowTemplateModal(true)}
                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <LayoutTemplate size={15} /> Browse templates
                      </button>
                      <button
                        onClick={() => setShowAddMenu(true)}
                        className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-purple-300 dark:hover:border-purple-500 hover:text-purple-700 dark:hover:text-purple-300 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
                      >
                        <Plus size={15} /> Add your first item
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Zoom controls */}
              {!zenMode && (
                <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full shadow-lg border border-gray-200 dark:border-slate-700 px-1.5 py-1">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="p-1.5 text-gray-500 dark:text-slate-400 rounded-full enabled:hover:text-purple-600 dark:enabled:hover:text-purple-400 enabled:hover:bg-purple-50 dark:enabled:hover:bg-purple-900/30 disabled:opacity-30"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 size={15} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="p-1.5 text-gray-500 dark:text-slate-400 rounded-full enabled:hover:text-purple-600 dark:enabled:hover:text-purple-400 enabled:hover:bg-purple-50 dark:enabled:hover:bg-purple-900/30 disabled:opacity-30"
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <Redo2 size={15} />
                  </button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-0.5" />
                  <button onClick={() => zoomAtCenter(1 / 1.2)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/30" title="Zoom out">
                    <ZoomOut size={15} />
                  </button>
                  <button onClick={resetView} className="text-[10px] font-bold text-gray-600 dark:text-slate-300 w-10 py-1 text-center hover:text-purple-600 dark:hover:text-purple-400" title="Reset to 100%">
                    {Math.round(view.zoom * 100)}%
                  </button>
                  <button onClick={() => zoomAtCenter(1.2)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/30" title="Zoom in">
                    <ZoomIn size={15} />
                  </button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-0.5" />
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
