// Fake-game engine for the mock provider.
// Each game gets a full, repeatable timeline of scoring plays generated from its id, so the
// same game always plays out the same way. Where the game "is" depends only on the demo
// clock, which lets us jump forward to see games finish and legs get graded.

import type { Game, GameStatus, League, Play } from "@/lib/types";
import { TEAM_BY_ID, type MockTeam } from "./teams";

interface Shape {
  periods: number;
  periodSec: number; // game-clock seconds per period
  periodWallMin: number; // real-world minutes a period takes
  halftimeAfter: number;
  halftimeWallMin: number;
  label: (period: number) => string;
}

const FOOTBALL: Shape = {
  periods: 4,
  periodSec: 900,
  periodWallMin: 45,
  halftimeAfter: 2,
  halftimeWallMin: 30,
  label: (p) => `Q${p}`,
};
const NBA: Shape = {
  periods: 4,
  periodSec: 720,
  periodWallMin: 30,
  halftimeAfter: 2,
  halftimeWallMin: 20,
  label: (p) => `Q${p}`,
};
const NCAAB: Shape = {
  periods: 2,
  periodSec: 1200,
  periodWallMin: 52.5,
  halftimeAfter: 1,
  halftimeWallMin: 20,
  label: (p) => (p === 1 ? "1st Half" : "2nd Half"),
};

export function shapeFor(league: League): Shape {
  if (league === "NBA") return NBA;
  if (league === "NCAAB") return NCAAB;
  return FOOTBALL;
}

export function wallLengthMin(league: League): number {
  const s = shapeFor(league);
  return s.periods * s.periodWallMin + s.halftimeWallMin;
}

// ---------- Repeatable randomness ----------
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOne = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];

// ---------- Timeline ----------
type Side = "away" | "home";
interface Event {
  sec: number; // game-clock seconds elapsed since kickoff/tipoff
  side: Side;
  points: number;
  text: string;
}

export interface MockGameDef {
  id: string;
  league: League;
  awayId: string;
  homeId: string;
  startOffsetMin: number; // minutes after the slate begins
  scoreOnly?: boolean;
}

const timelineCache = new Map<string, Event[]>();

function edge(off: MockTeam, def: MockTeam, home: boolean) {
  const e = 0.95 + 0.5 * (off.rating - def.rating) + (home ? 0.04 : 0);
  return Math.min(1.35, Math.max(0.5, e));
}

function footballTimeline(def: MockGameDef, away: MockTeam, home: MockTeam): Event[] {
  const r = rng(hash(def.id));
  const total = FOOTBALL.periods * FOOTBALL.periodSec;
  const ev: Event[] = [];
  let side: Side = r() < 0.5 ? "away" : "home";
  let t = 0;
  while (t < total - 20) {
    const end = Math.min(total - 10, t + 90 + r() * 210);
    const off = side === "away" ? away : home;
    const dfn = side === "away" ? home : away;
    const k = edge(off, dfn, side === "home");
    const x = r();
    const pTD = 0.28 * k;
    const pFG = 0.15 * k;
    if (x < pTD) {
      const yds = 1 + Math.floor(r() * 60);
      const how = r() < 0.6 ? "pass" : "run";
      const missedPat = r() < 0.05;
      ev.push({
        sec: end,
        side,
        points: missedPat ? 6 : 7,
        text: `${off.name} touchdown, ${yds}-yard ${how}. ${missedPat ? "Extra point no good." : "Extra point good."}`,
      });
    } else if (x < pTD + pFG) {
      ev.push({ sec: end, side, points: 3, text: `${off.name} field goal good from ${22 + Math.floor(r() * 32)} yards.` });
    } else {
      const outcome = pickOne(r, [
        "punt",
        "punt",
        "punt",
        "Interception",
        "Fumble lost",
        "Turnover on downs",
        `Missed ${38 + Math.floor(r() * 18)}-yard field goal`,
      ]);
      ev.push({ sec: end, side, points: 0, text: outcome === "punt" ? `${off.name} drive ends in a punt.` : `${off.name}: ${outcome}.` });
    }
    t = end + 5;
    side = side === "away" ? "home" : "away";
  }
  breakTie(ev, total, r, (s) => ({
    points: 3,
    text: `${(s === "away" ? away : home).name} field goal good as time expires.`,
  }));
  return ev;
}

function basketballTimeline(def: MockGameDef, away: MockTeam, home: MockTeam): Event[] {
  const shape = shapeFor(def.league);
  const r = rng(hash(def.id));
  const total = shape.periods * shape.periodSec;
  const possSec = def.league === "NBA" ? 14 : 18.5;
  const ev: Event[] = [];
  let side: Side = r() < 0.5 ? "away" : "home";
  let t = r() * possSec;
  while (t < total - 3) {
    const off = side === "away" ? away : home;
    const dfn = side === "away" ? home : away;
    const k = edge(off, dfn, side === "home");
    const x = r();
    const p3 = 0.125 * k;
    const p2 = 0.34 * k;
    const pft = 0.08 * k;
    if (x < p3) ev.push({ sec: t, side, points: 3, text: `${off.name} 3-pointer.` });
    else if (x < p3 + p2)
      ev.push({ sec: t, side, points: 2, text: `${off.name} ${pickOne(r, ["layup", "jump shot", "dunk", "floater", "hook shot"])}.` });
    else if (x < p3 + p2 + pft) ev.push({ sec: t, side, points: 2, text: `${off.name} makes 2 free throws.` });
    t += possSec * (0.6 + 0.8 * r());
    side = side === "away" ? "home" : "away";
  }
  breakTie(ev, total, r, (s) => ({
    points: 1,
    text: `${(s === "away" ? away : home).name} free throw with seconds left.`,
  }));
  return ev;
}

/** Real games can't end tied here (we skip overtime in the mock), so add a late winner. */
function breakTie(ev: Event[], total: number, r: () => number, make: (s: Side) => { points: number; text: string }) {
  const a = ev.reduce((n, e) => n + (e.side === "away" ? e.points : 0), 0);
  const h = ev.reduce((n, e) => n + (e.side === "home" ? e.points : 0), 0);
  if (a !== h) return;
  const side: Side = r() < 0.5 ? "away" : "home";
  ev.push({ sec: total - 2, side, ...make(side) });
}

function timeline(def: MockGameDef): Event[] {
  let ev = timelineCache.get(def.id);
  if (!ev) {
    const away = TEAM_BY_ID.get(def.awayId)!;
    const home = TEAM_BY_ID.get(def.homeId)!;
    ev =
      def.league === "NBA" || def.league === "NCAAB"
        ? basketballTimeline(def, away, home)
        : footballTimeline(def, away, home);
    ev.sort((x, y) => x.sec - y.sec);
    timelineCache.set(def.id, ev);
  }
  return ev;
}

// ---------- Where is the game right now? ----------
interface Moment {
  status: GameStatus;
  gameSec: number;
}

export function momentAt(league: League, wallElapsedMin: number): Moment {
  const s = shapeFor(league);
  let w = wallElapsedMin;
  if (w < 0) return { status: "scheduled", gameSec: 0 };
  for (let p = 1; p <= s.periods; p++) {
    if (w < s.periodWallMin) {
      return { status: "in_progress", gameSec: (p - 1) * s.periodSec + (w / s.periodWallMin) * s.periodSec };
    }
    w -= s.periodWallMin;
    if (p === s.halftimeAfter) {
      if (w < s.halftimeWallMin) return { status: "halftime", gameSec: p * s.periodSec };
      w -= s.halftimeWallMin;
    }
  }
  return { status: "final", gameSec: s.periods * s.periodSec };
}

function clockAt(league: League, gameSec: number) {
  const s = shapeFor(league);
  const period = Math.min(s.periods, Math.floor(gameSec / s.periodSec) + 1);
  const left = Math.max(0, Math.round(period * s.periodSec - gameSec));
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return { periodLabel: s.label(period), clock };
}

/** FCS games (and a few small-school ones) only get score + clock, like real feeds often do. */
export function isScoreOnly(def: MockGameDef): boolean {
  const away = TEAM_BY_ID.get(def.awayId)!;
  const home = TEAM_BY_ID.get(def.homeId)!;
  return !!def.scoreOnly || away.division === "FCS" || home.division === "FCS";
}

export function buildGame(def: MockGameDef, slateStart: Date, simMinute: number): Game {
  const away = TEAM_BY_ID.get(def.awayId)!;
  const home = TEAM_BY_ID.get(def.homeId)!;
  const m = momentAt(def.league, simMinute - def.startOffsetMin);
  const started = m.status !== "scheduled";
  let a = 0;
  let h = 0;
  for (const e of timeline(def)) {
    if (m.status !== "final" && e.sec > m.gameSec) break;
    if (e.side === "away") a += e.points;
    else h += e.points;
  }
  let statusLabel = "";
  if (m.status === "final") statusLabel = "Final";
  else if (m.status === "halftime") statusLabel = "Halftime";
  else if (m.status === "in_progress") {
    const c = clockAt(def.league, m.gameSec);
    statusLabel = `${c.periodLabel} ${c.clock}`;
  }
  const scoreOnly = isScoreOnly(def);
  return {
    id: def.id,
    league: def.league,
    division: home.division,
    startTime: new Date(slateStart.getTime() + def.startOffsetMin * 60_000).toISOString(),
    status: m.status,
    statusLabel,
    away: { teamId: away.id, name: away.name, short: away.short, score: started ? a : null },
    home: { teamId: home.id, name: home.name, short: home.short, score: started ? h : null },
    coverage: scoreOnly ? "score_only" : "play_by_play",
  };
}

export function buildPlays(def: MockGameDef, simMinute: number): Play[] {
  const m = momentAt(def.league, simMinute - def.startOffsetMin);
  if (m.status === "scheduled") return [];
  const plays: Play[] = [];
  let a = 0;
  let h = 0;
  timeline(def).forEach((e, i) => {
    if (m.status !== "final" && e.sec > m.gameSec) return;
    if (e.side === "away") a += e.points;
    else h += e.points;
    const c = clockAt(def.league, e.sec);
    plays.push({
      id: `${def.id}-${i}`,
      periodLabel: c.periodLabel,
      clock: c.clock,
      teamId: e.side === "away" ? def.awayId : def.homeId,
      description: e.text,
      awayScore: a,
      homeScore: h,
      scoring: e.points > 0,
    });
  });
  return plays.reverse(); // newest first
}
