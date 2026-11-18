// Hit-rate math (ladderRows_ / sortHit_ in PropTracker.gs). Hit rates are always derived from game logs.
import type { Ladder } from "./config";
import type { HitRow, LogRow, Sport } from "./schema";
import { frac, median, round1 } from "./util";

export interface LadderPlayer {
  name: string; team: string;
  /** PLAYED rows only (DNP / NOT_IN_BOX / PENDING are never passed in) */
  games: LogRow[];
  watch: unknown[];
}

const val = (r: LogRow, field: string) => (r as unknown as Record<string, number | null | undefined>)[field];

export function ladderRows(p: LadderPlayer, key: string, sport: Sport, pos: string, L: Ladder,
  limitedField: "limited_minutes" | "limited_snaps"): HitRow[] {
  // A blank (null) stat is unverified: excluded from this stat's games, never treated as 0.
  const g = p.games.filter((r) => val(r, L.field) !== null && val(r, L.field) !== undefined)
    .sort((a, b) => (a.game_date < b.game_date ? 1 : -1)); // newest first
  const vals = g.map((r) => Number(val(r, L.field)));
  if (!vals.length) return [];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const med = median(vals) as number;
  const last10 = vals.slice(0, 10).join(", ");
  const lim10 = g.slice(0, 10).filter((r) => (r as unknown as Record<string, string>)[limitedField] === "Y").length;
  const watched = p.watch.length ? "Y" : "";
  return L.lines.map((line) => {
    const hitArr = vals.map((v) => v >= line); // "at or above"
    const cnt = (arr: boolean[]) => arr.filter(Boolean).length;
    const l5 = hitArr.slice(0, 5), l10 = hitArr.slice(0, 10);
    const home = hitArr.filter((_, i) => g[i].home_away === "H");
    const away = hitArr.filter((_, i) => g[i].home_away === "A");
    let s = 0; while (s < hitArr.length && hitArr[s] === hitArr[0]) s++;
    const pct = (a: boolean[]) => (a.length ? Math.round((1000 * cnt(a)) / a.length) / 10 : null);
    return {
      player_key: key, sport, player: p.name, team: p.team, position: pos, stat: L.stat, line: line + "+",
      games: vals.length, L5: frac(cnt(l5), l5.length), L10: frac(cnt(l10), l10.length),
      Season: frac(cnt(hitArr), hitArr.length), Home: frac(cnt(home), home.length), Away: frac(cnt(away), away.length),
      avg: round1(avg), median: med, streak: (hitArr[0] ? "Hit " : "Miss ") + s, last10_values_newest_first: last10,
      limited_games_L10: lim10, watchlist: watched,
      L5_pct: pct(l5), L10_pct: pct(l10), season_pct: pct(hitArr), home_pct: pct(home), away_pct: pct(away),
      _line: line, _hits: hitArr,
    } satisfies HitRow;
  });
}

/** Watchlist first, then player, stat, line. */
export function sortHit(hit: HitRow[]) {
  hit.sort((a, b) => Number(b.watchlist === "Y") - Number(a.watchlist === "Y") || a.player.localeCompare(b.player) ||
    a.stat.localeCompare(b.stat) || a._line - b._line);
  return hit;
}

export const playerKey = (sport: Sport, name: string, team: string) => `${sport} – ${name} (${team})`;
