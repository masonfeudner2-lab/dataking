// Stat ladders and rule settings. Same defaults as the Sheet's Settings tab; always configurable.
import type { Sport } from "./schema";

export const STAT_FIELD = {
  PTS: "pts", REB: "reb", AST: "ast", "3PM": "fg3m",
  PASS_YDS: "pass_yds", PASS_TD: "pass_td", REC: "receptions", REC_YDS: "rec_yds", RUSH_YDS: "rush_yds",
} as const;
export type StatCode = keyof typeof STAT_FIELD;
export const STAT_CODES = Object.keys(STAT_FIELD) as StatCode[];
export const SPORT_STATS: Record<Sport, StatCode[]> = {
  NBA: ["PTS", "REB", "AST", "3PM"],
  NFL: ["PASS_YDS", "PASS_TD", "REC", "REC_YDS", "RUSH_YDS"],
};

export type Applies = "all" | "QB only" | "receivers" | "rushers";
export interface Ladder { stat: StatCode; label: string; field: string; lines: number[]; applies: Applies | string }

export interface Settings {
  ladders: Record<Sport, Ladder[]>;
  nbaMinMinutes: number;
  nflMinTargets: number;
  nflMinCarries: number;
  nflQbAtt: number;
  /** fraction, e.g. 0.35 */
  limitedPct: number;
  /** fraction, e.g. 0.40 */
  trendGap: number;
  trendMinGames: number;
  streakMin: number;
}

const range = (a: number, b: number, s: number) => { const o: number[] = []; for (let x = a; x <= b; x += s) o.push(x); return o; };

export const DEFAULT_LADDERS: [Sport, StatCode, string, number[], Applies][] = [
  ["NBA", "PTS", "Points", range(5, 40, 5), "all"],
  ["NBA", "AST", "Assists", range(2, 12, 2), "all"],
  ["NBA", "REB", "Rebounds", range(2, 14, 2), "all"],
  ["NBA", "3PM", "3-Pointers Made", range(1, 6, 1), "all"],
  ["NFL", "PASS_YDS", "Passing Yards", range(125, 350, 25), "QB only"],
  ["NFL", "PASS_TD", "Passing TDs", range(1, 4, 1), "QB only"],
  ["NFL", "REC_YDS", "Receiving Yards", [10, 15, ...range(20, 150, 10)], "receivers"],
  ["NFL", "REC", "Receptions", range(2, 10, 1), "receivers"],
  ["NFL", "RUSH_YDS", "Rushing Yards", [10, 15, ...range(20, 150, 10)], "rushers"],
];

/** Setting names exactly as they appear in the Sheet's Settings tab. */
export const SETTING_KEYS = {
  nbaMinMinutes: ["NBA: min avg minutes to track", 5],
  nflMinTargets: ["NFL: min avg targets (receiving ladders)", 1],
  nflMinCarries: ["NFL: min avg carries (rushing ladder)", 1],
  nflQbAtt: ["NFL: QB needs a game with at least this many pass attempts", 10],
  limitedPct: ["Limited flag: % below player avg minutes/snap share", 35],
  trendGap: ["Trend: L5 vs season gap (percentage points)", 40],
  trendMinGames: ["Trend: min season games", 6],
  streakMin: ["Streak flag: min length", 5],
} as const;

export interface LadderInput { sport: string; stat: string; label: string; lines: string | number[]; applies: string }

/** readSettings_: build Settings from ladder rows + name/value settings (same parsing as the Sheet). */
export function buildSettings(ladderRows: LadderInput[], kv: Record<string, number | string>): Settings {
  const ladders: Record<Sport, Ladder[]> = { NBA: [], NFL: [] };
  for (const r of ladderRows) {
    const stat = String(r.stat) as StatCode;
    if (!r.sport || !STAT_FIELD[stat] || (r.sport !== "NBA" && r.sport !== "NFL")) continue;
    const ls = (Array.isArray(r.lines) ? r.lines : String(r.lines).split(","))
      .map((x) => Number(String(x).trim())).filter((x) => !Number.isNaN(x) && x > 0);
    ladders[r.sport].push({ stat, label: String(r.label), field: STAT_FIELD[stat], lines: ls, applies: String(r.applies) });
  }
  const g = (k: keyof typeof SETTING_KEYS) => {
    const [name, def] = SETTING_KEYS[k];
    const v = kv[name] === undefined || kv[name] === "" ? NaN : Number(kv[name]);
    return Number.isNaN(v) ? def : v;
  };
  return {
    ladders,
    nbaMinMinutes: g("nbaMinMinutes"), nflMinTargets: g("nflMinTargets"), nflMinCarries: g("nflMinCarries"),
    nflQbAtt: g("nflQbAtt"), limitedPct: g("limitedPct") / 100, trendGap: g("trendGap") / 100,
    trendMinGames: g("trendMinGames"), streakMin: g("streakMin"),
  };
}

export const defaultSettings = () =>
  buildSettings(DEFAULT_LADDERS.map(([sport, stat, label, lines, applies]) => ({ sport, stat, label, lines, applies })), {});

export const SEASONS = {
  NBA: { label: "2026-27", espnYear: 2027, scanFrom: "2026-10-01" },
  NFL: { year: 2026 },
} as const;

/** Retry unverified games for this many days. */
export const RETRY_DAYS = 14;
