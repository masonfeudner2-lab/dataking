// NBA: parse an ESPN box score (parseNbaBox_) and rebuild logs/hit rates (rebuildNBA_).
import { SEASONS, type Settings } from "./config";
import { ladderRows, playerKey, sortHit } from "./ladder";
import type { HitRow, NbaLogRow, PlayerRow } from "./schema";
import { logOrder, normName, num, nowUtcIso, round1, splitPair } from "./util";
import type { WatchEntry } from "./watchlist";

export interface GameRef {
  id: string; date: string; stype: number;
  home: { id: string; abbr: string; score: number | null };
  away: { id: string; abbr: string; score: number | null };
}

const blankNba = (): Pick<NbaLogRow, "minutes" | "pts" | "reb" | "ast" | "fg3m" | "fg3a" | "fgm" | "fga" | "ftm" | "fta" |
  "oreb" | "dreb" | "stl" | "blk" | "tov" | "pf" | "plus_minus"> => ({
  minutes: null, pts: null, reb: null, ast: null, fg3m: null, fg3a: null, fgm: null, fga: null, ftm: null, fta: null,
  oreb: null, dreb: null, stl: null, blk: null, tov: null, pf: null, plus_minus: null,
});

const CHECKED = ["pts", "reb", "ast", "fg3m"] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Returns null when the box score is missing or its format changed (refuse to guess).
 * Cross-check: each team's player sums for PTS/REB/AST/3PM must equal the team totals and the final score;
 * on a mismatch those stats are blanked for every player on that team and the game is retried.
 */
export function parseNbaBox(body: any, g: GameRef, now = new Date()): NbaLogRow[] | null {
  const box = body && body.boxscore;
  if (!box || !box.players || box.players.length !== 2) return null;
  const rows: NbaLogRow[] = [];
  const scoreByTeam: Record<string, number | null> = { [g.home.id]: g.home.score, [g.away.id]: g.away.score };
  const ts = nowUtcIso(now);
  for (const tp of box.players) {
    const team = tp.team; const isHome = String(team.id) === String(g.home.id);
    const opp = isHome ? g.away : g.home; const me = isHome ? g.home : g.away;
    const grp = tp.statistics && tp.statistics[0];
    if (!grp || !grp.keys) return null;
    const k: string[] = grp.keys;
    const ix = (name: string) => k.indexOf(name);
    const need = ["minutes", "points", "rebounds", "assists", "threePointFieldGoalsMade-threePointFieldGoalsAttempted"];
    if (need.some((n) => ix(n) < 0)) return null;
    const teamRows: NbaLogRow[] = [];
    const sums: Record<(typeof CHECKED)[number], number> = { pts: 0, reb: 0, ast: 0, fg3m: 0 };
    for (const a of grp.athletes || []) {
      const s: unknown[] = a.stats || [];
      const dnp = a.didNotPlay === true || !s.length;
      const r: NbaLogRow = {
        game_id: String(g.id), game_date: g.date, season: SEASONS.NBA.label,
        season_type: g.stype === 3 ? "Postseason" : g.stype === 5 ? "Play-In" : "Regular",
        player_id: String(a.athlete.id), player: a.athlete.displayName, team: team.abbreviation,
        opponent: opp.abbr, home_away: isHome ? "H" : "A",
        team_result: (me.score ?? 0) > (opp.score ?? 0) ? "W" : "L",
        status: dnp ? "DNP" : "PLAYED", dnp_reason: dnp ? a.reason || "DNP" : "",
        starter: a.starter ? "Y" : "N", ejected: a.ejected ? "Y" : "", limited_minutes: "",
        ...blankNba(), check_status: "", check_note: "", source: "ESPN", updated_utc: ts,
      };
      if (!dnp) {
        const v = (n: string) => (ix(n) < 0 ? null : num(s[ix(n)]));
        const fg = splitPair(s[ix("fieldGoalsMade-fieldGoalsAttempted")], "-");
        const f3 = splitPair(s[ix("threePointFieldGoalsMade-threePointFieldGoalsAttempted")], "-");
        const ft = splitPair(s[ix("freeThrowsMade-freeThrowsAttempted")], "-");
        Object.assign(r, {
          minutes: v("minutes"), pts: v("points"), reb: v("rebounds"), ast: v("assists"),
          fg3m: f3[0], fg3a: f3[1], fgm: fg[0], fga: fg[1], ftm: ft[0], fta: ft[1],
          oreb: v("offensiveRebounds"), dreb: v("defensiveRebounds"), stl: v("steals"), blk: v("blocks"),
          tov: v("turnovers"), pf: v("fouls"), plus_minus: v("plusMinus"),
        });
        // a blank player stat makes the team sum NaN → can never "match" → blanked + retried
        for (const f of CHECKED) sums[f] += r[f] === null ? NaN : r[f];
      }
      teamRows.push(r);
    }
    const tot: unknown[] = grp.totals || [];
    const teamTot: Record<(typeof CHECKED)[number], number | null> = {
      pts: scoreByTeam[team.id] !== null && scoreByTeam[team.id] !== undefined ? scoreByTeam[team.id] : num(tot[ix("points")]),
      reb: num(tot[ix("rebounds")]), ast: num(tot[ix("assists")]),
      fg3m: splitPair(tot[ix("threePointFieldGoalsMade-threePointFieldGoalsAttempted")], "-")[0],
    };
    const bad = CHECKED.filter((f) => teamTot[f] !== null && sums[f] !== teamTot[f]);
    const missingTot = CHECKED.filter((f) => teamTot[f] === null);
    for (const r of teamRows) {
      if (r.status !== "PLAYED") { r.check_status = "OK (DNP)"; continue; }
      if (bad.length) {
        for (const f of bad) r[f] = null;
        r.check_status = "FAILED – team total mismatch";
        r.check_note = bad.map((f) => `${f}: players sum ${sums[f]} vs team ${teamTot[f]}`).join("; ") + " — blanked, will retry";
      } else if (missingTot.length) {
        r.check_status = "OK (partial check)"; r.check_note = "team total missing for " + missingTot.join(",");
      } else r.check_status = "OK – matches team totals";
    }
    rows.push(...teamRows);
  }
  return rows;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface NbaPlayer {
  id: string; name: string; team: string; lastDate: string; games: NbaLogRow[]; mins: number[];
  avgMin: number; watch: WatchEntry[]; tracked: boolean; key?: string;
}

export interface NbaRebuild {
  logRows: NbaLogRow[]; hit: HitRow[]; players: PlayerRow[]; P: Record<string, NbaPlayer>;
}

/**
 * rebuildNBA_. `rows` = every ESPN row (PLAYED + DNP), WITHOUT inferred NOT_IN_BOX rows (they are re-derived here).
 * Mutates rows' limited_minutes, like the Sheet.
 */
export function rebuildNba(rows: NbaLogRow[], cfg: Settings, watchAll: WatchEntry[], now = new Date()): NbaRebuild {
  const watch = watchAll.filter((w) => w.sport === "NBA");
  const P: Record<string, NbaPlayer> = {};
  for (const r of rows) {
    const p = (P[r.player_id] ||= { id: r.player_id, name: r.player, team: r.team, lastDate: "", games: [], mins: [], avgMin: 0, watch: [], tracked: false });
    if (r.game_date >= p.lastDate) { p.lastDate = r.game_date; p.team = r.team; p.name = r.player; }
    if (r.status === "PLAYED") { p.games.push(r); if (r.minutes !== null) p.mins.push(Number(r.minutes)); }
  }
  for (const p of Object.values(P)) {
    p.avgMin = p.mins.length ? p.mins.reduce((a, b) => a + b, 0) / p.mins.length : 0;
    p.watch = watch.filter((w) => w.norm === normName(p.name) && (!w.team || w.team === p.team));
    p.tracked = p.avgMin >= cfg.nbaMinMinutes || p.watch.length > 0;
  }
  // Limited: minutes more than X% below the player's season average (needs 3+ games), or ejected. Still counted.
  for (const r of rows) {
    const p = P[r.player_id];
    if (r.status === "PLAYED" && r.minutes !== null && p.mins.length >= 3) {
      r.limited_minutes = Number(r.minutes) < p.avgMin * (1 - cfg.limitedPct) || r.ejected === "Y" ? "Y" : "";
    } else r.limited_minutes = r.ejected === "Y" ? "Y" : "";
  }
  // Inferred NOT_IN_BOX rows for tracked players: team games during each stint where he isn't in the box.
  const teamGames: Record<string, Record<string, NbaLogRow>> = {};
  for (const r of rows) (teamGames[r.team] ||= {})[r.game_id] = r;
  const seen = new Set<string>(); const byPlayer: Record<string, NbaLogRow[]> = {};
  for (const r of rows) { seen.add(r.game_id + "|" + r.player_id); (byPlayer[r.player_id] ||= []).push(r); }
  const ts = nowUtcIso(now);
  const inferred: NbaLogRow[] = [];
  for (const [id, p] of Object.entries(P)) {
    if (!p.tracked) continue;
    const stints: Record<string, string> = {};
    for (const r of byPlayer[id] || []) if (!stints[r.team] || r.game_date < stints[r.team]) stints[r.team] = r.game_date;
    const order = Object.keys(stints).sort((a, b) => (stints[a] < stints[b] ? -1 : 1));
    order.forEach((t, i) => {
      const end = i + 1 < order.length ? stints[order[i + 1]] : "9999";
      for (const [gid, ref] of Object.entries(teamGames[t] || {})) {
        if (ref.game_date < stints[t] || ref.game_date >= end || seen.has(gid + "|" + id)) continue;
        inferred.push({
          game_id: gid, game_date: ref.game_date, season: ref.season, season_type: ref.season_type,
          player_id: id, player: p.name, team: t, opponent: ref.opponent, home_away: ref.home_away,
          team_result: ref.team_result, status: "NOT_IN_BOX", dnp_reason: "Not listed in box score (inactive / injured / away from team)",
          starter: "", ejected: "", limited_minutes: "", ...blankNba(),
          check_status: "OK (not counted)", check_note: "", source: "inferred", updated_utc: ts,
        });
      }
    });
  }
  const logRows = rows.concat(inferred).sort(logOrder);

  const hit: HitRow[] = []; const players: PlayerRow[] = [];
  for (const [id, p] of Object.entries(P)) {
    const key = playerKey("NBA", p.name, p.team);
    players.push({ player_key: key, sport: "NBA", player_id: id, player: p.name, team: p.team, position: "",
      games_played: p.games.length, avg_minutes_or_snap_pct: round1(p.avgMin), tracked: p.tracked ? "Y" : "", watchlist: p.watch.length ? "Y" : "" });
    if (!p.tracked) continue;
    p.key = key;
    for (const L of cfg.ladders.NBA) hit.push(...ladderRows(p, key, "NBA", "", L, "limited_minutes"));
  }
  sortHit(hit);
  return { logRows, hit, players, P };
}
