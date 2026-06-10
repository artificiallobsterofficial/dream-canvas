# DreamCanvas — Digital Vision Board

A drag-and-drop vision board with habit tracking, goal lists, an XP/leveling system, an AI coach, and a daily Focus dashboard. Runs entirely in your browser; your board is saved to localStorage automatically.

## Run it

```sh
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173).

## AI features (optional)

Copy `.env.example` to `.env` and add **one** key:

- `VITE_ANTHROPIC_API_KEY` — uses Claude (preferred when both are set)
- `VITE_GEMINI_API_KEY` — uses Gemini (has a free tier)

Restart `npm run dev` after editing `.env`. Without a key, the coach/affirmations/breakdown features still work using built-in offline responses.

> ⚠️ The key is embedded in the browser app. This is fine for personal use on your own machine — never deploy a build containing a real key to a public URL.

## Using the board

| Action | How |
| --- | --- |
| Add widgets | `+` button in the left toolbar (text, sticky note, image, goal list, habit tracker, journal, countdown) |
| Move / resize | Drag an item; drag the bottom-right handle to resize |
| Pan the canvas | Drag empty canvas, or scroll |
| Zoom | `Ctrl` + scroll, or the controls in the bottom-right corner (click the % to reset) |
| Style an item | Select it — the properties panel (top right) has colors, fonts, rotation, layering, transparency |
| Track a habit | Click a day on a tracker; 3+ day streaks glow |
| Focus mode | Toggle in the header — daily habits, goals, journal, and XP in one dashboard |
| Zen mode | Eye icon, top right of the canvas — hides all chrome |
| Backup / restore | Download / Upload icons in the header (JSON file) |

## Data

Everything is stored in your browser's localStorage under `vision_board_v3_5_db`. Use Export regularly if the board matters to you — clearing browser data clears the board.
