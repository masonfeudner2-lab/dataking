// Compare the app's data (data/live) with the Google Sheet, game by game.
// Usage: npx tsx scripts/compare-sheet.ts [sheetDir]   (default: data/snapshot-2026-11-18)
// The Sheet folder needs nba_game_logs.csv and nfl_game_logs.csv (the Sheet's own column names).
// Only games present in both are compared; games only one side has are counted separately.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadNbaLogs, loadNflLogs } from "../src/lib/props/csv";
import { LiveStore } from "../src/lib/props/ingest/files";
import type { LogRow } from "../src/lib/props/schema";

const sheetDir = process.argv[2] || "data/snapshot-2026-11-18";
const live = new LiveStore();

function compare(name: string, sheet: LogRow[], app: LogRow[], fields: string[]) {
  const k = (r: LogRow) => r.game_id + "|" + r.player_id;
  const sheetGames = new Set(sheet.map((r) => r.game_id)), appGames = new Set(app.map((r) => r.game_id));
  const both = new Set([...sheetGames].filter((g) => appGames.has(g)));
  const A = new Map(app.filter((r) => both.has(r.game_id)).map((r) => [k(r), r]));
  const S = new Map(sheet.filter((r) => both.has(r.game_id)).map((r) => [k(r), r]));
  const diffs: string[] = []; const counts: Record<string, number> = {};
  for (const [key, s] of S) {
    const a = A.get(key);
    if (!a) { counts["only in Sheet"] = (counts["only in Sheet"] || 0) + 1; diffs.push(`only in Sheet: ${s.player} ${s.game_date} ${s.status}`); continue; }
    for (const f of fields) {
      const sv = String((s as unknown as Record<string, unknown>)[f] ?? ""), av = String((a as unknown as Record<string, unknown>)[f] ?? "");
      if (sv !== av) { counts[f] = (counts[f] || 0) + 1; diffs.push(`${s.player} (${s.team}) ${s.game_date} ${f}: Sheet=${sv || "blank"} app=${av || "blank"}`); }
    }
  }
  for (const [key, a] of A) if (!S.has(key)) { counts["only in app"] = (counts["only in app"] || 0) + 1; diffs.push(`only in app: ${a.player} ${a.game_date} ${a.status}`); }
  console.log(`\n== ${name}: ${both.size} games in both · ${[...sheetGames].filter((g) => !appGames.has(g)).length} only in Sheet · ${[...appGames].filter((g) => !sheetGames.has(g)).length} only in app`);
  console.log(`   ${S.size} player-games compared · ${diffs.length ? diffs.length + " differences " + JSON.stringify(counts) : "no differences"}`);
  for (const d of diffs.slice(0, 60)) console.log("   " + d);
  if (diffs.length > 60) console.log(`   … ${diffs.length - 60} more`);
  return diffs.length;
}

const nbaFields = ["status", "minutes", "pts", "reb", "ast", "fg3m", "check_status", "limited_minutes"];
const nflFields = ["status", "pass_yds", "pass_td", "rush_yds", "receptions", "rec_yds", "off_snaps", "check_status", "limited_snaps"];
const n = compare("NBA", loadNbaLogs(readFileSync(join(sheetDir, "nba_game_logs.csv"), "utf8")), live.readNbaLogs(), nbaFields)
  + compare("NFL", loadNflLogs(readFileSync(join(sheetDir, "nfl_game_logs.csv"), "utf8")), live.readNflLogs(), nflFields);
process.exitCode = n ? 1 : 0;
