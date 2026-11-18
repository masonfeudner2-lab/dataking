// Column schemas, ported 1:1 from PropTracker.gs (NBA_LOG_COLS, NFL_LOG_COLS, HIT_COLS, PLAYER_COLS).
// These names are the contract for the database tables and CSV exports. Don't rename them.

export const NBA_LOG_COLS = ["game_id", "game_date", "season", "season_type", "player_id", "player", "team",
  "opponent", "home_away", "team_result", "status", "dnp_reason", "starter", "minutes", "pts", "reb",
  "ast", "fg3m", "fg3a", "fgm", "fga", "ftm", "fta", "oreb", "dreb", "stl", "blk", "tov", "pf",
  "plus_minus", "ejected", "limited_minutes", "check_status", "check_note", "source", "updated_utc"] as const;

export const NFL_LOG_COLS = ["game_id", "game_date", "season", "season_type", "week", "player_id", "player",
  "position", "team", "opponent", "home_away", "team_result", "status", "dnp_reason", "pass_cmp",
  "pass_att", "pass_yds", "pass_td", "pass_int", "carries", "rush_yds", "rush_td", "receptions",
  "targets", "rec_yds", "rec_td", "off_snaps", "off_snap_pct", "limited_snaps", "check_status",
  "check_note", "source", "updated_utc"] as const;

export const HIT_COLS = ["player_key", "sport", "player", "team", "position", "stat", "line", "games",
  "L5", "L10", "Season", "Home", "Away", "avg", "median", "streak", "last10_values_newest_first",
  "limited_games_L10", "watchlist", "L5_pct", "L10_pct", "season_pct", "home_pct", "away_pct"] as const;

export const PLAYER_COLS = ["player_key", "sport", "player_id", "player", "team", "position", "games_played",
  "avg_minutes_or_snap_pct", "tracked", "watchlist"] as const;

export type Sport = "NBA" | "NFL";
/** Blank / unverified is always `null`. Never 0. */
export type Num = number | null;

export const NBA_NUM_COLS = ["minutes", "pts", "reb", "ast", "fg3m", "fg3a", "fgm", "fga", "ftm", "fta",
  "oreb", "dreb", "stl", "blk", "tov", "pf", "plus_minus"] as const;
export const NFL_NUM_COLS = ["week", "pass_cmp", "pass_att", "pass_yds", "pass_td", "pass_int", "carries",
  "rush_yds", "rush_td", "receptions", "targets", "rec_yds", "rec_td", "off_snaps", "off_snap_pct"] as const;

export type GameStatus = "PLAYED" | "DNP" | "NOT_IN_BOX" | "PENDING";

interface LogBase {
  game_id: string; game_date: string; season: string; season_type: string;
  player_id: string; player: string; team: string; opponent: string;
  home_away: "H" | "A"; team_result: string; status: GameStatus; dnp_reason: string;
  check_status: string; check_note: string; source: string; updated_utc: string;
}

export interface NbaLogRow extends LogBase, Record<(typeof NBA_NUM_COLS)[number], Num> {
  starter: string; ejected: string; limited_minutes: string;
}

export interface NflLogRow extends LogBase, Record<(typeof NFL_NUM_COLS)[number], Num> {
  position: string; limited_snaps: string;
  /** Transient fields used during a run; never stored. */
  espn_team_check?: string; nflverse_id?: string;
}

export type LogRow = NbaLogRow | NflLogRow;

export interface HitRow {
  player_key: string; sport: Sport; player: string; team: string; position: string;
  stat: string; line: string; games: number;
  L5: string; L10: string; Season: string; Home: string; Away: string;
  avg: number; median: number; streak: string; last10_values_newest_first: string;
  limited_games_L10: number; watchlist: "" | "Y";
  L5_pct: Num; L10_pct: Num; season_pct: Num; home_pct: Num; away_pct: Num;
  /** numeric line and per-game hit flags (newest first); not exported */
  _line: number; _hits: boolean[];
}

export interface PlayerRow {
  player_key: string; sport: Sport; player_id: string; player: string; team: string; position: string;
  games_played: number; avg_minutes_or_snap_pct: number; tracked: "" | "Y"; watchlist: "" | "Y";
}

export const isOk = (checkStatus: string | null | undefined) => /^OK/.test(checkStatus || "OK");
