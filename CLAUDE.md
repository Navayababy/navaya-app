# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

No test runner is configured.

## Environment variables

Create a `.env` file at the root for local development:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The Vercel serverless function (`api/chat.js`) reads `ANTHROPIC_API_KEY` from the server environment (set in Vercel dashboard).

## Architecture

Navaya is a mobile-first React SPA (max-width 430px) for breastfeeding tracking. It is deployed to Vercel.

**Routing** — there is no React Router. `App.jsx` holds a `screen` state string (`'home' | 'history' | 'chat' | 'prepare'`) and conditionally renders the matching screen component. `NavBar` drives navigation by calling `setScreen`.

**Timer state** — the feed timer lives in `App.jsx` (not in `HomeScreen`) so it survives tab changes. `App` passes a `timer` prop bundle (`feedActive`, `feedSide`, `elapsed`, `startFeed`, `stopFeed`) down to `HomeScreen`.

**Data layer** — all user data is persisted to `localStorage` via `src/lib/storage.js`. This is the single source of truth for sessions, checklist state, preferences, and username. `src/lib/db.js` and `src/lib/supabase.js` contain a Supabase integration (auth, profiles, households, feed sessions, partner invites, realtime) that is scaffolded but not yet wired to the UI.

**AI chat** — `ChatScreen` POSTs conversation history to `/api/chat`, a Vercel serverless function that proxies to the Anthropic API (claude-sonnet-4-20250514) keeping the API key server-side.

**Theming** — `src/theme.js` exports `light`, `dark`, and `brand` colour palettes. Every component calls `palette(night)` to get the active colours. Night mode preference is persisted via `storage.js`. Typography uses Cormorant Garamond (headings/display) and DM Sans (body/UI), loaded from Google Fonts.

**Screens**
- `HomeScreen` — feed timer, side selector, post-feed mood check-in, recent sessions list, editable user name, night-mode toggle
- `HistoryScreen` — grouped feed log with weekly stats, collapsible day rows, tap-to-edit modal (`EditModal`)
- `ChatScreen` — AI breastfeeding advisor with suggestion chips on empty state
- `PrepareScreen` — pre-outing checklist with progress bar, custom items, localStorage persistence
