# Decisions and open questions

A running log in plain language. Newest entries at the bottom of each section.

## Decisions

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-11-06 | **Audience for now: you + friends.** No public launch yet. | Keeps legal, polish and cost needs small while the product takes shape. |
| 2 | 2026-11-06 | **Budget: as close to $0 as possible**, spend when it clearly helps. | Phases A–C run on free tiers (Vercel, Supabase). Claude API costs a few cents per slip read. |
| 3 | 2026-11-06 | **Stack: Next.js + TypeScript, installable web app (PWA), hosted on Vercel; Supabase for accounts + database (Phase C).** | One codebase for screens and server. Free to start. Every push gets a shareable link. |
| 4 | 2026-11-06 | **Data switch ("provider" layer).** The app talks only to a `ScoreProvider` interface (`src/lib/providers/types.ts`). Feeds are plug-ins chosen by `DATA_PROVIDER`. | Swap mock → CollegeFootballData / multi-sport API → Sportradar without rewriting screens. A future Kalshi account sync plugs in the same way as a slip source. |
| 5 | 2026-11-06 | **Mock feed first**, with a demo clock to fast-forward fake games. Same games every day; scores are repeatable. | Build and test the UI without paying for data. The demo clock lets us watch games finish and legs grade on demand. |
| 6 | 2026-11-06 | **Sports in v1: college football (FBS + FCS), NFL, NBA, college basketball.** MLB/NHL later. | You asked to add college basketball. It has the same small-school naming problem as FCS. |
| 7 | 2026-11-06 | **Scores refresh every 30s on real feeds** (5s on demo data); refresh pauses when the app is in the background. "Instant" updates are a later upgrade. | Cheap and simple. Instant needs a streaming feed and costs more. |
| 8 | 2026-11-06 | **Auto-grading built in Phase A** (moneyline, spread, total) against fake finals. Manual override always wins. Results labeled "unofficial". | It's pure math, so it's ready before real data arrives. Each app settles by its own rules. |
| 9 | 2026-11-06 | **A slip is lost as soon as any leg loses.** | Your call. Standard parlay rule. |
| 10 | 2026-11-06 | **Prop legs are graded by hand until Phase F.** They show "Needs your call" when the game ends. | Auto-grading props needs player box-score stats, which arrive with the hit-rate tracker. |
| 11 | 2026-11-06 | **Price on a slip (e.g. Kalshi "86%") is saved with your slip and shown only to you.** It is never shared, combined across users, or shown publicly. | You're only reading your own screenshot back to yourself. Revisit before any public launch (see open question Q2). |
| 12 | 2026-11-06 | **Hit-rate pages are public with no login**, in the same app. | Ad-supported and shareable. Prop legs link straight to them. |
| 13 | 2026-11-06 | **Look: kept the prototype's field green + amber scoreboard numbers + condensed font**, added light mode that follows the phone. | Your call to leave it to me. It's distinctive and reads well outdoors. |
| 14 | 2026-11-06 | **Prototype saved at `prototype/slip-reader.html`** for reference. | Your call to leave it to me. |
| 15 | 2026-11-06 | **Real team names as plain text; no logos, no video.** Mock data uses real names with fake scores. | Matches your constraints. Real names make Phase B name matching realistic. |
| 16 | 2026-11-06 | **No scraping. No Kalshi data/API in v1. No sportsbook links or promotion.** | Your constraints (Kalshi data terms, licensed feeds only, CA affiliate rules). |
| 17 | 2026-11-06 | **Order stays: B (slip upload) next, with hit-rate provider research alongside.** | Your call. The tracker is your daily problem. Data licensing for public stats takes the longest, so it starts now (see `docs/hit-rate-providers.md`). |
| 18 | 2026-11-06 | **Slip reading uses Claude Opus 5.5 (`claude-opus-5-5`) at "medium" effort, with structured outputs** so the reply always matches your JSON shape. | The current recommended model, and good at reading screenshots. Medium effort keeps cost and wait time down. Easy to change in `src/app/api/extract/route.ts`. |
| 19 | 2026-11-06 | **Server-side fallback is switched on** for slip reading. | If Claude's safety checks wrongly decline a slip image, the API retries on a recommended fallback model instead of failing. |
| 20 | 2026-11-06 | **Screenshots are shrunk and cut into overlapping pieces in the browser** before upload (about 1000px wide, up to 12 pieces). Several screenshots can be uploaded at once for one long slip. | Keeps text readable for very tall 15–20 leg slips, stays under hosting upload limits (~4.5 MB), and lowers cost. A 14-leg test slip became 3 pieces, ~330 KB. |
| 21 | 2026-11-06 | **Matching rule: never guess silently.** A unique, confident match is filled in (including a cut-off opponent, with a visible note). Anything ambiguous stays flagged in orange with a reason, and the user picks the game. A cut-off *pick* name always stays flagged. | Your rule ("never invent a truncated opponent; flag anything ambiguous"). Filling an opponent from the schedule is not inventing: it shows where it came from. |
| 22 | 2026-11-06 | **Team aliases live in one shared table** (`src/lib/matching/aliases.ts`), separate from any data feed. Common short forms (St., Miss., N./S., Okla.) and accents/ʻokina are handled automatically. | Works with any provider. When a real slip uses a new spelling, add one line. |
| 23 | 2026-11-06 | **Optional passcode (`SLIP_READER_PASSCODE`)** for slip reading. | A public link means anyone could spend your Claude credit. Accounts (Phase C) will replace this. |
| 24 | 2026-11-06 | **Hit-rate providers (recommendation): CFBD/CBBD for college, BALLDONTLIE for NBA/NFL**, starting NBA-only on the cheapest plan. | Cheapest options whose terms appear to allow commercial use. Must confirm in writing (Q4). |

## Open questions

| # | Question | Notes |
|---|---|---|
| Q1 | **Pushes inside a parlay:** does a pushed leg drop out (slip still wins if the rest win), or something else? | Currently: push drops out. Depends on the app. Kalshi combo settlement rules may differ, so we'll check them. |
| Q2 | **Showing slip prices if this goes public.** | Fine for you + friends (decision 11). Before a public launch, confirm with Kalshi (you're already asking them) or hide Kalshi prices. |
| Q3 | **Which multi-sport score API for NFL/NBA in Phase D?** | Leaning BALLDONTLIE (same provider as hit rates; one bill). College via CFBD/CBBD. Live scores may need their faster tier. |
| Q4 | **Licensing for the public hit-rate site (Phase E).** | BALLDONTLIE and CFBD terms look permissive, but get written OK. Draft emails are in `docs/hit-rate-providers.md`. |
| Q5 | **Ads + age gating (Phase E).** | Ad networks have policies for gambling-adjacent content. Likely need a 21+ notice and responsible-gaming link. Quick legal check before going public. |
| Q6 | **App name.** | "Dataking" is a working name from the repo. |
| Q7 | **"Instant" live scores.** | Later. Needs a push/streaming feed (often a paid tier). |
| Q8 | **Overtime / ties in grading.** | Real feeds report the final including overtime, which the grading already uses. Some apps grade "regulation only" bets differently: handle when it comes up. |
| Q9 | **BALLDONTLIE's "grade or settle wagers" restriction vs. auto-grading prop legs (Phase F).** | Ask them (draft email in `docs/hit-rate-providers.md`). If it's a problem, props stay hand-graded or use another source. |
| Q10 | **Slips that span several days** (e.g. Saturday college + Sunday NFL). | Matching only checks today's games right now. Phase D will search a few days ahead when the real schedule is plugged in. |
| Q11 | **Real-world accuracy of slip reading.** | Not tested on real slips yet (needs your API key). Send 3–5 real screenshots, especially long Kalshi ones, and we'll tune the prompt and alias table. |
