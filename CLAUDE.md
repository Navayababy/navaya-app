# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
npm test         # Run unit tests (Vitest)
npm run lint     # ESLint
```

## Environment variables

Create a `.env` file at the root for local development:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The Vercel serverless function (`api/chat.js`) reads `ANTHROPIC_API_KEY` from the server environment (set in Vercel dashboard).

## Architecture

Navaya is a mobile-first React SPA (max-width 430px) for breastfeeding tracking. It is deployed to Vercel as a PWA.

**Routing** — there is no React Router. `App.jsx` holds a `screen` state string (`'home' | 'feed' | 'nappy' | 'sleep' | 'history' | 'chat' | 'prepare' | 'settings' | 'help'`) and conditionally renders the matching screen component. `NavBar` shows six tabs (Home, Feed, Nappy, Sleep, Sage, Logbook); `prepare` and `settings` have no tab and are reached from cards/buttons on `HomeScreen`; `help` is reached from the "? Help" corner button on `HomeScreen` and the "Help & FAQ" button in `SettingsScreen` (its back button returns to whichever opened it).

**Timer state** — the feed and sleep timers live in hooks consumed by `App.jsx` (`useFeedTimer`, `useSleepTimer`) so they survive tab changes. `App` passes the timer prop bundles down to `FeedScreen` and `SleepScreen`.

**Data layer** — user data is persisted to `localStorage` via `src/lib/storage.js`, with optional household sharing through Supabase (`src/lib/db.js`, `src/lib/sync.js`, `src/lib/outbox.js`, `useHousehold`). Writes go to localStorage first, then sync to the shared household; offline writes queue in the outbox. Pure stats live in `src/lib/stats.js` and are unit-tested.

**AI chat** — `ChatScreen` POSTs conversation history to `/api/chat`, a Vercel serverless function that streams from the Anthropic API (claude-sonnet-4-6) keeping the API key server-side.

**Error reporting** — `src/lib/logError.js` fire-and-forgets client errors to `/api/log`, a Vercel function that writes them to the function log (Vercel dashboard → Logs). Wired into `ErrorBoundary`, the global `error`/`unhandledrejection` listeners in `main.jsx`, and the sync layer's dropped-write paths. It is a no-op in dev builds and must never be awaited by callers.

**Theming** — `src/theme.js` exports `light`, `dark`, and `brand` colour palettes. Every component calls `palette(night)` to get the active colours. Night mode preference is persisted via `storage.js`. Typography uses Cormorant Garamond (headings/display) and Jost (body/UI), loaded from Google Fonts.

**Language** — UK English throughout ("nappy", "wee/poo", "mum"). The history tab is called the **Logbook** in all user-facing copy.

**Screens**
- `HomeScreen` — launcher and greeting screen: four oversized logging rows (Feed, Nappy, Sleep, Medicine — Medicine jumps straight to the Logbook's Add Medicine modal), an Ask Sage / Going-out card pair (with prepare progress), and a settings/sharing-status button. It only routes; the real logging UIs live on their own tabs
- `FeedScreen` — breast feed timer (Left/Right with a suggested side) with start/end time confirmation after stopping; Bottle is a timerless quick log (ml + expressed/formula, time defaulting to now, optional duration); post-feed mood check-in, today stats
- `NappyScreen` — wee/poo logging with poo-colour notes, today stats
- `SleepScreen` — sleep timer, time-since-last-sleep, today/last-sleep stats, manual backfill
- `HistoryScreen` — the Logbook: merged feed/nappy/sleep/medicine timeline grouped by day, today stats, last-7-days summary and weekly insights panel, add/edit modals
- `ChatScreen` — Sage, the AI breastfeeding advisor, with suggestion chips on empty state
- `PrepareScreen` — pre-outing checklist with progress bar, custom items (reached from the Home card, not the nav bar)
- `SettingsScreen` — parent/baby names, night-mode toggle, account, household sharing/invites, manual sync, support/legal links
- `HelpScreen` — in-app Help & FAQ: search plus category/question accordion over `src/lib/faqData.js` (reached from Home's "? Help" button and Settings, not the nav bar)
