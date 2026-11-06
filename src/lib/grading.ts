// Grades slip legs against game scores. Pure functions: same input, same answer, easy to test.
// Results are unofficial. Each platform settles by its own rules, so manual override always wins.

import type { Game, Leg, LegResult } from "@/lib/types";

/** First number in a line: "-3.5" -> -3.5, "+7" -> 7, "o48.5" -> 48.5, "PK" -> 0. */
export function parseLineNumber(line: string): number | null {
  const s = line.trim();
  if (/^(pk|pick|pick'?em|even)$/i.test(s)) return 0;
  const m = s.match(/[-+]?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** For totals: over or under, from the line ("o48.5", "Under 221") or the pick ("Over"). */
export function totalSide(leg: Pick<Leg, "line" | "pick">): "over" | "under" | null {
  for (const s of [leg.line, leg.pick]) {
    const t = s.trim().toLowerCase();
    if (/^(o|over)\b|^o\d/.test(t)) return "over";
    if (/^(u|under)\b|^u\d/.test(t)) return "under";
  }
  return null;
}

const cmp = (x: number): LegResult => (x > 0 ? "won" : x < 0 ? "lost" : "push");

/**
 * Grade a leg on the game's current score. Returns null when this bet type can't be
 * graded automatically (props, "other") or the leg is missing what it needs.
 */
export function evaluateLeg(leg: Leg, game: Game): LegResult | null {
  const a = game.away.score;
  const h = game.home.score;
  if (a === null || h === null) return null;

  if (leg.betType === "total") {
    const n = parseLineNumber(leg.line);
    const side = totalSide(leg);
    if (n === null || !side) return null;
    const diff = a + h - n;
    return cmp(side === "over" ? diff : -diff);
  }

  if (leg.betType === "moneyline" || leg.betType === "spread") {
    let mine: number;
    let theirs: number;
    if (leg.pickTeamId === game.home.teamId) [mine, theirs] = [h, a];
    else if (leg.pickTeamId === game.away.teamId) [mine, theirs] = [a, h];
    else return null;
    if (leg.betType === "moneyline") return cmp(mine - theirs);
    const n = parseLineNumber(leg.line);
    if (n === null) return null;
    return cmp(mine + n - theirs);
  }

  return null; // props and other: graded by hand until player stats arrive (Phase F)
}

export type LegStatus = "not_started" | "live" | "final" | "no_game";

export interface LegState {
  status: LegStatus;
  /** The grade that counts: manual override if set, else the automatic grade once final. */
  result: LegResult | null;
  /** While live: how the leg stands on the current score. */
  trend: "winning" | "losing" | "even" | null;
  manual: boolean;
  /** Final, but needs the user to grade it (props). */
  needsManualGrade: boolean;
}

export function legState(leg: Leg, game: Game | undefined): LegState {
  const status: LegStatus = !game
    ? "no_game"
    : game.status === "scheduled"
      ? "not_started"
      : game.status === "final"
        ? "final"
        : "live";
  const auto = game ? evaluateLeg(leg, game) : null;
  const trend =
    status === "live" && auto ? (({ won: "winning", lost: "losing", push: "even" }) as const)[auto] : null;

  if (leg.manualResult) {
    return { status, result: leg.manualResult, trend, manual: true, needsManualGrade: false };
  }
  if (status === "final") {
    return { status, result: auto, trend: null, manual: false, needsManualGrade: auto === null };
  }
  return { status, result: null, trend, manual: false, needsManualGrade: false };
}

export interface SlipSummary {
  total: number;
  won: number;
  lost: number;
  push: number;
  live: number;
  notStarted: number;
  needsGrade: number;
  /** Lost as soon as any leg loses. Won once every leg is decided and none lost. */
  verdict: "won" | "lost" | "push" | "open";
}

export function summarize(states: LegState[]): SlipSummary {
  const s: SlipSummary = { total: states.length, won: 0, lost: 0, push: 0, live: 0, notStarted: 0, needsGrade: 0, verdict: "open" };
  for (const st of states) {
    if (st.result) s[st.result]++;
    else if (st.status === "live") s.live++;
    else if (st.needsManualGrade || st.status === "final") s.needsGrade++;
    else s.notStarted++; // not started, or not matched to a game yet
  }
  const undecided = s.total - s.won - s.lost - s.push;
  // Open question (see DECISIONS.md): pushes are treated as "drop the leg" for now.
  if (s.lost > 0) s.verdict = "lost";
  else if (s.total > 0 && undecided === 0) s.verdict = s.won > 0 ? "won" : "push";
  return s;
}

/** "9 of 18 legs won, 7 live, 2 not started" */
export function statusLine(s: SlipSummary): string {
  const parts = [`${s.won} of ${s.total} legs won`];
  if (s.lost) parts.push(`${s.lost} lost`);
  if (s.push) parts.push(`${s.push} push`);
  if (s.live) parts.push(`${s.live} live`);
  if (s.notStarted) parts.push(`${s.notStarted} not started`);
  if (s.needsGrade) parts.push(`${s.needsGrade} need${s.needsGrade === 1 ? "s" : ""} your call`);
  return parts.join(", ");
}
