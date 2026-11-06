# Player stats providers for the hit-rate tracker

Research done 2026-11-06 for Phase E (public hit-rate pages, ad-supported) and Phase F (prop legs).
Prices and terms come from web searches. This session couldn't open the providers' own sites, so
**confirm everything on the live pages and in writing before paying or launching.**

## What we need

- Player **game logs** (one row per player per game: points, rebounds, yards, etc.) for NBA, NFL,
  college football and college basketball, updated after each day's games.
- A license that allows **showing those stats on a free public website with ads**. This is the hard part.
- Later (Phase F): using the same stats to **grade prop legs** on users' slips.

## Comparison

| Provider | Sports | Rough cost | Public site with ads allowed? | Notes |
|---|---|---|---|---|
| **BALLDONTLIE** | NBA, NFL, MLB, NHL, more | Free (5 req/min) · $9.99/mo · $39.99/mo **per sport** · $299.99/mo all sports | **Looks like yes.** Their terms' summary says data may be used "for any lawful personal or commercial purpose", including redistribution, with no attribution required. | ⚠️ The terms restrict "unverified use to accept, **grade**, or settle wagers". Ask whether grading a user's own slip for their personal tracking counts (it matters for Phase F). |
| **CollegeFootballData (CFBD)** + its basketball sister (CBBD) | College football (FBS + FCS) and college basketball, one key | Free 1,000 calls/mo · Patreon ~$1 / $5 / $10 per month (older figures) | **Likely yes.** The current terms (effective Aug 12, 2026) say commercial use is permitted on every tier; tiers only set the call quota. | The terms also have a "prohibited redistribution" section; read it to confirm public stat pages are fine. One key covers both sports. |
| **API-Sports** | Each sport is a separate API | From ~$10–40/mo per sport; free 100 req/day | **Unknown.** Commercial display terms weren't found. | Cheap, but data sourcing and terms are unclear. |
| **MySportsFeeds** | NFL, NBA, MLB, NHL | Personal ~$5 CAD/mo; commercial from ~$29 CAD/mo (unverified) | **Unknown.** Commercial tier terms weren't found. | Has player game logs. |
| **SportsDataIO** | All major US leagues + NCAA | Self-serve "Discovery Lab" ~$99/mo per league is **personal use only**; commercial is a sales quote | Yes with a commercial contract (typically allows display inside your product, not reselling the feed) | Solid and clearly licensed, but quote-only. Likely hundreds per month or more. |
| **Sportradar** | Everything (likely what Kalshi settles on) | Quote-only; estimates range ~$1,000 to $10,000+ per month, annual contracts | Yes, by contract | Long-term option. Reviewers say it's poorly suited to startups. 30-day trial available. |

## Recommendation

1. **College football + college basketball: CFBD/CBBD.** It's near-free, its terms already allow commercial
   use, and we're using it for college scores in Phase D anyway.
2. **NBA + NFL: BALLDONTLIE.** Its terms look the most permissive of the cheap options. Start with **NBA only
   on the $9.99 plan** and add NFL when it's worth it.
3. **Expected cost for v1 of the hit-rate site:** about **$10–60/month** depending on how many sports and how fast
   we need updates. Nightly updates need very few calls.
4. SportsDataIO and Sportradar only make sense once there's real traffic or revenue.

## Emails to send before Phase E

**To BALLDONTLIE:**
> I'm building a free, ad-supported website that shows how often players clear stat thresholds
> (e.g. "10+ points in 7 of last 10 games"), computed from your game logs and updated daily.
> 1) Does your standard paid plan allow displaying these derived stats publicly on an ad-supported site?
> 2) Separately, users can track their own bet slips in the app and see whether a player prop leg hit.
> No bets are placed, accepted or settled by us; it's personal tracking only. Does that fall under the
> restriction on using data to "grade or settle wagers"?

**To CollegeFootballData:**
> I'd like to show college football and basketball player stats and derived hit rates on a free,
> ad-supported website, updated daily from the API. Is that allowed under your terms (in particular the
> redistribution section), and is any attribution required?

## Sources

- [BALLDONTLIE](https://www.balldontlie.io/) and [BALLDONTLIE Terms of Service](https://www.balldontlie.io/terms.html)
- [CollegeFootballData Terms of Use](https://collegefootballdata.com/terms), [CFBD key page](https://collegefootballdata.com/key), [CFBD API v2 announcement](https://blog.collegefootballdata.com/api-v2-is-now-in-general-availability/), [CFBD GraphQL docs](https://graphqldocs.collegefootballdata.com/)
- [API-Sports](https://api-sports.io/), [Best NFL APIs in 2026 (Highlightly)](https://highlightly.net/blogs/best-nfl-apis-in-2026), [Best Sports API in 2026 (api.market)](https://api.market/blog/recodex/allsportsapi/best-sports-api)
- [MySportsFeeds pricing](https://www.mysportsfeeds.com/feed-pricing/), [Affordable sports APIs (SportsAPI.com)](https://sportsapi.com/blog/posts/affordable-sports-apis-for-developers)
- [SportsDataIO review (sportsapis.dev)](https://sportsapis.dev/apis/sportsdata-io), [SportsDataIO on Datarade](https://datarade.ai/data-providers/sportsdataio/profile), [SportsDataIO data rights help page](https://sportsdata.io/help/data-rights-and-licensing-questions), [Sports Data API comparison (SharpAPI)](https://sharpapi.io/compare/sports-data-apis)
- [Sportradar review (sportsapis.dev)](https://sportsapis.dev/apis/sportradar), [How much does sports data cost (LSports)](https://www.lsports.eu/blog/sports-data-cost), [Sportradar review (SportsAPIPro)](https://sportsapipro.com/reviews/sportradar)
