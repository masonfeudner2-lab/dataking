// Tries each candidate data source once and prints what came back. Run: node scripts/test-sources.mjs
const UA = { "User-Agent": "Mozilla/5.0 (compatible; prop-tracker/1.0)", Accept: "application/json, text/plain, */*" };
const tests = [
  ["ESPN site.web.api NBA scoreboard", "https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100&dates=20261117"],
  ["ESPN site.web.api NBA summary", "https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401910002"],
  ["ESPN site.web.api NFL scoreboard", "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates=2026&seasontype=2&week=10"],
  ["ESPN site.web.api NFL summary", "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401873065"],
  ["ESPN site.api NBA scoreboard", "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261117"],
  ["ESPN cdn NBA boxscore", "https://cdn.espn.com/core/nba/boxscore?xhr=1&gameId=401910002"],
  ["NBA.com cdn scoreboard", "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"],
  ["nflverse snap counts", "https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_2026.csv"],
];
for (const [name, url] of tests) {
  let line;
  try {
    const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    let note = "";
    if (r.ok && /summary|boxscore/.test(url)) {
      try { const j = JSON.parse(t); const b = j.boxscore || j.gamepackageJSON?.boxscore; note = b?.players ? `box score present (${b.players.length} teams)` : "NO box score"; } catch { note = "not JSON"; }
    }
    if (r.ok && /scoreboard/.test(url)) { try { note = `${JSON.parse(t).events?.length ?? "?"} events`; } catch { note = "not JSON"; } }
    line = `HTTP ${r.status}, ${t.length} chars ${note}`;
  } catch (e) { line = "FAILED: " + String(e).slice(0, 120); }
  console.log(`${name.padEnd(36)} ${line}`);
}
