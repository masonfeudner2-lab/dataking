// Where the hit-rate screens get their data:
//  - live: data/live, written by the scheduled update job (GitHub Actions)
//  - snapshot: the Nov 18 Sheet export, used only until the first live update exists
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Settings } from "./config";
import { loadNbaLogs, loadNflLogs, loadSettingsCsv, parseCsv } from "./csv";
import { LiveStore, type RunInfo } from "./ingest/files";
import { rebuildNba, type NbaRebuild } from "./nba";
import { buildNflverse, deriveNfl, inferNfl, nflPlayerMeta, verifyNfl, type NflRebuild } from "./nfl";
import { isOk, type NbaLogRow, type NflLogRow, type Sport } from "./schema";
import { buildSummary, type SummaryItem } from "./summary";
import type { WatchEntry } from "./watchlist";

export interface SportMeta {
  /** ISO time of the last update run (live) or newest row (snapshot) */
  lastUpdatedUtc: string;
  lastGameDate: string;
  /** tracked rows that aren't verified (blank / mismatch / pending) */
  unverifiedRows: number;
  /** the last run had problems (some data didn't load); it retries next run */
  lastRunProblem: string | null;
}

export interface Dataset {
  settings: Settings;
  nba: NbaRebuild;
  nfl: NflRebuild;
  meta: Record<Sport, SportMeta>;
  summary: Record<Sport, SummaryItem[]>;
  isSnapshot: boolean;
}

interface RawData {
  settings: Settings; now: Date; isSnapshot: boolean;
  /** NBA rows from ESPN (PLAYED + DNP); NOT_IN_BOX is re-derived */
  nba: NbaLogRow[];
  /** NFL: verified ESPN rows + inferred rows (all players) */
  nflEspn: NflLogRow[]; nflInferred: NflLogRow[];
  runs: Partial<Record<Sport, RunInfo>>;
}

const DATA = join(process.cwd(), "data");
const read = (p: string) => readFileSync(join(DATA, p), "utf8");

function liveSource(): RawData | null {
  const store = new LiveStore(join(DATA, "live"));
  if (!store.exists()) return null;
  const state = store.readState();
  const nfl = store.readNflLogs();
  return {
    settings: loadSettingsCsv(read("settings.csv")), now: new Date(), isSnapshot: false,
    nba: store.readNbaLogs().filter((r) => r.status !== "NOT_IN_BOX"),
    nflEspn: nfl.filter((r) => r.source === "ESPN"), nflInferred: nfl.filter((r) => r.source !== "ESPN"),
    runs: { NBA: state.NBA.lastRun, NFL: state.NFL.lastRun },
  };
}

function snapshotSource(): RawData {
  const snap = "snapshot-2026-11-18";
  const espn = loadNflLogs(read(`${snap}/nfl_game_logs.csv`)).filter((r) => r.source === "ESPN");
  const nv = buildNflverse(parseCsv(read("nflverse-2026/stats_player_week_2026.csv")), parseCsv(read("nflverse-2026/snap_counts_2026.csv")));
  const now = new Date("2026-11-18T18:45:00Z");
  verifyNfl(espn, nv);
  const inferred = inferNfl(espn, nv, nflPlayerMeta(espn), now);
  return {
    settings: loadSettingsCsv(read(`${snap}/settings.csv`)), now, isSnapshot: true,
    nba: loadNbaLogs(read(`${snap}/nba_game_logs.csv`)).filter((r) => r.status !== "NOT_IN_BOX"),
    nflEspn: espn, nflInferred: inferred, runs: {},
  };
}

let raw: RawData | null = null;
const source = () => (raw ||= liveSource() ?? snapshotSource());

function meta(rows: (NbaLogRow | NflLogRow)[], tracked: (id: string) => boolean, run?: RunInfo): SportMeta {
  let u = "", d = "";
  for (const r of rows) { if (r.updated_utc > u) u = r.updated_utc; if (r.game_date > d) d = r.game_date; }
  return {
    lastUpdatedUtc: run?.at ?? u, lastGameDate: d,
    unverifiedRows: rows.filter((r) => !isOk(r.check_status) && tracked(r.player_id)).length,
    lastRunProblem: run && !run.ok ? run.message : null,
  };
}

const cache = new Map<string, Dataset>();

/** Everything the screens need, for one watchlist. Results are cached per watchlist. */
export function getDataset(watch: WatchEntry[]): Dataset {
  const key = JSON.stringify(watch.map((w) => [w.sport, w.norm, w.team, w.stat, w.line]));
  const hit = cache.get(key);
  if (hit) return hit;
  const src = source();
  // clone rows: the rebuild sets derived fields (limited flags) in place
  const nba = rebuildNba(src.nba.map((r) => ({ ...r })), src.settings, watch, src.now);
  const espn = src.nflEspn.map((r) => ({ ...r }));
  const nfl = deriveNfl(espn, src.nflInferred.map((r) => ({ ...r })), nflPlayerMeta(espn), src.settings, watch);
  // "this run's games": from the last update run; for the snapshot, the newest game day / week
  const nbaDay = nba.logRows.reduce((m, r) => (r.game_date > m ? r.game_date : m), "");
  const nflWeek = nfl.logRows.reduce((m, r) => Math.max(m, r.week ?? 0), 0);
  const nbaFresh = src.runs.NBA?.freshIds ?? [...new Set(nba.logRows.filter((r) => r.game_date === nbaDay).map((r) => r.game_id))];
  const nflFresh = src.runs.NFL?.freshIds ?? [...new Set(nfl.logRows.filter((r) => r.week === nflWeek && r.season_type === "Regular").map((r) => r.game_id))];
  const at = (s: Sport) => (src.runs[s] ? new Date(src.runs[s]!.at) : src.now);
  const ds: Dataset = {
    settings: src.settings, nba, nfl, isSnapshot: src.isSnapshot,
    meta: {
      NBA: meta(nba.logRows, (id) => !!nba.P[id]?.tracked, src.runs.NBA),
      NFL: meta(nfl.logRows, (id) => !!nfl.P[id]?.tracked, src.runs.NFL),
    },
    summary: {
      NBA: buildSummary("NBA", nba.P, nba.hit, nba.logRows, src.settings, nbaFresh, watch.filter((w) => w.sport === "NBA"), at("NBA")),
      NFL: buildSummary("NFL", nfl.P, nfl.hit, nfl.logRows, src.settings, nflFresh, watch.filter((w) => w.sport === "NFL"), at("NFL")),
    },
  };
  if (cache.size > 20) cache.clear();
  cache.set(key, ds);
  return ds;
}
