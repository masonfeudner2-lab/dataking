// Where the hit-rate screens get their data. Today: the Nov 18 Sheet snapshot (+ nflverse files) on disk.
// Step 3 swaps `snapshotSource` for the database; nothing else changes.
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Settings } from "./config";
import { loadNbaLogs, loadNflLogs, loadSettingsCsv, parseCsv } from "./csv";
import { rebuildNba, type NbaRebuild } from "./nba";
import { buildNflverse, rebuildNfl, type NflRebuild } from "./nfl";
import { isOk, type NbaLogRow, type NflLogRow, type Sport } from "./schema";
import { buildSummary, type SummaryItem } from "./summary";
import type { WatchEntry } from "./watchlist";

export interface SportMeta {
  /** ISO time of the newest row written by the pipeline */
  lastUpdatedUtc: string;
  /** newest game date in the logs */
  lastGameDate: string;
  /** tracked rows that aren't verified (blank / mismatch / pending) */
  unverifiedRows: number;
  source: string;
}

export interface Dataset {
  settings: Settings;
  nba: NbaRebuild;
  nfl: NflRebuild;
  meta: Record<Sport, SportMeta>;
  summary: Record<Sport, SummaryItem[]>;
  isSnapshot: boolean;
}

const DATA = join(process.cwd(), "data");
const read = (p: string) => readFileSync(join(DATA, p), "utf8");

interface RawData { settings: Settings; nba: NbaLogRow[]; nflEspn: NflLogRow[]; nflverse: ReturnType<typeof buildNflverse>; now: Date }

let raw: RawData | null = null;
function snapshotSource(): RawData {
  if (raw) return raw;
  const snap = "snapshot-2026-11-18";
  const nflAll = loadNflLogs(read(`${snap}/nfl_game_logs.csv`));
  raw = {
    settings: loadSettingsCsv(read(`${snap}/settings.csv`)),
    // the pipeline re-derives NOT_IN_BOX (NBA) and every inferred NFL row from the raw ESPN rows
    nba: loadNbaLogs(read(`${snap}/nba_game_logs.csv`)).filter((r) => r.status !== "NOT_IN_BOX"),
    nflEspn: nflAll.filter((r) => r.source === "ESPN"),
    nflverse: buildNflverse(parseCsv(read("nflverse-2026/stats_player_week_2026.csv")), parseCsv(read("nflverse-2026/snap_counts_2026.csv"))),
    now: new Date("2026-11-18T18:45:00Z"),
  };
  return raw;
}

function meta(rows: (NbaLogRow | NflLogRow)[], tracked: (id: string) => boolean): SportMeta {
  let u = "", d = "";
  for (const r of rows) { if (r.updated_utc > u) u = r.updated_utc; if (r.game_date > d) d = r.game_date; }
  return { lastUpdatedUtc: u, lastGameDate: d, source: "Sheet snapshot",
    unverifiedRows: rows.filter((r) => !isOk(r.check_status) && tracked(r.player_id)).length };
}

const cache = new Map<string, Dataset>();

/** Everything the screens need, for one watchlist. Cheap to call: results are cached per watchlist. */
export function getDataset(watch: WatchEntry[]): Dataset {
  const key = JSON.stringify(watch.map((w) => [w.sport, w.norm, w.team, w.stat, w.line]));
  const hit = cache.get(key);
  if (hit) return hit;
  const src = snapshotSource();
  // clone rows: the rebuild sets derived fields (limited flags, check status) in place
  const nba = rebuildNba(src.nba.map((r) => ({ ...r })), src.settings, watch, src.now);
  const nfl = rebuildNfl(src.nflEspn.map((r) => ({ ...r, espn_team_check: "" })), src.nflverse, src.settings, watch, src.now);
  // "this run's games": the newest game day (NBA) / newest week (NFL)
  const nbaDay = nba.logRows.reduce((m, r) => (r.game_date > m ? r.game_date : m), "");
  const nflWeek = nfl.logRows.reduce((m, r) => Math.max(m, r.week ?? 0), 0);
  const nbaFresh = [...new Set(nba.logRows.filter((r) => r.game_date === nbaDay).map((r) => r.game_id))];
  const nflFresh = [...new Set(nfl.logRows.filter((r) => r.week === nflWeek && r.season_type === "Regular").map((r) => r.game_id))];
  const ds: Dataset = {
    settings: src.settings, nba, nfl, isSnapshot: true,
    meta: {
      NBA: meta(nba.logRows, (id) => !!nba.P[id]?.tracked),
      NFL: meta(nfl.logRows, (id) => !!nfl.P[id]?.tracked),
    },
    summary: {
      NBA: buildSummary("NBA", nba.P, nba.hit, nba.logRows, src.settings, nbaFresh, watch.filter((w) => w.sport === "NBA"), src.now),
      NFL: buildSummary("NFL", nfl.P, nfl.hit, nfl.logRows, src.settings, nflFresh, watch.filter((w) => w.sport === "NFL"), src.now),
    },
  };
  if (cache.size > 20) cache.clear();
  cache.set(key, ds);
  return ds;
}
