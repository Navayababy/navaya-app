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

**Routing** — there is no React Router. `App.jsx` holds a `screen` state string (`'home' | 'nappy' | 'sleep' | 'history' | 'chat' | 'prepare' | 'settings'`) and conditionally renders the matching screen component. `NavBar` shows five tabs (Feed, Nappy, Sleep, Logbook, Sage); `prepare` and `settings` have no tab and are reached from cards/buttons on `HomeScreen`.

**Timer state** — the feed and sleep timers live in hooks consumed by `App.jsx` (`useFeedTimer`, `useSleepTimer`) so they survive tab changes. `App` passes the timer prop bundles down to `HomeScreen` and `SleepScreen`.

**Data layer** — user data is persisted to `localStorage` via `src/lib/storage.js`, with optional household sharing through Supabase (`src/lib/db.js`, `src/lib/sync.js`, `src/lib/outbox.js`, `useHousehold`). Writes go to localStorage first, then sync to the shared household; offline writes queue in the outbox. Pure stats live in `src/lib/stats.js` and are unit-tested.

**AI chat** — `ChatScreen` POSTs conversation history to `/api/chat`, a Vercel serverless function that streams from the Anthropic API (claude-sonnet-4-6) keeping the API key server-side.

**Theming** — `src/theme.js` exports `light`, `dark`, and `brand` colour palettes. Every component calls `palette(night)` to get the active colours. Night mode preference is persisted via `storage.js`. Typography uses Cormorant Garamond (headings/display) and Jost (body/UI), loaded from Google Fonts.

**Language** — UK English throughout ("nappy", "wee/poo", "mum"). The history tab is called the **Logbook** in all user-facing copy.

**Screens**
- `HomeScreen` — feed timer (breast Left/Right or Bottle; bottle feeds capture amount in ml + expressed/formula via a post-feed sheet), side selector, post-feed mood check-in, recent feeds, prepare-checklist card, editable parent/baby names, night-mode toggle
- `NappyScreen` — wee/poo logging with poo-colour notes, today stats, recent list
- `SleepScreen` — sleep timer, time-since-last-sleep, today/last-sleep stats, manual backfill
- `HistoryScreen` — the Logbook: merged feed/nappy/sleep/medicine timeline grouped by day, today stats, last-7-days summary and weekly insights panel, add/edit modals
- `ChatScreen` — Sage, the AI breastfeeding advisor, with suggestion chips on empty state
- `PrepareScreen` — pre-outing checklist with progress bar, custom items (reached from the Home card, not the nav bar)
- `SettingsScreen` — account, household sharing/invites, manual sync, legal links
