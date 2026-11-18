# Build a prop hit-rate site/app from my working tracker

## Who I am and what I want
I'm Mason. I bet NBA and NFL player props. I already have a working, automated Google Sheet that tracks how often every player has hit a set of stat lines (e.g. "Luka Dončić, 30+ points: 6/10 – 60%"). I want to turn it into a **website or app** that shows the same information in a much better interface. Longer term, this may become a **public, free hit-rate site monetized with ads**, so build it in a way that can grow into that.

**Before you write any code**, read this whole prompt and the files in this folder, then ask me your questions (see "Decisions I need you to ask me about"). Propose an architecture and a short build plan, and wait for my OK.

## What's in this folder
| File | What it is |
|---|---|
| `CLAUDE_CODE_PROMPT.md` | This prompt |
| `PropTracker.gs` | The full Google Apps Script that currently powers the Sheet (~1,080 lines). **It is the source of truth for the data logic.** Port its rules, don't reinvent them. |
| `Prop_Hit_Rate_Tracker_snapshot.xlsx` | Export of the live Sheet as of Nov 18, 2026: all tabs and all data |
| `csv/*.csv` | The same main tabs as CSV (NBA/NFL game logs, hit rates, players, settings) for easy seeding and testing |

The live Sheet is in my Google Drive ("Prop Hit-Rate Tracker"), and the Apps Script runs on a schedule. It keeps working while you build, so don't break it. The new app should run alongside it until it's proven, then replace it.

## What the current system does (verified working)
- **Schedule:** NBA every day ~5am PT (last night's FINAL games). NFL Tuesday ~10am PT plus a Wednesday ~10am PT re-run that picks up stat corrections and the second source.
- **Coverage:** every qualifying player, not just my bets.
  - NBA: players averaging **5+ minutes**.
  - NFL: QBs with a 10+ attempt game (passing lines only); players averaging 1+ target (receiving lines); players averaging 1+ carry (rushing lines). Offensive positions only.
  - A "watchlist" (the My Props tab) pins players I'm betting to the top and gets detailed notes. It's optional per player: sport + player are required; team, stat and line are optional.
- **Season:** current season only (NBA 2026-27, NFL 2026).
- **Stat ladders (all "at or above"):**
  - NBA Points: 5, 10, 15 … 40
  - NBA Assists: 2, 4 … 12
  - NBA Rebounds: 2, 4 … 14
  - NBA 3PM: 1–6
  - NFL Passing yards (QB only): 125, 150 … 350
  - NFL Passing TDs (QB only): 1–4
  - NFL Receiving yards: 10, **15**, 20, 30 … 150
  - NFL Receptions: 2–10
  - NFL Rushing yards: 10, **15**, 20, 30 … 150
  - These live in a Settings tab and must stay configurable (no hard-coding).
- **Per player + stat + line, it shows:** L5, L10, Season, Home, Away (each as "8/10 – 80%" plus a numeric %), average, median, current hit/miss streak, last 10 values (newest first), and the count of limited-minutes games in the L10.
- **Lookup:** pick a player and see his whole ladder as a grid (lines down the side, L5/L10/Season/Home/Away across) plus his last 10 game lines. **This is the view I use most.** It should be the heart of the app.
- **Daily Summary**, written every run:
  - what changed for watchlist players;
  - **trending up/down** = L5 hit rate 40+ percentage points above or below the season rate, with 6+ games;
  - **streaks** of 5+ (collapsed to the most meaningful line per player/stat);
  - top 10 league-wide trends;
  - newly out players (DNP after playing the previous game);
  - limited-minutes games;
  - everything unverified.

## DATA RULES: non-negotiable
I make real bets with this. Accuracy beats everything.
1. **Never guess or estimate a stat.** If a number can't be confirmed, store it as null/blank, flag it, and surface it in the UI as unverified. Never fill it in.
2. **DNP / inactive / not in the box score is NOT a miss.** Log it with a status and reason, and exclude it from every hit rate. Show it in game logs so I can see why a game is missing.
3. **Flag limited games, but still count them:** minutes (NBA) or offensive snap share (NFL) more than **35% below the player's season average**, or ejected. Show a visible marker.
4. **NFL zero-stat games:** a player who was on the field (per snap counts) but recorded no stats is a **real 0**, not a DNP. If snap counts aren't posted yet, the game is **PENDING** and excluded until confirmed.
5. **Cross-checks:**
   - NBA: each team's player sums for PTS/REB/AST/3PM must equal the team totals and the final score. If not, blank those stats for that game and retry for 14 days.
   - NFL: every player row must match nflverse on pass yds, pass TD, rush yds, receptions and rec yds. On a mismatch, blank that stat. Mismatches only in carries/targets/attempts are noted but don't blank anything.
   - Team passing yds ≠ receiving yds is a note only.
6. **FINAL games only.** Skip preseason and All-Star games. Keep regular season, play-in and postseason labeled.
7. **Name matching** between sources: normalize accents, punctuation and suffixes (Jr/Sr/II/III). Fall back to first-initial + last name, then to a unique last name on the same team that week (handles nicknames: Hollywood/Marquise Brown, Drew/Andrew Ogletree). Never match ambiguously; if unsure, leave it unmatched and flag it.
8. **Raw data stays clean and reusable:** one row per player per game, stable IDs, consistent column names (see the schemas in `PropTracker.gs`: `NBA_LOG_COLS`, `NFL_LOG_COLS`, `HIT_COLS`). Hit rates are always derived from game logs, never edited by hand.

## Data sources: what we learned the hard way
Tested from Google's servers on Nov 10, 2026. **Re-test from wherever you host**, because blocking is IP-based and differs by host.

| Source | Status | Notes |
|---|---|---|
| `site.api.espn.com` (ESPN site API) | ❌ **403 from Google Apps Script**, works from some other hosts | Same data as below |
| `site.web.api.espn.com/apis/site/v2/sports/{basketball/nba|football/nfl}/scoreboard` and `/summary?event=ID` | ✅ works | **Current primary source.** Box score is at `boxscore.players[].statistics[]` with `keys` / `athletes[].stats` arrays. Parse by key name, never by position. |
| `cdn.espn.com/core/{nba|nfl}/boxscore?xhr=1&gameId=ID` | ✅ (scoreboard verified) | Fallback; box score is under `gamepackageJSON.boxscore` |
| `cdn.nba.com` (NBA.com CDN) and `stats.nba.com` | ❌ 403 | Blocked from cloud servers |
| nflverse `stats_player_week_{year}.csv` and `snap_counts_{year}.csv` (GitHub releases) | ✅ works | NFL second source (built from official NFL play-by-play) plus snap counts. Usually posts by Tuesday/Wednesday. Team codes differ from ESPN: WSH→WAS, LAR→LA. |
| Basketball-Reference box scores | ✅ readable by Claude, but scraping-hostile | Was the planned NBA second source for a Claude spot-check task. Respect their terms and rate limits; don't build a scraper around it. |

Known ESPN gotchas:
- Fields like `"5-10"` (FG made-attempted) and `"16/26"` (completions/attempts) must be split.
- `didNotPlay: true` comes with a `reason`.
- Players absent from the box score entirely are inferred as NOT_IN_BOX for teams they've played for.
- The NBA season in ESPN's API is labeled `2027` for the 2026-27 season.

**Licensing:** ESPN's endpoints are unofficial and undocumented. If this becomes a public, ad-supported site, flag the terms-of-use risk to me and propose a compliant source (a paid or licensed stats API, or nflverse, which has an open license; confirm its terms). Don't silently build a commercial product on a scraped source.

## What I want from the new app
**Must have**
- **Player page / Lookup:** search a player and see his full ladder grid (L5 / L10 / Season / Home / Away, avg, median, streak) plus a game log with DNP and limited-game markers and the verification status of each game.
- **Browse/filter table:** sport, stat, line, min games, hit-rate window, sort by hit rate. Good for "show me every NBA player hitting 20+ points in 8/10 or better."
- **Watchlist ("My Props"):** I add/remove players (optionally stat + line). They're pinned and highlighted.
- **Daily summary / trends feed:** same logic as the Sheet's Daily Summary.
- **Automatic updates** on the same schedule, with no computer needed. Plus a visible "last updated" time per sport and a clear unverified/pending indicator.
- **Works great on my phone.** I check this on mobile before placing bets.

**Nice to have, later (design for it, don't build yet)**
- Public mode with SEO-friendly player pages and ad slots
- Opponent splits, with/without-teammate splits, combo props (PTS+REB+AST)
- Comparing my lines to current sportsbook lines

## Decisions I need you to ask me about
1. **Personal tool first, or public site from day one?** This changes auth, hosting and data-licensing choices.
2. **Hosting and budget:** free tier only, or a few $/month is OK?
3. **Stack.** Recommend one and explain why. I'm not a developer, so I want something simple to deploy and maintain. Scheduled jobs + a small database + a web front end is roughly what I picture.
4. **Keep the Google Sheet?** Options: retire it; keep it as a backup; or have the app write to it too.
5. **Data source** for a public version (see Licensing above).

## How to work
- Start by **reproducing the current numbers**. Load the CSVs and make sure your hit-rate calculations match the Sheet's `NBA Hit Rates` / `NFL Hit Rates` tabs exactly before building UI. Write automated tests for the data rules above (DNP excluded, limited flag, PENDING handling, team-total check, nflverse mismatch blanking, name matching, the 15-yard lines).
- Then build the ingestion job, then the UI.
- Explain things to me in plain language and tell me exactly what I need to click or run. I'm comfortable following steps but don't write code myself.
- Show me a working version early (even rough) so I can react to it.
