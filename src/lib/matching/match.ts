// Matches a slip leg ("Miss. Valley St.", "Prairie View A&M vs Southern ...") to a game on
// the schedule. Pure functions, unit tested. The rule: never guess silently. A confident,
// unique match is filled in; anything else comes back flagged for the user to pick.

import type { BetType, Game, League, TeamScore } from "@/lib/types";
import { TEAM_ALIASES } from "./aliases";

// ---------- Name cleanup ----------
const WORD_EXPANSIONS: Record<string, string> = {
  st: "state",
  miss: "mississippi",
  ms: "mississippi",
  okla: "oklahoma",
  tenn: "tennessee",
  univ: "university",
  so: "southern",
  no: "northern",
  ark: "arkansas",
  fla: "florida",
  ga: "georgia",
  la: "louisiana",
  cal: "california",
  mich: "michigan",
  wash: "washington",
  ky: "kentucky",
};
const LEADING_EXPANSIONS: Record<string, string> = { n: "north", s: "south", e: "east", w: "west", st: "saint" };

/** Lowercase, strip accents/apostrophes/punctuation and "...", expand common abbreviations. */
export function normalizeName(raw: string): string {
  let s = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ʻʼ'’‘`]/g, "") // Hawai'i, Hawaiʻi, Hawai`i -> hawaii
    .replace(/&/g, " and ")
    .replace(/\.\.\.|…/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").filter(Boolean);
  s = words
    .map((w, i) => {
      if (i === 0 && words.length > 1 && LEADING_EXPANSIONS[w]) return LEADING_EXPANSIONS[w];
      return WORD_EXPANSIONS[w] ?? w;
    })
    .join(" ");
  return s;
}

/** True when the slip text ends in "..." or "…", meaning the app cut the name off. */
export function looksTruncated(raw: string | null | undefined): boolean {
  return !!raw && /(\.\.\.|…)\s*$/.test(raw.trim());
}

/** "Prairie View A&M vs Southern ..." -> ["Prairie View A&M", "Southern ..."] */
export function splitMatchup(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\s+(?:vs\.?|v\.?|versus|@|at)\s+|\s*\/\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

// ---------- Leagues ----------
export function toLeague(raw: string | null | undefined): League | null {
  const s = (raw ?? "").toLowerCase();
  if (!s.trim()) return null;
  if (/\bnfl\b|pro football/.test(s)) return "NFL";
  if (/\bnba\b/.test(s)) return "NBA";
  if (/basketball|ncaab|ncaam|\bcbb\b|march madness/.test(s)) return "NCAAB";
  if (/football|ncaaf|\bcfb\b|\bfbs\b|\bfcs\b/.test(s)) return "NCAAF";
  return null;
}

// ---------- Scoring one piece of text against one team ----------
function keysFor(team: TeamScore, league: League): string[] {
  const aliases = TEAM_ALIASES[league]?.[team.name] ?? [];
  return [team.name, team.short, ...aliases].map(normalizeName).filter(Boolean);
}

/**
 * 0..1: how well slip text names this team.
 * 1 exact (after cleanup) · 0.85 the text is a cut-off start of the name · 0.75 the name plus
 * extra words (e.g. a mascot) · up to 0.5 for partial word overlap.
 */
const PRO_LEAGUES: League[] = ["NFL", "NBA"];

export function nameScore(text: string, team: TeamScore, league: League): number {
  const q = normalizeName(text);
  if (!q) return 0;
  let best = 0;
  const qWords = new Set(q.split(" "));
  // Pro team nicknames are unique within a league, so "LA Lakers", "MIL Bucks", "GS Warriors"
  // or just "Bucks" identify the team (the city part is often abbreviated on slips).
  if (PRO_LEAGUES.includes(league)) {
    const nick = normalizeName(team.name).split(" ").pop()!;
    const words = q.split(" ");
    if (q === nick) return 1;
    if (words.length <= 3 && words[words.length - 1] === nick) best = 0.9;
  }
  for (const k of keysFor(team, league)) {
    if (q === k) return 1;
    if (q.length >= 4 && k.startsWith(q)) best = Math.max(best, 0.85);
    else if (q.startsWith(k + " ")) best = Math.max(best, 0.75);
    else {
      const kWords = k.split(" ");
      const hit = kWords.filter((w) => qWords.has(w)).length;
      if (hit) best = Math.max(best, 0.5 * (hit / Math.max(kWords.length, qWords.size)));
    }
  }
  return best;
}

// ---------- Matching a leg to a game ----------
export interface LegToMatch {
  pick: string;
  opponent: string | null;
  league: string;
  betType: BetType;
}

export type MatchConfidence = "high" | "low" | "none";

export interface MatchResult {
  gameId: string | null;
  pickTeamId: string | null;
  confidence: MatchConfidence;
  /** Plain-language note shown on the confirm screen. */
  note: string;
  /** Best guesses, most likely first (game ids), for the game dropdown. */
  candidates: string[];
  /** Filled in from the schedule when the slip cut the opponent off. */
  filledOpponent: string | null;
}

const STRONG = 0.8;

interface Scored {
  game: Game;
  score: number;
  pickSide: "away" | "home" | null;
  sideMargin: number;
  pickScore: number;
  oppScore: number;
}

function scoreGame(leg: LegToMatch, game: Game): Scored {
  const lg = game.league;
  const pickParts = leg.betType === "total" ? [] : splitMatchup(leg.pick);
  const otherParts = splitMatchup(leg.opponent);
  const best = (parts: string[], t: TeamScore) => Math.max(0, ...parts.map((p) => nameScore(p, t, lg)));

  if (leg.betType === "moneyline" || leg.betType === "spread") {
    const pickA = best(pickParts, game.away);
    const pickH = best(pickParts, game.home);
    const oppA = best(otherParts, game.away);
    const oppH = best(otherParts, game.home);
    const asAway = pickA + oppH;
    const asHome = pickH + oppA;
    const awayWins = asAway >= asHome;
    return {
      game,
      score: Math.max(asAway, asHome),
      pickSide: Math.max(pickA, pickH) > 0 ? (awayWins ? "away" : "home") : null,
      sideMargin: Math.abs(pickA - pickH),
      pickScore: awayWins ? pickA : pickH,
      oppScore: awayWins ? oppH : oppA,
    };
  }

  // Totals and props: the team names can be anywhere in the text (e.g. "Bills vs Chiefs").
  const parts = [...pickParts, ...otherParts];
  const a = best(parts, game.away);
  const h = best(parts, game.home);
  return { game, score: a + h, pickSide: null, sideMargin: 0, pickScore: Math.max(a, h), oppScore: Math.min(a, h) };
}

export function matchLeg(leg: LegToMatch, games: Game[]): MatchResult {
  const league = toLeague(leg.league);
  const pool = league ? games.filter((g) => g.league === league) : games;
  const scored = pool
    .map((g) => scoreGame(leg, g))
    .filter((s) => s.score >= 0.5)
    .sort((x, y) => y.score - x.score);

  const none = (note: string): MatchResult => ({
    gameId: null,
    pickTeamId: null,
    confidence: "none",
    note,
    candidates: scored.slice(0, 3).map((s) => s.game.id),
    filledOpponent: null,
  });

  if (!scored.length) {
    if (leg.betType === "prop") return none("Pick the game for this player prop.");
    return none(league ? "Couldn't find this game on today's schedule." : "Couldn't find this game. Check the league and team names.");
  }

  // The slip names both teams, but no game on the schedule has both of them.
  const bothNamed =
    (leg.betType === "moneyline" || leg.betType === "spread") && !!leg.opponent && !looksTruncated(leg.opponent);
  if (bothNamed && !scored.some((s) => s.pickScore >= STRONG && s.oppScore >= 0.5)) {
    return none(`${leg.pick} vs ${leg.opponent} isn't on today's schedule. Pick the game, or check the date.`);
  }

  const top = scored[0];
  const runnerUp = scored[1];
  const tied = runnerUp && top.score - runnerUp.score < 0.3;
  const pickTeam = top.pickSide ? top.game[top.pickSide] : null;
  const otherTeam = top.pickSide ? top.game[top.pickSide === "away" ? "home" : "away"] : null;
  const label = `${top.game.away.name} at ${top.game.home.name}`;
  const base = {
    gameId: top.game.id,
    pickTeamId: pickTeam?.teamId ?? null,
    candidates: scored.slice(0, 3).map((s) => s.game.id),
    filledOpponent: null as string | null,
  };

  if (tied) {
    return { ...base, gameId: null, pickTeamId: null, confidence: "none", note: `More than one game fits (e.g. ${label}). Pick the right one.` };
  }

  if (leg.betType === "moneyline" || leg.betType === "spread") {
    if (top.pickScore < STRONG) {
      return { ...base, confidence: "low", note: `Best guess: ${label}. Check that it's right.` };
    }
    if (top.sideMargin < 0.2) {
      return { ...base, confidence: "low", note: `Not sure which team you picked in ${label}.` };
    }
    const oppMissing = !leg.opponent || looksTruncated(leg.opponent) || splitMatchup(leg.opponent).length === 0;
    if (top.oppScore < 0.5 && !oppMissing) {
      return { ...base, confidence: "low", note: `${pickTeam?.name} found, but the opponent on the slip doesn't match ${otherTeam?.name}.` };
    }
    return {
      ...base,
      confidence: "high",
      filledOpponent: oppMissing ? (otherTeam?.name ?? null) : null,
      note: oppMissing ? `Opponent filled in from today's schedule: ${otherTeam?.name}.` : "",
    };
  }

  if (leg.betType === "total") {
    if (top.oppScore >= 0.5 || top.pickScore >= STRONG) return { ...base, confidence: "high", note: "" };
    return { ...base, confidence: "low", note: `Best guess: ${label}. Check that it's right.` };
  }

  // Props and "other": a team name was found, but we can't confirm the player plays in it.
  return { ...base, confidence: "low", note: `Best guess: ${label}. Check that it's right.` };
}
