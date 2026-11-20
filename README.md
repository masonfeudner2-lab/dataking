# Dataking

A sports betting companion, working name "Dataking". It has two connected parts:

1. **Parlay tracker:** upload a bet slip screenshot and follow every leg on one scoreboard. Legs grade themselves when games end, and the app keeps your record.
2. **Player hit-rate tracker:** free public pages showing how often players clear stat lines, linked from prop legs.

The repo works in phases. See [DECISIONS.md](DECISIONS.md) for every decision made so far and the open questions.

| Phase | What | Status |
|---|---|---|
| A | Fake data + scoreboard (tiles, drag to reorder, status bar, play-by-play, auto-grading, manual override) | **Done** |
| B | Slip screenshot upload → AI reads legs → confirm/edit screen → team matching | **Done** (needs your Claude API key to read real screenshots) |
| C | Accounts, saved slips, your record and stats | Next |
| D | Real score feeds (CollegeFootballData + a multi-sport API) | |
| E | Player hit-rate tracker: `/props` (player ladders, browse, watchlist, daily summary) | **In progress**: math ported and verified; screens run on your Sheet's Nov 18 snapshot. Automatic updates next. |
| F | Prop legs linked to hit rates, automatic prop grading | |

`prototype/slip-reader.html` is the original single-file prototype, kept for reference.
`docs/hit-rate-providers.md` compares player-stats providers for the hit-rate tracker.

---

## Try it on your computer

You need [Node.js](https://nodejs.org) version 20 or newer (the "LTS" download).

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000. The app runs on built-in fake games, so no keys are needed for that.
To read real slip screenshots, add a Claude API key (next section).

## Turn on slip reading (Claude API key)

1. Go to https://console.anthropic.com, sign up, and add a small amount of credit (e.g. $5) under **Billing**.
   Each slip read costs roughly 5–10 cents (an estimate; we'll measure it on real slips).
2. Under **API keys**, create a key. It starts with `sk-ant-`. Treat it like a password.
3. Add it where the app runs:
   - **On Vercel:** Project → **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` with your key, then redeploy.
   - **On your computer:** create a file named `.env.local` in the project folder containing `ANTHROPIC_API_KEY=sk-ant-...`.
     This file is never committed to GitHub.
4. Recommended once you share the link: also add `SLIP_READER_PASSCODE` (any word you like). Friends type it once
   on their phone, and strangers who find the link can't spend your Claude credit.

Never paste the key into the code, a chat, or a screenshot.

To try it on your phone on the same Wi-Fi network, open `http://<your-computer's-local-IP>:3000`.

## Put it online for free (Vercel)

This gives you a link you can text to friends. It takes about 5 minutes and you only do it once.

1. Go to https://vercel.com and sign up with your GitHub account.
2. Click **Add New → Project**, pick the `dataking` repository, and click **Deploy**. The default settings are correct.
3. You get a link like `dataking-yourname.vercel.app`. Every time new code is pushed, Vercel rebuilds it automatically, and each branch gets its own preview link.

On your phone, open the link and use **Share → Add to Home Screen** to get an app icon.

## Phase E (hit rates): what to test

Open `/props` (or tap **Hit rates** on the board). It runs on your Sheet's Nov 18 snapshot for now, so the numbers don't change yet.

1. **Search** a player (try "Brunson" or "Henry"). His page shows the full ladder: L5 / L10 / Season / Home / Away and streak, colored by hit rate.
2. **Tap a line** (e.g. 25+). Hits and misses for that line light up in the game log. Tap **Watch this line** to pin it.
3. The **game log** shows every game: DNP / out / pending rows say why and are marked "not counted". ⚠ = limited minutes or snaps (counted, but flagged). A red **?** = a stat that failed a cross-check (blank on purpose).
4. **Browse**: e.g. NBA · Points · 20+ · L10 · at least 80%. Every player hitting it, best first; your watched players on top.
5. **Daily summary**: the same sections as the Sheet's Daily Summary.
6. **My props** (on the Players tab): your pinned players and lines. For now they're saved on this phone only (a cookie); they move to the database in the next step.

The data rules live in `src/lib/props/` and are checked by `npm test`, which proves the port matches your Sheet row for row (`reproduce.test.ts`) and tests each data rule (`rules.test.ts`).

## Hit rates: how the automatic updates work

Nothing runs on your computer. GitHub runs the job on its servers (`.github/workflows/update-data.yml`):

| When (Pacific time) | What |
|---|---|
| Every day ~3:10am (4:10am in summer); GitHub often starts it up to an hour or so late | NBA: last night's FINAL games, re-checks the last 14 days (and the whole season weekly) for ESPN stat corrections |
| Tuesday + Wednesday ~10:10am (11:10am in summer) | NFL: the week's FINAL games, re-checks the last 14 days, cross-checks every player against nflverse + snap counts |

Each run saves the data in `data/live/` and commits it ("Data: nba update …"). Vercel then rebuilds the site with the new numbers, usually within 2 minutes. If a run has problems (ESPN down, nflverse not posted yet), it saves whatever loaded, the site shows "last update incomplete, retrying", and GitHub emails you.

**Run an update now:** GitHub → your repo → **Actions** → **Update hit-rate data** → **Run workflow** → choose nba, nfl or both → **Run workflow**.

**Change ladders or thresholds:** edit `data/settings.csv` on GitHub (same layout as the Sheet's Settings tab), commit. The site picks it up on the next deploy.

**Compare with the Sheet:** `npx tsx scripts/compare-sheet.ts` compares `data/live` with the Sheet export in `data/snapshot-2026-11-18`, game by game.

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

## Phase B: what to test

1. On the board, tap **Read a slip**.
2. **Without a key:** tap **Try a sample slip**. It's a realistic messy read of 13 legs: "Miss. Valley St.", "Hawai'i",
   a cut-off "Prairie View A&M vs Southern ...", a "Prairie View" leg with no league, a cut-off "Montana St...",
   and a Jalen Hurts prop.
3. Check the **confirm screen**:
   - 3 legs are flagged in orange, each with a reason.
   - "Prairie View A&M" had its cut-off opponent filled in from the schedule ("Opponent filled in…").
   - For "Prairie View" (no league), pick the right game from the dropdown, then tap the team you picked.
   - For the Hurts prop, choose the Eagles game. For "Montana St...", tap **Looks right**.
   - Edit any field, delete a leg (×), or **Add a leg**.
4. Tap **Build my board**. The board fills in with your legs. **Edit legs** on the board brings you back.
5. **With a key:** upload real screenshots. For a long slip, select all its screenshots at once.
   `public/samples/sample-slip.png` is a generic 14-leg test screenshot you can download and try.

Matching only looks at **today's** games for now (see DECISIONS.md, Q10).

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
    read/page.tsx                the "Read a slip" + confirm screen
    api/extract/route.ts         POST screenshots → Claude → legs as JSON
  components/                    tiles, status bar, game picker, game detail, demo clock
  lib/
    types.ts                     shared shapes: Game, Play, Leg, Slip
    grading.ts                   moneyline/spread/total grading + slip summary (unit tested)
    extract/                     what Claude is asked (prompt.ts), the JSON shape (schema.ts), sample read
    matching/                    name cleanup + matching legs to games (match.ts), team alias table (aliases.ts)
    client/prepareImages.ts      shrinks and slices screenshots in the browser before upload
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
| `SLIP_READER_PASSCODE` | B (optional) | If set, reading a slip asks for this passcode once per phone. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | C | Accounts + database. |
| `CFBD_API_KEY` | D | CollegeFootballData.com. |
