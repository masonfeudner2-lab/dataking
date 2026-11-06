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

## Open questions

| # | Question | Notes |
|---|---|---|
| Q1 | **Pushes inside a parlay:** does a pushed leg drop out (slip still wins if the rest win), or something else? | Currently: push drops out. Depends on the app. Kalshi combo settlement rules may differ, so we'll check them. |
| Q2 | **Showing slip prices if this goes public.** | Fine for you + friends (decision 11). Before a public launch, confirm with Kalshi (you're already asking them) or hide Kalshi prices. |
| Q3 | **Which multi-sport score API for NFL/NBA/NCAAB in Phase D?** | Candidates: BALLDONTLIE, API-Sports, SportsDataIO. Check current prices and whether the cheap tiers allow use in an app before choosing. |
| Q4 | **Licensing for the public hit-rate site (Phase E).** | An ad-funded public site counts as commercial redistribution. Many cheap plans forbid it. Get written OK from the provider. |
| Q5 | **Ads + age gating (Phase E).** | Ad networks have policies for gambling-adjacent content. Likely need a 21+ notice and responsible-gaming link. Quick legal check before going public. |
| Q6 | **App name.** | "Dataking" is a working name from the repo. |
| Q7 | **"Instant" live scores.** | Later. Needs a push/streaming feed (often a paid tier). |
| Q8 | **Overtime / ties in grading.** | Real feeds report the final including overtime, which the grading already uses. Some apps grade "regulation only" bets differently: handle when it comes up. |
