// The "database" for the personal version: CSV/JSON files under data/live, committed by the update job.
// One row per player per game, stable ESPN ids, the Sheet's column names.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadNbaLogs, loadNflLogs, toCsv } from "../csv";
import { NBA_LOG_COLS, NFL_LOG_COLS, type NbaLogRow, type NflLogRow, type Sport } from "../schema";

export const LIVE_DIR = "data/live";

export const FILES = {
  nbaLogs: "nba_game_logs.csv",      // full NBA log incl. inferred NOT_IN_BOX rows
  nflRaw: "nfl_espn_raw.csv",        // NFL rows exactly as ESPN reported them (never blanked)
  nflLogs: "nfl_game_logs.csv",      // verified NFL log + every inferred row (real 0 / DNP / PENDING), all players
  summary: "daily_summary.csv",      // run log + summary items, newest first
  state: "state.json",
} as const;

export const NFL_RAW_COLS = [...NFL_LOG_COLS, "espn_team_check"] as const;
export const SUMMARY_COLS = ["run_time_pt", "sport", "section", "item", "detail"] as const;

export interface RunInfo {
  /** ISO UTC */
  at: string;
  ok: boolean;
  gamesProcessed: number;
  /** game ids fetched this run (the Daily Summary's "this run's games") */
  freshIds: string[];
  message: string;
}
export interface SportState { scanFrom?: string; missing?: string[]; lastRun?: RunInfo; lastSuccess?: string; backfillDone?: boolean }
export type LiveState = Record<Sport, SportState>;

export class LiveStore {
  constructor(public dir = join(process.cwd(), LIVE_DIR)) {}
  private p(f: string) { return join(this.dir, f); }
  exists() { return existsSync(this.p(FILES.state)); }
  private readText(f: string) { return existsSync(this.p(f)) ? readFileSync(this.p(f), "utf8") : ""; }
  private write(f: string, text: string) { mkdirSync(dirname(this.p(f)), { recursive: true }); writeFileSync(this.p(f), text); }

  readState(): LiveState { const t = this.readText(FILES.state); return t ? JSON.parse(t) : { NBA: {}, NFL: {} }; }
  writeState(s: LiveState) { this.write(FILES.state, JSON.stringify(s, null, 2) + "\n"); }

  readNbaLogs(): NbaLogRow[] { const t = this.readText(FILES.nbaLogs); return t ? loadNbaLogs(t) : []; }
  writeNbaLogs(rows: NbaLogRow[]) { this.write(FILES.nbaLogs, toCsv(NBA_LOG_COLS, rows as unknown as Record<string, unknown>[])); }

  readNflRaw(): NflLogRow[] { const t = this.readText(FILES.nflRaw); return t ? loadNflLogs(t) : []; }
  writeNflRaw(rows: NflLogRow[]) { this.write(FILES.nflRaw, toCsv(NFL_RAW_COLS, rows as unknown as Record<string, unknown>[])); }
  readNflLogs(): NflLogRow[] { const t = this.readText(FILES.nflLogs); return t ? loadNflLogs(t) : []; }
  writeNflLogs(rows: NflLogRow[]) { this.write(FILES.nflLogs, toCsv(NFL_LOG_COLS, rows as unknown as Record<string, unknown>[])); }

  /** Prepend summary rows (newest first) and keep the newest `keep`. */
  appendSummary(rows: Record<(typeof SUMMARY_COLS)[number], string>[], keep = 3000) {
    const old = this.readText(FILES.summary).split("\n").slice(1).filter(Boolean);
    const fresh = toCsv(SUMMARY_COLS, rows).trimEnd().split("\n").slice(1);
    this.write(FILES.summary, [SUMMARY_COLS.join(","), ...fresh, ...old].slice(0, keep + 1).join("\n") + "\n");
  }
  readSummaryText() { return this.readText(FILES.summary); }
}
