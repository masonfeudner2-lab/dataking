// NFL: parse an ESPN box score (parseNflBox_), cross-check against nflverse + snap counts, rebuild (rebuildNFL_).
import { SEASONS, type Settings } from "./config";
import { ladderRows, playerKey, sortHit } from "./ladder";
import { matchName, type MatchOptions } from "./names";
import type { HitRow, NflLogRow, PlayerRow } from "./schema";
import { logOrder, normName, num, nowUtcIso, round1, splitPair } from "./util";
import type { WatchEntry } from "./watchlist";

/** ESPN → nflverse team codes (all others identical). */
export const NFL_TEAM_FIX: Record<string, string> = { WSH: "WAS", LAR: "LA" };
export const nvTeam = (espnTeam: string) => NFL_TEAM_FIX[espnTeam] || espnTeam;

export interface NflGameRef {
  id: string; date: string; stype: number; week: number;
  home: { id: string; abbr: string; score: number | null };
  away: { id: string; abbr: string; score: number | null };
}

export interface NvStat {
  player_id: string; player_display_name: string; position: string; week: string; team: string;
  completions: string; attempts: string; passing_yards: string; passing_tds: string;
  carries: string; rushing_yards: string; receptions: string; targets: string; receiving_yards: string;
}
export interface NvSnap { name: string; position: string; snaps: number; pct: number }
export interface Nflverse {
  /** keyed "TEAM|week" using nflverse team codes */
  stats: Record<string, NvStat[]>; snaps: Record<string, NvSnap[]>;
  statsWeeks: Set<string>; snapWeeks: Set<string>; statsOk: boolean; snapsOk: boolean;
}

export const NV_STAT_COLS = ["player_id", "player_display_name", "position", "week", "team", "completions", "attempts",
  "passing_yards", "passing_tds", "carries", "rushing_yards", "receptions", "targets", "receiving_yards"] as const;
export const NV_SNAP_COLS = ["week", "player", "position", "team", "offense_snaps", "offense_pct"] as const;

/** Build the nflverse lookup from parsed CSV tables (header row first). Missing columns → that source is "not loaded". */
export function buildNflverse(statsCsv: string[][] | null, snapsCsv: string[][] | null): Nflverse {
  const out: Nflverse = { stats: {}, snaps: {}, statsWeeks: new Set(), snapWeeks: new Set(), statsOk: false, snapsOk: false };
  if (statsCsv && statsCsv.length > 1) {
    const h = statsCsv[0]; const I = (n: string) => h.indexOf(n);
    if (NV_STAT_COLS.every((c) => I(c) >= 0)) {
      out.statsOk = true;
      for (const r of statsCsv.slice(1)) {
        const o = Object.fromEntries(NV_STAT_COLS.map((c) => [c, r[I(c)]])) as unknown as NvStat;
        const k = o.team + "|" + o.week;
        out.statsWeeks.add(k); (out.stats[k] ||= []).push(o);
      }
    }
  }
  if (snapsCsv && snapsCsv.length > 1) {
    const h = snapsCsv[0]; const I = (n: string) => h.indexOf(n);
    if (NV_SNAP_COLS.every((c) => I(c) >= 0)) {
      out.snapsOk = true;
      for (const r of snapsCsv.slice(1)) {
        const k = r[I("team")] + "|" + r[I("week")];
        out.snapWeeks.add(k);
        (out.snaps[k] ||= []).push({ name: r[I("player")], position: r[I("position")], snaps: Number(r[I("offense_snaps")]), pct: Number(r[I("offense_pct")]) });
      }
    }
  }
  return out;
}

const zeroStats = () => ({ pass_cmp: 0, pass_att: 0, pass_yds: 0, pass_td: 0, pass_int: 0, carries: 0, rush_yds: 0, rush_td: 0,
  receptions: 0, targets: 0, rec_yds: 0, rec_td: 0 } as Record<string, number | null>);

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Returns null when the box score is missing or a stat group's format changed (refuse to guess). */
export function parseNflBox(body: any, g: NflGameRef, now = new Date()): NflLogRow[] | null {
  const box = body && body.boxscore;
  if (!box || !box.players || box.players.length !== 2) return null;
  const rows: NflLogRow[] = [];
  const ts = nowUtcIso(now);
  for (const tp of box.players) {
    const team = tp.team; const isHome = String(team.id) === String(g.home.id);
    const me = isHome ? g.home : g.away; const opp = isHome ? g.away : g.home;
    const P: Record<string, NflLogRow> = {};
    const get = (a: any): NflLogRow => (P[a.athlete.id] ||= {
      game_id: String(g.id), game_date: g.date, season: String(SEASONS.NFL.year),
      season_type: g.stype === 3 ? "Postseason" : "Regular", week: g.week,
      player_id: String(a.athlete.id), player: a.athlete.displayName, position: a.athlete.position?.abbreviation || "",
      team: team.abbreviation, opponent: opp.abbr, home_away: isHome ? "H" : "A",
      team_result: (me.score ?? 0) > (opp.score ?? 0) ? "W" : (me.score ?? 0) < (opp.score ?? 0) ? "L" : "T", status: "PLAYED", dnp_reason: "",
      ...zeroStats(), off_snaps: null, off_snap_pct: null, limited_snaps: "",
      check_status: "", check_note: "", source: "ESPN", updated_utc: ts,
    } as NflLogRow);
    let sumPass = 0, sumRec = 0, hasPass = false, hasRec = false;
    for (const grp of tp.statistics || []) {
      const k: string[] = grp.keys || []; const ix = (n: string) => k.indexOf(n);
      const cell = (s: unknown[], n: string) => (ix(n) < 0 ? null : num(s[ix(n)]));
      if (grp.name === "passing") {
        if (ix("passingYards") < 0 || ix("passingTouchdowns") < 0) return null;
        hasPass = true;
        for (const a of grp.athletes || []) {
          const s = a.stats || []; const r = get(a); const ca = splitPair(s[ix("completions/passingAttempts")], "/");
          r.pass_cmp = ca[0]; r.pass_att = ca[1]; r.pass_yds = cell(s, "passingYards");
          r.pass_td = cell(s, "passingTouchdowns"); r.pass_int = cell(s, "interceptions");
          sumPass += Number(r.pass_yds) || 0;
        }
      } else if (grp.name === "rushing") {
        if (ix("rushingYards") < 0) return null;
        for (const a of grp.athletes || []) {
          const s = a.stats || []; const r = get(a);
          r.carries = cell(s, "rushingAttempts"); r.rush_yds = cell(s, "rushingYards"); r.rush_td = cell(s, "rushingTouchdowns");
        }
      } else if (grp.name === "receiving") {
        if (ix("receptions") < 0 || ix("receivingYards") < 0) return null;
        hasRec = true;
        for (const a of grp.athletes || []) {
          const s = a.stats || []; const r = get(a);
          r.receptions = cell(s, "receptions"); r.rec_yds = cell(s, "receivingYards");
          r.rec_td = cell(s, "receivingTouchdowns"); r.targets = cell(s, "receivingTargets");
          sumRec += Number(r.rec_yds) || 0;
        }
      }
    }
    // Team passing yds vs receiving yds: a note only, never blanks anything.
    const teamOk = !(hasPass && hasRec) || sumPass === sumRec;
    for (const r of Object.values(P)) {
      r.espn_team_check = teamOk ? "" : `note: team passing yds (${sumPass}) ≠ receiving yds (${sumRec}), per-player check still applies`;
      rows.push(r);
    }
  }
  return rows;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const VERIFY: [keyof NflLogRow, keyof NvStat][] = [["pass_yds", "passing_yards"], ["pass_td", "passing_tds"], ["rush_yds", "rushing_yards"],
  ["receptions", "receptions"], ["rec_yds", "receiving_yards"], ["carries", "carries"], ["targets", "targets"], ["pass_att", "attempts"]];
/** A mismatch on these blanks the stat. Carries/targets/attempts mismatches are noted only. */
export const BLANK_ON_MISMATCH = new Set(["pass_yds", "pass_td", "rush_yds", "receptions", "rec_yds"]);

const n0 = (v: unknown) => Number(v === null || v === undefined || v === "" ? 0 : v);

export interface NflOptions { /** see MatchOptions.mode */ nameMatching?: MatchOptions["mode"] }

/** Normalized names of every player seen in our box scores, per ESPN team code (the matching guard). */
export function rosters(espnRows: NflLogRow[]): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const r of espnRows) (out[r.team] ||= new Set()).add(normName(r.player));
  return out;
}

/** Second-source check + snap counts for ESPN rows (first half of rebuildNFL_). Mutates rows. */
export function verifyNfl(espnRows: NflLogRow[], nv: Nflverse, opts: NflOptions = {}) {
  const R = rosters(espnRows);
  for (const r of espnRows) {
    const mo: MatchOptions = { roster: R[r.team], position: r.position, mode: opts.nameMatching };
    const k = nvTeam(r.team) + "|" + r.week;
    r.check_note = r.espn_team_check || "";
    if (!nv.statsOk || !nv.statsWeeks.has(k)) {
      r.check_status = "PENDING – single source (nflverse not posted yet)";
    } else {
      const m = matchName(nv.stats[k], r.player, mo);
      if (m && m.position && !r.position) r.position = m.position;
      if (m) r.nflverse_id = m.player_id;
      const touched = (["pass_att", "carries", "targets", "receptions"] as const).some((f) => Number(r[f]) > 0);
      if (!m) {
        r.check_status = touched ? "PENDING – single source (player not matched in nflverse)" : "OK – no offensive stats";
      } else {
        const bad = VERIFY.filter(([a, b]) => n0(r[a]) !== n0(m[b]));
        if (!bad.length) r.check_status = "OK – ESPN & nflverse match";
        else {
          r.check_note = (r.check_note ? r.check_note + " | " : "") + bad.map(([a, b]) => `${a}: ESPN ${r[a] ?? ""} vs nflverse ${m[b]}`).join("; ");
          for (const [a] of bad) if (BLANK_ON_MISMATCH.has(a)) (r as unknown as Record<string, unknown>)[a] = null;
          r.check_status = bad.some(([a]) => BLANK_ON_MISMATCH.has(a)) ? "MISMATCH – blanked" : "OK – minor mismatch (carries/targets/att only)";
        }
      }
    }
    const sm = nv.snaps[k] ? matchName(nv.snaps[k], r.player, mo) : null;
    if (sm) { r.off_snaps = sm.snaps; r.off_snap_pct = Math.round(sm.pct * 100); if (!r.position) r.position = sm.position; }
    else { r.off_snaps = null; r.off_snap_pct = null; }
    delete r.espn_team_check;
  }
}

export interface NflPlayer {
  id: string; name: string; team: string; pos: string; lastDate: string; maxAtt: number;
  games: NflLogRow[]; pcts: number[]; tg: number; car: number;
  avgPct: number; avgTgt: number; avgCar: number; isQB: boolean; rec: boolean; rush: boolean; offPos: boolean;
  watch: WatchEntry[]; tracked: boolean; key?: string;
}

/** Inferred rows (second half of rebuildNFL_): real-0 snap-only games, DNP, and PENDING (snaps not posted). */
export function inferNfl(espnRows: NflLogRow[], nv: Nflverse, P: Record<string, NflPlayer>, now = new Date(), opts: NflOptions = {}): NflLogRow[] {
  const R = rosters(espnRows);
  const TG: Record<string, Record<string, NflLogRow>> = {};
  for (const r of espnRows) (TG[r.team] ||= {})[r.game_id] = r;
  const have = new Set<string>(); const byPlayer: Record<string, NflLogRow[]> = {};
  for (const r of espnRows) { have.add(r.game_id + "|" + r.player_id); (byPlayer[r.player_id] ||= []).push(r); }
  const ts = nowUtcIso(now);
  const inferred: NflLogRow[] = [];
  for (const [id, p] of Object.entries(P)) {
    const stints: Record<string, string> = {};
    for (const r of byPlayer[id] || []) if (!stints[r.team] || r.game_date < stints[r.team]) stints[r.team] = r.game_date;
    const order = Object.keys(stints).sort((a, b) => (stints[a] < stints[b] ? -1 : 1));
    order.forEach((t, i) => {
      const end = i + 1 < order.length ? stints[order[i + 1]] : "9999";
      for (const [gid, ref] of Object.entries(TG[t] || {})) {
        if (have.has(gid + "|" + id) || ref.game_date >= end) continue;
        const k = nvTeam(t) + "|" + ref.week;
        const sm = nv.snaps[k] ? matchName(nv.snaps[k], p.name, { roster: R[t], position: p.pos, mode: opts.nameMatching }) : null;
        const base = { game_id: gid, game_date: ref.game_date, season: ref.season, season_type: ref.season_type, week: ref.week,
          player_id: id, player: p.name, position: p.pos, team: t, opponent: ref.opponent, home_away: ref.home_away,
          team_result: ref.team_result, source: "inferred", updated_utc: ts, limited_snaps: "", check_note: "" };
        if (sm && sm.snaps > 0) {
          // On the field per snap counts but no stats: a real 0, not a DNP.
          inferred.push({ ...base, status: "PLAYED", dnp_reason: "", ...zeroStats(),
            off_snaps: sm.snaps, off_snap_pct: Math.round(sm.pct * 100),
            check_status: "OK – played (snap count), no stats in box score" } as NflLogRow);
        } else if (ref.game_date < stints[t]) {
          // before his first box-score appearance for this team: only logged if snaps say he played (above)
        } else if (nv.snapWeeks.has(k)) {
          inferred.push({ ...base, status: "DNP", dnp_reason: "No offensive snaps (inactive / injured / DNP)", ...nullStats(),
            check_status: "OK (not counted)" } as NflLogRow);
        } else {
          inferred.push({ ...base, status: "PENDING", dnp_reason: "Not in box score; snap counts not posted yet — excluded until confirmed", ...nullStats(),
            check_status: "PENDING – snap counts not posted" } as NflLogRow);
        }
      }
    });
  }
  return inferred;
}
const nullStats = () => ({ pass_cmp: null, pass_att: null, pass_yds: null, pass_td: null, pass_int: null, carries: null, rush_yds: null, rush_td: null,
  receptions: null, targets: null, rec_yds: null, rec_td: null, off_snaps: null, off_snap_pct: null });

export function nflPlayerMeta(espnRows: NflLogRow[]): Record<string, NflPlayer> {
  const P: Record<string, NflPlayer> = {};
  for (const r of espnRows) {
    const p = (P[r.player_id] ||= { id: r.player_id, name: r.player, team: r.team, pos: "", lastDate: "", maxAtt: 0,
      games: [], pcts: [], tg: 0, car: 0, avgPct: 0, avgTgt: 0, avgCar: 0, isQB: false, rec: false, rush: false, offPos: true, watch: [], tracked: false });
    if (r.game_date >= p.lastDate) { p.lastDate = r.game_date; p.team = r.team; p.name = r.player; }
    if (r.position) p.pos = r.position;
    p.maxAtt = Math.max(p.maxAtt, Number(r.pass_att) || 0);
  }
  return P;
}

export interface NflRebuild { logRows: NflLogRow[]; hit: HitRow[]; players: PlayerRow[]; P: Record<string, NflPlayer> }

/**
 * Derive tracking, limited flags and hit rates from complete log rows (ESPN + inferred).
 * Pure function of the logs; this is what rebuilds from the database.
 */
export function deriveNfl(espnRows: NflLogRow[], inferred: NflLogRow[], P: Record<string, NflPlayer>, cfg: Settings, watchAll: WatchEntry[]): NflRebuild {
  const watch = watchAll.filter((w) => w.sport === "NFL");
  const all = espnRows.concat(inferred);
  for (const p of Object.values(P)) { p.games = []; p.pcts = []; p.tg = 0; p.car = 0; }
  for (const r of all) {
    const p = P[r.player_id]; if (!p || r.status !== "PLAYED") continue;
    p.games.push(r); if (r.off_snap_pct !== null && r.off_snap_pct !== undefined) p.pcts.push(Number(r.off_snap_pct));
    p.tg += Number(r.targets) || 0; p.car += Number(r.carries) || 0;
  }
  for (const p of Object.values(P)) {
    const n = p.games.length || 1;
    p.avgPct = p.pcts.length ? p.pcts.reduce((a, b) => a + b, 0) / p.pcts.length : 0;
    p.avgTgt = p.tg / n; p.avgCar = p.car / n;
    p.isQB = p.pos === "QB" && p.maxAtt >= cfg.nflQbAtt;
    p.watch = watch.filter((w) => w.norm === normName(p.name) && (!w.team || w.team === p.team || NFL_TEAM_FIX[p.team] === w.team));
    p.rec = p.avgTgt >= cfg.nflMinTargets; p.rush = p.avgCar >= cfg.nflMinCarries;
    p.offPos = p.pos ? ["QB", "RB", "WR", "TE", "FB"].includes(p.pos) : true;
    p.tracked = (p.offPos && (p.isQB || p.rec || p.rush)) || p.watch.length > 0;
  }
  for (const r of all) {
    const p = P[r.player_id];
    r.limited_snaps = r.status === "PLAYED" && r.off_snap_pct !== null && r.off_snap_pct !== undefined && p.pcts.length >= 3 &&
      Number(r.off_snap_pct) < p.avgPct * (1 - cfg.limitedPct) ? "Y" : "";
  }
  // keep the log lean: drop inferred rows for untracked players
  const logRows = all.filter((r) => r.source === "ESPN" || P[r.player_id]?.tracked).sort(logOrder);

  const hit: HitRow[] = []; const players: PlayerRow[] = [];
  for (const [id, p] of Object.entries(P)) {
    const key = playerKey("NFL", p.name, p.team);
    players.push({ player_key: key, sport: "NFL", player_id: id, player: p.name, team: p.team, position: p.pos,
      games_played: p.games.length, avg_minutes_or_snap_pct: round1(p.avgPct), tracked: p.tracked ? "Y" : "", watchlist: p.watch.length ? "Y" : "" });
    if (!p.tracked) continue;
    p.key = key;
    for (const L of cfg.ladders.NFL) {
      const watched = p.watch.some((w) => w.stat === L.stat);
      if (L.applies === "QB only" && !p.isQB) continue;
      const ok = L.applies === "QB only" ? p.isQB : L.applies === "receivers" ? p.rec || watched : L.applies === "rushers" ? p.rush || watched : true;
      if (ok) hit.push(...ladderRows(p, key, "NFL", p.pos, L, "limited_snaps"));
    }
  }
  sortHit(hit);
  return { logRows, hit, players, P };
}

/** Full rebuildNFL_: verify ESPN rows against nflverse, infer missing games, derive hit rates. */
export function rebuildNfl(espnRows: NflLogRow[], nv: Nflverse, cfg: Settings, watch: WatchEntry[], now = new Date(), opts: NflOptions = {}): NflRebuild {
  verifyNfl(espnRows, nv, opts);
  const P = nflPlayerMeta(espnRows);
  const inferred = inferNfl(espnRows, nv, P, now, opts);
  return deriveNfl(espnRows, inferred, P, cfg, watch);
}
