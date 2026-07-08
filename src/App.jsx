import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Type, Trash2, Layers, StickyNote, Sparkles, Loader2, Calendar,
  Link as LinkIcon, MessageCircle, BookOpen, ListTodo, Crown, Zap,
  LayoutTemplate, PenLine, Eye, EyeOff, Download, Upload, Settings, Smile,
  Timer, ZoomIn, ZoomOut, BarChart3, LocateFixed, Undo2, Redo2, Flower2, Sprout,
  Clapperboard, ImageDown, Frame, ChevronUp, ChevronDown,
} from "lucide-react";

import { generateId, normalizeDayData, safeContent, todayKey, calculateStreak, fileToDataUrl } from "./utils/helpers";
import { StorageService, SnapshotService, requestPersistence } from "./services/storage";
import { callAI, buildBoardContext, COACH_SYSTEM_WITH_BOARD } from "./services/ai";
import { generateWeeklyReview } from "./services/review";
import { mirrorReminderState, maybeNotify } from "./services/reminders";
import InstallPrompt from "./components/InstallPrompt";
import { LEVELS } from "./constants/levels";
import { TEMPLATES } from "./constants/templates";
import { buildStarterBoard } from "./constants/onboarding";

import ToolbarButton from "./components/ToolbarButton";
import BoardItem from "./components/BoardItem";
import FrameItem from "./components/FrameItem";
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
import OnboardingModal from "./components/modals/OnboardingModal";
import BloomGarden from "./components/BloomGarden";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const HISTORY_LIMIT = 50;
// Snap threshold in *screen* pixels — divided by zoom to get world units.
const SNAP_THRESHOLD = 6;
const DEFAULT_GREETING = { role: "assistant", text: "Hi! I'm your Vision Coach ✨ What big dream are you working on? I can help with goals, affirmations, or ideas!" };

// ─ Frames: containment is *computed*, never stored ─
// An item belongs to a frame when its center lies inside the frame's rect.
// No parentId to migrate; dragging an item in/out of a frame "just works".
const itemsInFrame = (frame, list) =>
  list.filter(
    (i) =>
      i.id !== frame.id &&
      i.type !== "frame" &&
      i.x + i.width / 2 >= frame.x &&
      i.x + i.width / 2 <= frame.x + frame.width &&
      i.y + i.height / 2 >= frame.y &&
      i.y + i.height / 2 <= frame.y + frame.height
  );

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
  const [frameNavCollapsed, setFrameNavCollapsed] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastExportAt, setLastExportAt] = useState(null);
  // Ledger of habit-days that already paid XP ("itemId|dateKey" -> ts).
  // Prevents farming via done→undone→done toggles or note-edit re-saves.
  const [awardedDays, setAwardedDays] = useState({});

  // ─ Board bloom: local calendar day, ticked once a minute so a session that
  // crosses midnight resolves yesterday's charge without a reload. ─
  const [today, setToday] = useState(() => todayKey());
  useEffect(() => {
    const iv = setInterval(() => setToday((t) => (todayKey() === t ? t : todayKey())), 60000);
    return () => clearInterval(iv);
  }, []);
  // Celebration toast payload: the new garden total after a charge blooms.
  const [bloomToast, setBloomToast] = useState(null);

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
      const bc = data.boardConfig || { backgroundColor: "#f3f4f6" };
      // Anyone with an existing board predates (or already passed) onboarding —
      // stamp the flag so deleting every item later can never summon the wizard.
      if ((data.items || []).length > 0 && !bc.onboardedAt) bc.onboardedAt = Date.now();
      setBoardConfig(bc);
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
        // Frames carry their contents: items captured at drag start ride along by
        // the same (post-snap) delta. Positions derive from drag-start values, so
        // this stays correct however React batches the moves.
        const fdx = nx - dragState.ix;
        const fdy = ny - dragState.iy;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id === dragState.id) return { ...i, x: nx, y: ny };
            const cs = dragState.containedStart?.[i.id];
            if (cs) return { ...i, x: cs.x + fdx, y: cs.y + fdy };
            return i;
          })
        );
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
    cancelAnimationFrame(viewAnimRef.current); // manual zoom cancels a frame-nav flight
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
        cancelAnimationFrame(viewAnimRef.current); // manual pan cancels a frame-nav flight
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

  // Fit-to-content target view for a list of items (frames included — they're
  // ordinary items and count toward content bounds). Returns null when there's
  // nothing to frame or the board isn't mounted yet.
  const viewTargetFor = (list, pad = 60) => {
    const br = boardRef.current?.getBoundingClientRect();
    if (!br || list.length === 0) return null;
    const minX = Math.min(...list.map((i) => i.x));
    const minY = Math.min(...list.map((i) => i.y));
    const maxX = Math.max(...list.map((i) => i.x + i.width));
    const maxY = Math.max(...list.map((i) => i.y + i.height));
    const zoom = Math.min(
      1.25, // don't blow a tiny board up past readable scale
      Math.max(MIN_ZOOM, Math.min(br.width / (maxX - minX + pad * 2), br.height / (maxY - minY + pad * 2)))
    );
    return {
      zoom,
      x: br.width / 2 - ((minX + maxX) / 2) * zoom,
      y: br.height / 2 - ((minY + maxY) / 2) * zoom,
    };
  };

  // "Find my board": fit every item into the viewport. The rescue hatch for
  // an infinite canvas — works no matter how lost the view is.
  const fitViewTo = (list) => {
    const target = viewTargetFor(list);
    if (target) setView(target);
    else resetView();
  };
  const fitView = () => fitViewTo(items);

  // ─ Smooth camera flight (frame-nav chips) ─
  // Small rAF glide to a target view; reduced motion jumps instantly. Any manual
  // pan/zoom cancels the flight so the user always wins the camera.
  const viewAnimRef = useRef(0);
  const stopViewAnim = useCallback(() => cancelAnimationFrame(viewAnimRef.current), []);
  const animateViewTo = useCallback((to, duration = 600) => {
    if (!to) return;
    stopViewAnim();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      setView(to);
      return;
    }
    const from = { ...viewRef.current };
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const k = ease(t);
      setView({
        zoom: from.zoom + (to.zoom - from.zoom) * k,
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k,
      });
      if (t < 1) viewAnimRef.current = requestAnimationFrame(tick);
    };
    viewAnimRef.current = requestAnimationFrame(tick);
  }, [stopViewAnim]);

  // Cozy first frame: when the app opens onto a board that already has content, fit it into view
  // instead of dropping the user onto an empty, too-wide expanse. Runs once after load.
  const didInitialFrame = useRef(false);
  useEffect(() => {
    if (!loaded || didInitialFrame.current) return;
    didInitialFrame.current = true;
    if (items.length > 0) requestAnimationFrame(() => fitView());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // ─ Toast (transient status line: export progress errors, paste failures) ─
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ─ "Vision movie": ambient full-screen tour of the board ─
  // Chrome slides away (zen-mode pattern), then a rAF loop glides the existing
  // `view` state from item to item — ease-in-out flight, then a slow Ken Burns
  // push-in — looping until Esc/click/tap restores the prior view and chrome.
  const [playback, setPlayback] = useState(null); // { order: [itemIds] } while touring
  const [playIndex, setPlayIndex] = useState(0);
  const [playFade, setPlayFade] = useState(false); // reduced-motion crossfade veil
  const playbackRef = useRef(null);
  playbackRef.current = playback;
  const prePlaybackViewRef = useRef(null);

  const startPlayback = () => {
    if (itemsRef.current.length === 0) return;
    stopViewAnim(); // the tour owns the camera — kill any frame-nav flight
    prePlaybackViewRef.current = viewRef.current;
    // Tour stops: when life-area frames exist, tour those (each stop fits a whole
    // frame — one "chapter" per area) instead of every individual item.
    const frames = itemsRef.current.filter((i) => i.type === "frame");
    // Tour order: nearest-neighbor walk seeded at the top-left-most item, so the
    // camera wanders the board like a gallery visit instead of teleporting.
    const rem = frames.length > 0 ? [...frames] : [...itemsRef.current];
    rem.sort((a, b) => a.x + a.y - (b.x + b.y));
    const order = [rem.shift()];
    while (rem.length) {
      const cur = order[order.length - 1];
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < rem.length; i++) {
        const d = Math.hypot(
          rem[i].x + rem[i].width / 2 - (cur.x + cur.width / 2),
          rem[i].y + rem[i].height / 2 - (cur.y + cur.height / 2)
        );
        if (d < bd) { bd = d; bi = i; }
      }
      order.push(rem.splice(bi, 1)[0]);
    }
    setSelectedId(null);
    setShowProps(false);
    setShowAddMenu(false);
    setDragState({ isDragging: false }); // hard-stop any in-progress item drag
    setPanState(null);
    setPlayIndex(0);
    setPlayback({ order: order.map((i) => i.id) });
  };

  const stopPlayback = useCallback(() => {
    setPlayback(null);
    setPlayFade(false);
    if (prePlaybackViewRef.current) setView(prePlaybackViewRef.current);
  }, []);

  // The tour loop. ~5s per stop: 1.6s eased flight + 3.4s gentle push-in.
  // Reduced motion: no gliding — a brief veil fade over an instant reframe.
  useEffect(() => {
    if (!playback) return;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let raf = 0;
    let timer = 0;
    let cancelled = false;
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const targetView = (it) => {
      const br = boardRef.current?.getBoundingClientRect();
      if (!br) return viewRef.current;
      const pad = 110;
      const zoom = Math.min(
        1.6, // don't blow small stickers up to wall-size
        Math.max(MIN_ZOOM, Math.min(br.width / (it.width + pad * 2), br.height / (it.height + pad * 2)))
      );
      return { zoom, x: br.width / 2 - (it.x + it.width / 2) * zoom, y: br.height / 2 - (it.y + it.height / 2) * zoom };
    };
    const step = (i) => {
      if (cancelled) return;
      setPlayIndex(i);
      const next = () => step((i + 1) % playback.order.length);
      const it = itemsRef.current.find((x) => x.id === playback.order[i]);
      if (!it) { timer = setTimeout(next, 50); return; } // item deleted mid-tour
      const to = targetView(it);
      if (reduced) {
        setPlayFade(true);
        timer = setTimeout(() => {
          if (cancelled) return;
          setView(to);
          setPlayFade(false);
          timer = setTimeout(next, 4400);
        }, 350);
        return;
      }
      const from = { ...viewRef.current };
      const TRANS = 1600;
      const HOLD = 3400;
      const kb = Math.min(MAX_ZOOM / to.zoom, 1.06); // Ken Burns amplitude, zoom-capped
      const t0 = performance.now();
      const tick = (now) => {
        if (cancelled) return;
        const el = now - t0;
        if (el < TRANS) {
          const t = easeInOutCubic(el / TRANS);
          setView({
            zoom: from.zoom + (to.zoom - from.zoom) * t,
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
          });
          raf = requestAnimationFrame(tick);
        } else if (el < TRANS + HOLD) {
          const t = (el - TRANS) / HOLD;
          const z = to.zoom * (1 + (kb - 1) * t);
          const br = boardRef.current?.getBoundingClientRect();
          const cx = br ? br.width / 2 : 400;
          const cy = br ? br.height / 2 : 300;
          const scale = z / to.zoom;
          setView({ zoom: z, x: cx - (cx - to.x) * scale, y: cy - (cy - to.y) * scale });
          raf = requestAnimationFrame(tick);
        } else {
          next();
        }
      };
      raf = requestAnimationFrame(tick);
    };
    step(0);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [playback]);

  // Esc exits the movie (registered only while touring; the main shortcut
  // handler stands down during playback).
  useEffect(() => {
    if (!playback) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stopPlayback();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playback, stopPlayback]);

  // ─ Add item (centered in the current viewport, in world coords) ─
  const addItem = (type, content = "", extraProps = {}) => {
    const br = boardRef.current?.getBoundingClientRect();
    const w = type === "note" ? 200 : type === "sticker" ? 80 : type === "goals" ? 480 : type === "journal" ? 350 : type === "timer" ? 180 : type === "frame" ? 640 : 220;
    const h = type === "note" ? 200 : type === "sticker" ? 80 : type === "goals" ? 280 : type === "journal" ? 400 : type === "tracker" ? 340 : type === "timer" ? 120 : type === "frame" ? 420 : 120;
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
    const isFrame = item.type === "frame";
    // Frames live in their own background layer — raising one only reorders it
    // among frames, never above normal items.
    const zPool = isFrame ? items.filter((i) => i.type === "frame") : items;
    const maxZ = Math.max(...zPool.map((i) => i.zIndex || 0), 0);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, zIndex: maxZ + 1 } : i)));
    // Dragging a frame carries everything whose center is inside it — the set is
    // captured once at drag start (grab-what's-under-me, FigJam-style).
    const contained = isFrame ? itemsInFrame(item, items) : [];
    const containedStart = {};
    for (const c of contained) containedStart[c.id] = { x: c.x, y: c.y };
    // Snap candidates (other items' edges + centers) computed once per drag,
    // and the pre-drag snapshot for a single drag-end history entry.
    // Frames contribute only their edges (their center lines cross the middle of
    // a large region and made arranging items inside them noisy). Items riding
    // along with a dragged frame are excluded — they move too.
    const snapX = [];
    const snapY = [];
    for (const o of items) {
      if (o.id === item.id || containedStart[o.id]) continue;
      if (o.type === "frame") {
        snapX.push(o.x, o.x + o.width);
        snapY.push(o.y, o.y + o.height);
      } else {
        snapX.push(o.x, o.x + o.width / 2, o.x + o.width);
        snapY.push(o.y, o.y + o.height / 2, o.y + o.height);
      }
    }
    setDragState({
      isDragging: true, pointerId: e.pointerId, id: item.id,
      startX: e.clientX, startY: e.clientY, ix: item.x, iy: item.y,
      w: item.width, h: item.height, snapX, snapY, preSnapshot: items,
      containedStart,
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
    stopViewAnim(); // grabbing the canvas cancels a frame-nav flight
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
    showTemplateModal || showSettingsModal || showReviewModal || !!calendarModalData || confirmModal.isOpen ||
    (items.length === 0 && !boardConfig.onboardedAt); // onboarding wizard is up

  useEffect(() => {
    if (!loaded || viewMode !== "vision") return;
    const onKeyDown = (e) => {
      const t = e.target;
      if (t instanceof Element && (t.closest("input, textarea, select") || t.isContentEditable || t.closest('[contenteditable="true"]'))) return;
      if (modalOpenRef.current) return;
      if (playbackRef.current) return; // vision movie owns the keyboard (its own effect handles Esc)
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
        // Nudging a frame carries its contents, matching drag behavior.
        const movedIds = new Set([sel.id]);
        if (sel.type === "frame") for (const c of itemsInFrame(sel, itemsRef.current)) movedIds.add(c.id);
        setItems((prev) => prev.map((i) => (movedIds.has(i.id) ? { ...i, x: i.x + nudge[0], y: i.y + nudge[1] } : i)));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loaded, viewMode, undo, redo, duplicateItem, pushHistory]);

  // ─ First-run onboarding ─
  // Shows only for a truly fresh install: zero items AND never onboarded.
  // Existing users, imports, and restores all carry (or defensively receive)
  // onboardedAt, so this can never retrigger for them.
  const showOnboarding = loaded && items.length === 0 && !boardConfig.onboardedAt;

  const handleOnboardingCreate = (areaIds, backgroundColor) => {
    const starter = buildStarterBoard(areaIds);
    resetHistory();
    setItems(starter);
    setBoardConfig((prev) => ({ ...prev, backgroundColor, onboardedAt: Date.now() }));
    setViewMode("vision"); // mobile defaults to focus — show them the board they just made
    // Double rAF: let the vision canvas mount before framing the new items.
    requestAnimationFrame(() => requestAnimationFrame(() => fitViewTo(starter)));
  };

  const handleOnboardingSkip = () => setBoardConfig((prev) => ({ ...prev, onboardedAt: Date.now() }));

  // ─ Frictionless ingestion: clipboard paste + OS drag-and-drop ─
  // addItem closes over live view/items state; window-level handlers reach the
  // latest render through this ref instead of re-subscribing every render.
  const addItemRef = useRef(null);
  addItemRef.current = addItem;

  // Add an image item sized to its natural aspect ratio (280 wide). Centered at
  // (wx, wy) world coords when given, else at the viewport center via addItem.
  const addImageItem = useCallback((src, wx = null, wy = null) => {
    const img = new Image();
    const place = (w, h) => {
      const extra = { width: w, height: h };
      if (wx != null && wy != null) {
        extra.x = wx - w / 2;
        extra.y = wy - h / 2;
      }
      addItemRef.current("image", src, extra);
    };
    img.onload = () => place(280, Math.max(90, Math.min(420, Math.round((280 * img.height) / img.width))));
    img.onerror = () => place(220, 160);
    img.src = src;
  }, []);

  // Clipboard paste (vision mode only). Image blob → downscaled image item at the
  // viewport center; plain text (URL or not — no unfurl this round) → text item.
  // Never intercepts paste into inputs/textareas or while a modal is up.
  useEffect(() => {
    if (!loaded || viewMode !== "vision") return;
    const onPaste = async (e) => {
      if (modalOpenRef.current || playbackRef.current) return;
      const t = e.target;
      if (t instanceof Element && (t.closest("input, textarea, select") || t.isContentEditable || t.closest('[contenteditable="true"]'))) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const imgEntry = [...cd.items].find((it) => it.type.startsWith("image/"));
      if (imgEntry) {
        e.preventDefault();
        const file = imgEntry.getAsFile();
        if (!file) return;
        try {
          addImageItem(await fileToDataUrl(file));
        } catch {
          showToast("Couldn't read that image from the clipboard");
        }
        return;
      }
      const text = (cd.getData("text/plain") || "").trim();
      if (!text) return;
      e.preventDefault();
      addItemRef.current("text", text.slice(0, 2000));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loaded, viewMode, addImageItem, showToast]);

  // Drag-and-drop from the OS: image files land where they're dropped (world
  // coords), multiples fan out with slight offsets. `dragDepthRef` counts
  // enter/leave pairs so child elements don't flicker the highlight.
  const [dropActive, setDropActive] = useState(false);
  const dragDepthRef = useRef(0);
  const dragHasFiles = (e) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  const handleDragEnter = (e) => {
    if (!dragHasFiles(e) || playbackRef.current) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDropActive(true);
  };
  const handleDragOver = (e) => {
    if (!dragHasFiles(e) || playbackRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDragLeave = (e) => {
    if (!dragHasFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDropActive(false);
  };
  const handleDrop = async (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDropActive(false);
    if (playbackRef.current) return;
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    const rect = boardRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    const wx = rect ? (e.clientX - rect.left - v.x) / v.zoom : 300;
    const wy = rect ? (e.clientY - rect.top - v.y) / v.zoom : 200;
    for (let i = 0; i < files.length; i++) {
      try {
        addImageItem(await fileToDataUrl(files[i]), wx + i * 36, wy + i * 36);
      } catch {
        showToast(`Couldn't add "${files[i].name}" — not a readable image`);
      }
    }
  };

  // ─ Templates / clear / export / import ─
  const requestClearBoard = () => {
    setConfirmModal({
      isOpen: true,
      message: "Clear your entire vision board? A backup snapshot will be kept in Settings → Backups.",
      onConfirm: () => {
        SnapshotService.take(currentState(), "before-clear");
        resetHistory();
        setItems([]);
        // Clearing the board is a content reset, not an account reset: keep theme,
        // the onboarding flag (never re-show the wizard), and the bloom garden.
        // The pending charge is dropped — its trackers are gone.
        setBoardConfig((prev) => ({ backgroundColor: "#f3f4f6", theme: prev.theme, onboardedAt: prev.onboardedAt || Date.now(), blooms: prev.blooms }));
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
      setBoardConfig((prev) => ({ ...tpl.config, theme: prev.theme, onboardedAt: prev.onboardedAt || Date.now(), blooms: prev.blooms, bloomCharged: prev.bloomCharged }));
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

  // ─ PNG export: snapshot the board as an image ─
  // Renders items into an off-screen "stage" at fit-to-content bounds (zen-mode
  // BoardItems: no selection rings/handles/glow; dot grid included — it's part
  // of the look) and rasterizes it with html-to-image, loaded lazily so the
  // library stays out of the main chunk.
  const [pngStage, setPngStage] = useState(null); // { w, h, offX, offY } while capturing
  const [isExportingPng, setIsExportingPng] = useState(false);
  const pngStageRef = useRef(null);

  const handleExportPng = async () => {
    if (isExportingPng || itemsRef.current.length === 0) return;
    const its = itemsRef.current;
    setIsExportingPng(true);
    try {
      const { toPng } = await import("html-to-image");
      const pad = 80;
      const minX = Math.min(...its.map((i) => i.x));
      const minY = Math.min(...its.map((i) => i.y));
      const maxX = Math.max(...its.map((i) => i.x + i.width));
      const maxY = Math.max(...its.map((i) => i.y + i.height));
      const w = Math.ceil(maxX - minX + pad * 2);
      const h = Math.ceil(maxY - minY + pad * 2);
      // Browsers cap canvas dimensions (~16k px per side) — on huge boards,
      // trade pixel density for a capture that actually succeeds.
      const pixelRatio = Math.min(2, 16000 / Math.max(w, h));
      setPngStage({ w, h, offX: pad - minX, offY: pad - minY });
      // Wait for the off-screen stage to mount before capturing.
      await new Promise((resolve) => {
        const poll = () => (pngStageRef.current ? resolve() : requestAnimationFrame(poll));
        requestAnimationFrame(poll);
      });
      const dataUrl = await toPng(pngStageRef.current, {
        width: w,
        height: h,
        pixelRatio,
        backgroundColor: canvasBg,
        // Neutralize the stage's off-screen positioning on the clone.
        style: { left: "0px", top: "0px" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `dreamcanvas-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch (err) {
      console.error("PNG export failed", err);
      showToast("Image export failed — try again, or use the JSON export as a backup");
    } finally {
      setPngStage(null);
      setIsExportingPng(false);
    }
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
        // Defensive onboardedAt: restoring an older snapshot must never resurrect the wizard.
        setBoardConfig({ backgroundColor: "#f3f4f6", ...(data.boardConfig || {}), onboardedAt: data.boardConfig?.onboardedAt || Date.now() });
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
          // Defensive onboardedAt: an import (even of an empty pre-onboarding export)
          // must never retrigger the first-run wizard.
          setBoardConfig({ backgroundColor: "#f3f4f6", ...(data.boardConfig || {}), onboardedAt: data.boardConfig?.onboardedAt || Date.now() });
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

  // Life-area frames (background containers). Order is insertion order — stable
  // chips in the nav strip, stable stacking among frames.
  const frameItems = items.filter((i) => i.type === "frame");

  // ─ Board brightness tied to today's habit completion ─
  const trackers = items.filter((i) => i.type === "tracker");
  const doneTodayCount = trackers.reduce((acc, item) => {
    try {
      const data = JSON.parse(item.content || "{}");
      return acc + (normalizeDayData(data[today]).status === "done" ? 1 : 0);
    } catch {
      return acc;
    }
  }, 0);
  const completionRate = doneTodayCount / (trackers.length || 1);
  const boardBrightness = 0.92 + completionRate * 0.15;

  // ─ Board bloom: the daily-return loop (positive-only, no XP) ─
  // Completing ALL of today's habits "charges" today. On the first render of a
  // later day (fresh load or midnight rollover), the charge resolves into a
  // permanent bloom in the garden. Partial days simply don't charge — nothing
  // is ever lost, nothing ever decays.
  const allDoneToday = trackers.length > 0 && doneTodayCount === trackers.length;
  const bloomResolvedRef = useRef(null); // guards against double-resolve (StrictMode / re-renders)
  useEffect(() => {
    if (!loaded) return;
    const charged = boardConfig.bloomCharged;
    // ISO local-date strings compare correctly as strings. Any charge from an
    // earlier day blooms — a multi-day gap still counts (once), never punishes.
    if (charged && charged < today) {
      if (bloomResolvedRef.current === charged) return;
      bloomResolvedRef.current = charged;
      const newCount = (boardConfig.blooms || 0) + 1;
      setBoardConfig((prev) => ({ ...prev, blooms: (prev.blooms || 0) + 1, bloomCharged: null }));
      setBloomToast(newCount);
    } else if (!charged && allDoneToday) {
      setBoardConfig((prev) => (prev.bloomCharged ? prev : { ...prev, bloomCharged: today }));
    } else if (charged === today && !allDoneToday) {
      // Un-checking a habit (or deleting the last tracker) after charging keeps
      // the state honest: today is no longer fully complete, so no charge.
      setBoardConfig((prev) => ({ ...prev, bloomCharged: null }));
    }
  }, [loaded, today, allDoneToday, boardConfig.bloomCharged, boardConfig.blooms]);

  // Celebration toast auto-dismisses.
  useEffect(() => {
    if (bloomToast == null) return;
    const t = setTimeout(() => setBloomToast(null), 6000);
    return () => clearTimeout(t);
  }, [bloomToast]);

  const backupOverdue = items.length >= 8 && (!lastExportAt || Date.now() - lastExportAt > 7 * 86400000);

  // Canvas surface: in dark theme, the neutral light defaults follow the chrome into slate;
  // explicit color picks (Warm Paper, Rose, …) are respected as deliberate choices. The dot grid
  // and home-zone frame adapt to whichever surface actually shows, so the "Dark" board background
  // no longer clashes with the grid or the chrome.
  const canvasBg =
    isDark && ["#f3f4f6", "#ffffff"].includes(boardConfig.backgroundColor) ? "#0f172a" : boardConfig.backgroundColor;
  const canvasIsDark = ["#0f172a", "#1f2937"].includes(canvasBg);

  // Chrome slides away in zen mode and during vision-movie playback (same pattern).
  const chromeHidden = zenMode || !!playback;

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
          chromeHidden ? "-translate-y-full absolute w-full" : ""
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
            onClick={handleExportPng}
            disabled={isExportingPng || items.length === 0}
            className="p-1.5 text-gray-400 dark:text-slate-500 enabled:hover:text-purple-500 enabled:hover:bg-purple-50 dark:enabled:hover:bg-purple-900/30 rounded-lg disabled:opacity-40"
            title={isExportingPng ? "Rendering your board…" : "Export board as image (PNG)"}
          >
            {isExportingPng ? <Loader2 size={16} className="animate-spin text-purple-500" /> : <ImageDown size={16} />}
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
        {viewMode === "vision" && !playback && (
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
                chromeHidden ? "-translate-x-full absolute h-full" : ""
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
                  <button
                    onClick={() => addItem("frame", "Life Area", { color: "#8b5cf6" })}
                    title="Frame — group a life area"
                    className="text-left p-1.5 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded text-xs flex gap-2 text-gray-700 dark:text-slate-300"
                  >
                    <Frame size={14} /> Frame
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
              <ToolbarButton icon={Clapperboard} label="Movie" onClick={startPlayback} disabled={items.length === 0} />
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
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
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
                {/* Bloom garden: permanent, positive-only record of fully-completed days,
                    planted along the bottom edge of the home zone. */}
                {homeZone && (boardConfig.blooms || 0) > 0 && <BloomGarden count={boardConfig.blooms} zone={homeZone} />}
                {/* Frames layer: its own stacking context UNDER the items layer, so a
                    frame's zIndex only orders it among frames — never above content. */}
                <div className="absolute top-0 left-0" style={{ zIndex: 0 }}>
                  {frameItems.map((frame) => (
                    <div key={frame.id} className="board-item contents">
                      <FrameItem
                        item={frame}
                        isSelected={selectedId === frame.id}
                        onSelect={handlePointerDownItem}
                        onUpdate={handleUpdateItem}
                        zenMode={zenMode}
                        zoom={view.zoom}
                        onOpenProps={() => setShowProps(true)}
                        onResizeStart={handleItemResizeStart}
                        onResizeEnd={handleItemResizeEnd}
                      />
                    </div>
                  ))}
                </div>
                <div className="absolute top-0 left-0" style={{ zIndex: 1 }}>
                  {items.filter((i) => i.type !== "frame").map((item) => (
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
              {/* Full-canvas drop highlight while dragging image files over the board */}
              {dropActive && (
                <div className="absolute inset-2 z-40 rounded-2xl border-2 border-dashed border-purple-500 dark:border-purple-400 bg-purple-500/5 dark:bg-purple-400/10 pointer-events-none flex items-center justify-center">
                  <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-full px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 shadow-lg border border-purple-200/60 dark:border-purple-700/60">
                    Drop images to add them here
                  </div>
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

              {/* FRAME NAV — one chip per life-area frame; clicking flies the camera
                  to fit that frame. Hidden with the rest of the chrome (zen/playback). */}
              {!chromeHidden && frameItems.length > 0 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full shadow-lg border border-gray-200 dark:border-slate-700 px-1.5 py-1 max-w-[70%]">
                  {!frameNavCollapsed && (
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                      {frameItems.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => animateViewTo(viewTargetFor([f], 80))}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-gray-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 whitespace-nowrap"
                          title={`Go to "${safeContent(f.content) || "Untitled area"}"`}
                        >
                          <span className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: f.color || "#8b5cf6" }} />
                          <span className="max-w-[9rem] truncate">{safeContent(f.content) || "Untitled area"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setFrameNavCollapsed((c) => !c)}
                    className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-full flex-none"
                    title={frameNavCollapsed ? "Show frames" : "Hide frames"}
                  >
                    {frameNavCollapsed ? (
                      <span className="flex items-center gap-1">
                        <Frame size={13} />
                        <ChevronDown size={12} />
                      </span>
                    ) : (
                      <ChevronUp size={14} />
                    )}
                  </button>
                </div>
              )}

              {/* Ambient "charged" pill: today is fully complete — tomorrow it blooms. */}
              {!zenMode && boardConfig.bloomCharged === today && (
                <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full shadow-lg border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 pointer-events-none">
                  <Sprout size={13} className="text-emerald-500 dark:text-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Charged for tomorrow</span>
                </div>
              )}

              {/* Zoom controls */}
              {!chromeHidden && (
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

            {/* VISION MOVIE overlay — sits above the canvas (blocks all item/pan/zoom
                input while touring); any tap/click or Esc exits and restores the view */}
            {playback && (
              <div
                className="absolute inset-0 z-40 cursor-pointer select-none"
                style={{ touchAction: "none" }}
                onPointerDown={stopPlayback}
              >
                {/* Reduced-motion crossfade veil */}
                <div
                  className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${playFade ? "opacity-100" : "opacity-0"}`}
                  style={{ backgroundColor: canvasBg }}
                />
                {/* Progress hairline */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-black/10 dark:bg-white/10 pointer-events-none">
                  <div
                    className="h-full bg-purple-500/90 transition-all duration-700 ease-out"
                    style={{ width: `${((playIndex + 1) / playback.order.length) * 100}%` }}
                  />
                </div>
                {/* Stop counter — dots for small boards, n/m for big ones. Touch-friendly pill. */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur rounded-full shadow-lg border border-gray-200/70 dark:border-slate-700/70 px-5 py-3 pointer-events-none">
                  {playback.order.length <= 12 ? (
                    <div className="flex items-center gap-1.5">
                      {playback.order.map((id, i) => (
                        <span
                          key={id}
                          className={`rounded-full transition-all duration-300 ${
                            i === playIndex ? "w-2.5 h-2.5 bg-purple-600 dark:bg-purple-400" : "w-1.5 h-1.5 bg-gray-300 dark:bg-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-300 tabular-nums">
                      {playIndex + 1} / {playback.order.length}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">tap or Esc to exit</span>
                </div>
              </div>
            )}

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
        {/* First-run wizard — rendered outside the vision/focus split so a phone
            (which defaults to focus mode) still gets onboarded. */}
        {showOnboarding && <OnboardingModal onCreate={handleOnboardingCreate} onSkip={handleOnboardingSkip} />}
        {/* Bloom celebration: yesterday's charge resolved into a permanent garden bloom. */}
        {bloomToast != null && (
          <button
            onClick={() => setBloomToast(null)}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur rounded-full shadow-xl border border-pink-200 dark:border-pink-900 px-4 py-2 animate-bounce"
          >
            <Flower2 size={16} className="text-pink-500 dark:text-pink-400" />
            <span className="text-xs font-bold text-gray-700 dark:text-slate-200">
              Yesterday's effort bloomed — garden: {bloomToast} {bloomToast === 1 ? "bloom" : "blooms"}
            </span>
          </button>
        )}
      </div>

      {/* PNG EXPORT STAGE — off-screen, fit-to-content render of the board.
          zenMode BoardItems: no selection rings, handles, or streak glow.
          The dot grid is re-drawn here aligned to world coords (it's part of the look). */}
      {pngStage && (
        <div
          ref={pngStageRef}
          aria-hidden="true"
          className="fixed pointer-events-none"
          style={{ left: "-100000px", top: 0, width: pngStage.w, height: pngStage.h, backgroundColor: canvasBg, overflow: "hidden" }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(${canvasIsDark ? "#475569" : "#cbd5e1"} 1px, transparent 1px)`,
              backgroundSize: "20px 20px",
              backgroundPosition: `${pngStage.offX % 20}px ${pngStage.offY % 20}px`,
            }}
          />
          <div className="absolute top-0 left-0" style={{ transform: `translate(${pngStage.offX}px, ${pngStage.offY}px)` }}>
            {/* Frames render in their own under-layer, mirroring the live canvas. */}
            <div className="absolute top-0 left-0" style={{ zIndex: 0 }}>
              {items.filter((i) => i.type === "frame").map((frame) => (
                <FrameItem key={`export-${frame.id}`} item={frame} isSelected={false} zenMode={true} zoom={1} onSelect={() => {}} onUpdate={() => {}} />
              ))}
            </div>
            <div className="absolute top-0 left-0" style={{ zIndex: 1 }}>
              {items.filter((i) => i.type !== "frame").map((item) => (
                <BoardItem
                  key={`export-${item.id}`}
                  item={item}
                  isSelected={false}
                  zenMode={true}
                  zoom={1}
                  onSelect={() => {}}
                  onUpdate={() => {}}
                  onDayClick={() => {}}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOAST — transient status line (export failures, paste errors) */}
      {toast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[70] max-w-[90vw] bg-gray-900/95 dark:bg-slate-800/95 text-white dark:text-slate-100 text-sm px-4 py-2.5 rounded-full shadow-xl backdrop-blur border border-white/10 dark:border-slate-600/50">
          {toast}
        </div>
      )}
      <InstallPrompt />
    </div>
  );
}
