// Shared shapes used across the whole app. Every data provider (mock, CollegeFootballData,
// a multi-sport API, Sportradar later) must translate its own format into these.

export type League = "NCAAF" | "NFL" | "NBA" | "NCAAB";

export const LEAGUES: League[] = ["NCAAF", "NFL", "NBA", "NCAAB"];

export const LEAGUE_LABEL: Record<League, string> = {
  NCAAF: "College Football",
  NFL: "NFL",
  NBA: "NBA",
  NCAAB: "College Basketball",
};

export interface Team {
  id: string;
  name: string; // "Prairie View A&M"
  short: string; // "PVAMU"
  league: League;
  /** College subdivision, e.g. FBS / FCS for football. */
  division?: string;
}

export type GameStatus = "scheduled" | "in_progress" | "halftime" | "final";

export interface TeamScore {
  teamId: string;
  name: string;
  short: string;
  score: number | null; // null before the game starts
}

/** "play_by_play" = the feed gives individual plays. "score_only" = score and clock only. */
export type Coverage = "play_by_play" | "score_only";

export interface Game {
  id: string;
  league: League;
  division?: string;
  startTime: string; // ISO timestamp
  status: GameStatus;
  /** Human label for where the game is: "Q3 8:21", "Halftime", "Final", "2nd Half 4:10". */
  statusLabel: string;
  away: TeamScore;
  home: TeamScore;
  coverage: Coverage;
}

export interface Play {
  id: string;
  periodLabel: string; // "Q2", "1st Half"
  clock: string; // "8:21"
  teamId: string | null;
  description: string;
  awayScore: number;
  homeScore: number;
  scoring: boolean;
}

// ---------- Slips ----------

export type BetType = "moneyline" | "spread" | "total" | "prop" | "other";
export type LegResult = "won" | "lost" | "push";

export interface Leg {
  id: string;
  league: League | string;
  betType: BetType;
  /** What the slip says the bettor picked: a team, "Over", or a player prop. */
  pick: string;
  opponent: string | null;
  /** "-3.5" for spreads, "o48.5" / "u48.5" for totals, "25+ rush yds" for props, "" for moneylines. */
  line: string;
  /** Odds/probability as printed on the slip. Private to the user. */
  price: string;
  /** The game this leg is on, once matched to the schedule. */
  gameId: string | null;
  /** For moneyline/spread: which team in that game was picked. */
  pickTeamId: string | null;
  /** Set when the user overrides the automatic grade. */
  manualResult: LegResult | null;
}

export interface Slip {
  id: string;
  source: string; // "Kalshi", "FanDuel", ...
  createdAt: string;
  legs: Leg[];
}
