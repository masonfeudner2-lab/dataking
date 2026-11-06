# Dataking

A sports betting companion, working name "Dataking". It has two connected parts:

1. **Parlay tracker:** upload a bet slip screenshot and follow every leg on one scoreboard. Legs grade themselves when games end, and the app keeps your record.
2. **Player hit-rate tracker:** free public pages showing how often players clear stat lines, linked from prop legs.

The repo works in phases. See [DECISIONS.md](DECISIONS.md) for every decision made so far and the open questions.

| Phase | What | Status |
|---|---|---|
| A | Fake data + scoreboard (tiles, drag to reorder, status bar, play-by-play, auto-grading, manual override) | **Done** |
| B | Slip screenshot upload → AI reads legs → confirm/edit screen → team matching | Next |
| C | Accounts, saved slips, your record and stats | |
| D | Real score feeds (CollegeFootballData + a multi-sport API) | |
| E | Player hit-rate tracker (public, no login) | |
| F | Prop legs linked to hit rates, automatic prop grading | |

`prototype/slip-reader.html` is the original single-file prototype, kept for reference.

---

## Try it on your computer

You need [Node.js](https://nodejs.org) version 20 or newer (the "LTS" download).

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000. No API keys are needed yet: the app runs on built-in fake games.

To try it on your phone on the same Wi-Fi network, open `http://<your-computer's-local-IP>:3000`.

## Put it online for free (Vercel)

This gives you a link you can text to friends. It takes about 5 minutes and you only do it once.

1. Go to https://vercel.com and sign up with your GitHub account.
2. Click **Add New → Project**, pick the `dataking` repository, and click **Deploy**. The default settings are correct.
3. You get a link like `dataking-yourname.vercel.app`. Every time new code is pushed, Vercel rebuilds it automatically, and each branch gets its own preview link.

On your phone, open the link and use **Share → Add to Home Screen** to get an app icon.

## Phase A: what to test

1. Tap **Load sample slip**. You'll get an 18-leg slip across college football (including FCS), NFL, NBA and college basketball.
2. The **status bar** reads like "6 of 18 legs won, 9 live, 3 not started", with a colored meter.
3. **Drag tiles** by the ⠿ handle. Try it with your finger on your phone. The order is remembered after a refresh.
4. **Tap a tile** to see its legs and play-by-play. FCS games (e.g. Prairie View A&M at Southern) say *"Score updates only"*.
5. **Demo clock** (bar at the bottom): press **+1h** a few times and watch games finish and legs flip to Won/Lost on their own.
6. **Manual override:** tap a game, then Won / Lost / Push on any leg. **Auto** puts the automatic grade back. The Jalen Hurts prop shows "Needs your call" once its game ends.
7. **Pick games:** add any other game to the board (e.g. Montana at Montana State), or take one off.
8. **Light/dark:** switch your phone's appearance and the app follows.

Everything is saved in your browser only for now. Accounts come in Phase C.

## For developers

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

`npm test` runs the grading and mock-feed tests, `npm run typecheck` checks types, and `npm run build` makes a production build.

### Where things live

```
src/
  app/
    page.tsx                     the board screen
    api/scoreboard/route.ts      GET today's games (browser → our server → data provider)
    api/games/[id]/plays/route.ts GET play-by-play for one game
  components/                    tiles, status bar, game picker, game detail, demo clock
  lib/
    types.ts                     shared shapes: Game, Play, Leg, Slip
    grading.ts                   moneyline/spread/total grading + slip summary (unit tested)
    providers/
      types.ts                   the "data switch" interface every feed must implement
      index.ts                   picks the feed from DATA_PROVIDER
      mock/                      fake teams, slate and game simulator
```

### Settings (environment variables)

Copy `.env.example` to `.env.local`. Never commit `.env.local`: it is git-ignored, and keys stay on the server.

| Name | Needed from | Meaning |
|---|---|---|
| `DATA_PROVIDER` | A | `mock` (default). Real feeds are added in Phase D. |
| `ANTHROPIC_API_KEY` | B | Reads slip screenshots. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | C | Accounts + database. |
| `CFBD_API_KEY` | D | CollegeFootballData.com. |
