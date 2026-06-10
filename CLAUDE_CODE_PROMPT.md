# DreamCanvas — Claude Code Continuation Prompt

## Project Overview

DreamCanvas is a React-based Vision Board web application. It's a personal goal-setting and habit-tracking tool with a canvas-based drag-and-drop interface, AI coaching features, gamification, and multiple view modes.

The app was originally started with Gemini AI integration and Supabase for cloud sync. It has since been rebuilt as a self-contained React artifact using the Anthropic API for AI features and `window.storage` (artifact persistent storage) for data persistence. **Your job is to convert this into a proper standalone Vite + React project** that can be deployed independently.

---

## Current Tech Stack (Artifact Version)

- **React 18** (functional components, hooks)
- **Tailwind CSS** (utility classes only, no compiler — just core classes)
- **Lucide React** for icons
- **Anthropic API** (`claude-sonnet-4-20250514`) for AI features (coach chat, affirmations, goal breakdown)
- **Artifact persistent storage** (`window.storage.get/set`) for saving board state

## Target Tech Stack (What You Should Build)

- **Vite + React 18**
- **Tailwind CSS 3** (with full compiler)
- **Lucide React**
- **Anthropic API** or **Gemini API** for AI features (user provides their own key via `.env`)
- **localStorage** for persistence (with optional Supabase cloud sync if user configures it)
- **Google Fonts**: Patrick Hand (handwriting), Inter (sans), Merriweather (serif), Fira Code (mono)

---

## Architecture

### File Structure to Create

```
dream-canvas/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── index.html
├── .env.example
├── src/
│   ├── main.jsx
│   ├── index.css
│   ├── App.jsx                  # Entry point, handles auth/routing
│   ├── components/
│   │   ├── BoardItem.jsx        # Draggable/resizable canvas item
│   │   ├── ToolbarButton.jsx    # Sidebar button component
│   │   ├── FocusDashboard.jsx   # Focus mode view
│   │   ├── FormatMessage.jsx    # Bold text formatter for chat
│   │   ├── modals/
│   │   │   ├── SettingsModal.jsx
│   │   │   ├── TemplateModal.jsx
│   │   │   ├── StickerModal.jsx
│   │   │   ├── LibraryModal.jsx
│   │   │   ├── ChatModal.jsx
│   │   │   ├── AIModal.jsx
│   │   │   ├── CalendarDayModal.jsx
│   │   │   ├── ImageUrlModal.jsx
│   │   │   └── ConfirmModal.jsx
│   │   └── widgets/
│   │       ├── TrackerCalendar.jsx
│   │       ├── GoalColumns.jsx
│   │       ├── CountdownWidget.jsx
│   │       ├── YouTubeWidget.jsx    # Was in original, not yet in artifact
│   │       └── SpotifyWidget.jsx    # Was in original, not yet in artifact
│   ├── services/
│   │   ├── storage.js           # localStorage + optional Supabase
│   │   └── ai.js                # AI API wrapper (Anthropic or Gemini)
│   ├── constants/
│   │   ├── colors.js
│   │   ├── templates.js
│   │   ├── stickers.js
│   │   ├── levels.js
│   │   └── library.js
│   └── utils/
│       ├── helpers.js           # generateId, normalizeDayData, safeContent, calculateStreak
│       └── xp.js                # XP/leveling logic
```

---

## Complete Feature List

### ✅ Implemented (in the artifact — port these)

1. **Canvas Board (Vision Mode)**
   - Infinite canvas with dot-grid background
   - Drag-and-drop positioning for all items
   - Click-to-select with purple ring highlight
   - Resize handle (bottom-right corner)
   - Delete button (top-right X)
   - Z-index management (bring forward / send backward)
   - Board background color customization (7 presets)
   - Board brightness tied to daily habit completion rate
   - Empty state with instructions

2. **Widget Types**
   - **Text**: Large bold text, editable when selected, color customizable
   - **Sticky Note**: Handwriting font (Patrick Hand), background color customizable (7 colors), editable
   - **Habit Tracker**: Full monthly calendar with day-click interaction, theme color (9 options), marker style (5 options: ✔️❤️⭐🔥💪), month navigation, progress bar, streak detection with glow effect + bounce badge
   - **Goal List**: 3-column layout (short/medium/long term), each with editable textarea
   - **Journal**: Serif font, border-left accent, editable
   - **Sticker**: Emoji-based, random rotation on placement, scales to fill container
   - **Image**: From URL, object-cover display
   - **Countdown Timer**: Gradient background, shows days/hours remaining

3. **Focus Dashboard Mode**
   - Toggle between Vision and Focus in header
   - 3-column responsive layout:
     - Left: Date display, daily signal quote (random from text items), scratchpad (synced to last note)
     - Center: Today's habits (tap to toggle done/undone, +20 XP each), short-term goals list, daily journal
     - Right: Level/XP display with progress bar, achievements grid (locked/unlocked)
   - Auto-defaults to Focus mode on mobile (< 768px width)

4. **AI Features**
   - **Goal Coach Chat**: Multi-turn conversation, suggested prompts for new users, typing indicator, clear/restart
   - **AI Affirmation Generator**: Enter a topic, get 3 personalized affirmations, click to add to board
   - **Magic Breakdown**: Click ⚡ on any text/goal item → AI generates 3-4 actionable steps → auto-added as a blue note nearby
   - All AI calls have local fallbacks if API fails

5. **Templates (5 presets)**
   - Wellness / That Girl
   - Tech Founder
   - 4.0 Student
   - Wanderlust / Travel
   - Iron Body / Fitness
   - Each includes pre-configured trackers, goals, text, notes, stickers
   - Confirmation dialog if board is not empty

6. **Sticker System**
   - 5 packs: Decor, Mood, Tape, Words, Luxury
   - Level-gated (Words = Lv2, Luxury = Lv3)
   - Locked packs show grayscale with lock icon

7. **Learning Library**
   - 3 categories: Manifestation 101, Color Psychology, Goal Setting
   - Each item has "Ask Coach" (opens chat with prompt) and "Add to Board" (creates note)

8. **Gamification / XP System**
   - Actions that grant XP:
     - Add item: +10 XP
     - Complete habit (done): +20 XP
     - Plan habit: +5 XP
     - Apply template: +50 XP
     - Chat with coach: +5 XP
   - 5 levels: Dreamer (0), Planner (100), Doer (300), Achiever (600), Visionary (1000)
   - XP notification with bounce animation
   - Level-up celebration notification
   - XP bar in header and Focus Dashboard

9. **Zen Mode**
   - Toggle button (eye icon, top-right of canvas)
   - Hides: toolbar, header, edit controls, streak badges, tracker UI chrome
   - Shows only the board content for distraction-free viewing

10. **Properties Panel**
    - Appears top-right when an item is selected
    - Context-sensitive controls based on item type:
      - Text: color picker (8 colors)
      - Note: background color picker (7 colors)
      - Tracker: theme color (9), marker style (5), transparent toggle
      - Timer: date picker
      - All: z-index controls, delete button

11. **Data Management**
    - Auto-save on every state change
    - Export to JSON file (download)
    - Clear board with confirmation dialog
    - Persistent storage across sessions

12. **Settings Modal**
    - Board background color selection
    - Clear board button

### 🔲 Not Yet Implemented (Build These)

1. **YouTube Widget** — embed player from URL, regex extraction of video ID
2. **Spotify Widget** — embed player from URL, extract pathname
3. **Image Upload from Device** — FileReader → base64 data URL → add as image item
4. **Import from JSON** — file input, parse JSON, restore board state
5. **Supabase Cloud Sync** (optional) — magic link auth, profiles table, items table with JSONB extra_props
6. **Board Pan/Zoom** — currently items can go off-screen with no way to scroll; add canvas panning
7. **Touch Support Improvements** — drag works with pointer events but could be smoother on mobile
8. **Undo/Redo** — history stack for item changes
9. **Image Generation** — the original used Gemini Imagen; could integrate any image gen API
10. **Font Style Selector** — dropdown in properties panel (sans, serif, mono, handwriting) — was in original, not in artifact
11. **Transparent Background Toggle** — for tracker/goals/journal widgets (was in original)
12. **Item Rotation** — stickers get random rotation but there's no manual rotation control
13. **GIF Support** — paste GIF URL in sticker modal's GIF tab

---

## Key Implementation Details

### Drag and Drop System
```
- onPointerDown on item → store startX/Y and item's initial X/Y in dragState
- window pointermove listener → calculate delta, update item position
- window pointerup listener → clear dragState
- Items that contain textarea/input stop propagation to prevent drag while editing
- Selected item gets max z-index + 1
```

### Habit Tracker Calendar Logic
```
- Content is JSON string: { "2025-04-03": { status: "done", event: "notes" } }
- normalizeDayData() handles legacy formats (boolean true, string status)
- calculateStreak() counts consecutive "done" days backward from today
- Streak >= 3 shows gold glow ring + bounce badge
- Day click opens CalendarDayModal with Done/Planned toggle + note field
```

### XP / Leveling
```
- XP stored as integer, level derived from LEVELS thresholds
- addXp(amount) checks if new total crosses a level boundary
- Level-up triggers special notification text
- XP unlocks sticker packs
```

### AI API Integration
```
- Current: Anthropic API (claude-sonnet-4-20250514), no API key needed in artifacts
- For standalone: user provides VITE_ANTHROPIC_API_KEY or VITE_GEMINI_API_KEY in .env
- All AI calls wrapped in try/catch with local fallbacks
- Chat sends full conversation history each call
- Affirmation generator asks for JSON array response, cleans markdown fences before parsing
- Magic Breakdown asks for bulleted list, creates note item with result
```

### Auto-Save
```
- useEffect watches [items, boardConfig, userXp, userLevel]
- Saves entire state object: { profile: {xp, level}, items, boardConfig, lastActive }
- For standalone: use localStorage with key 'vision_board_v3_5_db'
```

---

## .env.example

```
# AI Provider (pick one)
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Supabase (optional, for cloud sync)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

---

## Supabase Schema (if implementing cloud sync)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT,
  x REAL DEFAULT 0,
  y REAL DEFAULT 0,
  width REAL DEFAULT 200,
  height REAL DEFAULT 150,
  extra_props JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage own items" ON items FOR ALL USING (auth.uid() = user_id);
```

---

## Style Guide

- **Primary accent**: Purple-600 (#9333ea) for selections, active states
- **Gradients**: Purple-to-blue for branding, emerald for habits, indigo for AI/coach
- **Border radius**: rounded-xl for cards, rounded-2xl for modals, rounded-full for avatars/buttons
- **Shadows**: shadow-sm for cards, shadow-2xl for modals, shadow-lg for floating elements
- **Text**: text-gray-900 for headings, text-gray-600 for body, text-gray-400 for labels
- **Labels**: text-[10px] uppercase tracking-wider font-bold for section labels
- **Animations**: animate-bounce for XP/streaks, animate-pulse for AI loading, animate-spin for loaders
- **Backdrop blur**: backdrop-blur-sm on modal overlays
- **Fonts**: Inter (UI), Patrick Hand (notes), serif (journal), mono (code/XP counters)

---

## Getting Started with This Prompt

1. Read this entire document first
2. The current working artifact code is in `dreamcanvas.jsx` — use it as your reference implementation
3. Start by scaffolding the Vite project and splitting the monolithic component into the file structure above
4. Port each feature, testing as you go
5. Then tackle the "Not Yet Implemented" features in priority order
6. Keep the same visual design and interactions — users are already familiar with the current UI
