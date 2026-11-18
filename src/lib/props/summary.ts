// Daily Summary (buildSummary_ in PropTracker.gs): what changed, trends, streaks, newly out, limited, unverified.
import type { Settings } from "./config";
import type { HitRow, LogRow, NbaLogRow, NflLogRow, Sport } from "./schema";
import { isOk } from "./schema";
import { daysAgo, normName } from "./util";
import type { WatchEntry } from "./watchlist";

export type SummaryItem = [section: string, item: string, detail: string];

/** ESPN → basketball-reference team codes (verification links). */
const BBREF_TEAM: Record<string, string> = { BKN: "BRK", CHA: "CHO", GS: "GSW", NO: "NOP", NY: "NYK", PHX: "PHO", SA: "SAS", UTAH: "UTA", WSH: "WAS" };

export interface SummaryPlayer { name: string; team?: string; key?: string; watch: WatchEntry[]; tracked: boolean; isQB?: boolean }

export function buildSummary(sport: Sport, P: Record<string, SummaryPlayer>, hit: HitRow[], logRows: LogRow[], cfg: Settings,
  freshIds: string[], watch: WatchEntry[], now = new Date()): SummaryItem[] {
  const items: SummaryItem[] = [];
  const recentDays = sport === "NBA" ? 3 : 8;
  const fresh = new Set(freshIds);
  const recentFresh = new Set<string>();
  for (const r of logRows) if (fresh.has(r.game_id) && daysAgo(r.game_date, now) <= recentDays) recentFresh.add(r.game_id);
  const older = [...fresh].filter((id) => !recentFresh.has(id)).length;
  if (older) items.push(["BACKFILL", older + " older games loaded", "Per-game notes below cover only the last " + recentDays + " days."]);

  const byKey: Record<string, SummaryPlayer> = {};
  for (const p of Object.values(P)) if (p.key) byKey[p.key] = p;
  const isWatchedRow = (h: HitRow) => {
    const p = byKey[h.player_key];
    return !!p && p.watch.some((w) => (!w.stat || w.stat === h.stat) && (w.line === null || w.line === h._line));
  };
  // the most useful line per watched player+stat: the one he specified, else the highest line at/below his median
  const focus = (key: string) => {
    const byStat: Record<string, HitRow[]> = {};
    for (const h of hit) if (h.player_key === key && isWatchedRow(h)) (byStat[h.stat] ||= []).push(h);
    const p = byKey[key];
    return Object.keys(byStat).map((st) => {
      const w = p.watch.find((x) => x.stat === st && x.line !== null);
      const list = byStat[st];
      if (w) return list.find((h) => h._line === w.line) || list[0];
      const under = list.filter((h) => h._line <= h.median);
      return under.length ? under[under.length - 1] : list[0];
    });
  };

  for (const w of watch) {
    const found = Object.values(P).some((p) => normName(p.name) === w.norm);
    if (!found) items.push(["WATCHLIST", w.player, "Not found in " + sport + " box scores this season — check spelling (or he has not played yet)."]);
  }

  // what changed: watchlist players with a new game this run
  for (const r of logRows) {
    const p = P[r.player_id];
    if (!recentFresh.has(r.game_id) || !p || !p.watch.length) continue;
    let line: string;
    if (r.status !== "PLAYED") line = r.status + " — " + (r.dnp_reason || "") + " (not counted)";
    else if (sport === "NBA") {
      const n = r as NbaLogRow;
      line = `${n.minutes} min, ${n.pts ?? ""} pts, ${n.reb ?? ""} reb, ${n.ast ?? ""} ast, ${n.fg3m ?? ""} 3PM` + (n.limited_minutes === "Y" ? "  ⚠ limited minutes" : "");
    } else {
      const n = r as NflLogRow;
      line = (p.isQB ? `${n.pass_yds ?? ""} pass yds, ${n.pass_td ?? ""} pass TD, ` : "") + `${n.rush_yds ?? ""} rush yds, ${n.receptions ?? ""} rec, ${n.rec_yds ?? ""} rec yds` +
        (n.off_snap_pct !== null ? `, ${n.off_snap_pct}% snaps` : "") + (n.limited_snaps === "Y" ? "  ⚠ limited snaps" : "");
    }
    const props = p.key ? focus(p.key).map((h) => `${h.stat} ${h.line}: L10 ${h.L10}, season ${h.Season}, ${h.streak}`) : [];
    items.push(["CHANGED", `${p.name} vs ${r.opponent} (${r.game_date})`, line + (props.length ? " | " + props.join(" · ") : "")]);
  }

  // trends: L5 vs season gap ≥ X points with ≥ N games, collapsed to the biggest gap per player+stat
  const trend = (rows: HitRow[]) => {
    const best: Record<string, { h: HitRow; gap: number }> = {};
    for (const h of rows) {
      if (h.games < cfg.trendMinGames || h.L5_pct === null || h.season_pct === null) continue;
      const gap = (h.L5_pct - h.season_pct) / 100;
      if (Math.abs(gap) < cfg.trendGap) continue;
      const k = h.player_key + "|" + h.stat;
      if (!best[k] || Math.abs(gap) > Math.abs(best[k].gap)) best[k] = { h, gap };
    }
    return Object.values(best).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  };
  const wRows = hit.filter(isWatchedRow);
  for (const t of trend(wRows)) items.push([t.gap > 0 ? "TRENDING UP" : "TRENDING DOWN", `${t.h.player} ${t.h.stat} ${t.h.line}`,
    `L5 ${t.h.L5} vs season ${t.h.Season} (avg ${t.h.avg}, last: ${t.h.last10_values_newest_first})`]);
  // streaks ≥ N, collapsed: highest line on an active hit streak, lowest line on an active miss streak
  const sk: Record<string, HitRow> = {};
  for (const h of wRows) {
    const n = Number(h.streak.split(" ")[1]);
    if (n < cfg.streakMin) continue;
    const k = h.player_key + "|" + h.stat + "|" + h.streak.split(" ")[0];
    const isHit = h.streak[0] === "H";
    if (!sk[k] || (isHit ? h._line > sk[k]._line : h._line < sk[k]._line)) sk[k] = h;
  }
  for (const h of Object.values(sk)) items.push(["STREAK", `${h.player} ${h.stat} ${h.line}`, `${h.streak} straight (season ${h.Season}, last: ${h.last10_values_newest_first})`]);
  for (const t of trend(hit.filter((h) => h.watchlist !== "Y")).slice(0, 10)) items.push(["LEAGUE TREND", `${t.h.player} (${t.h.team}) ${t.h.stat} ${t.h.line}`,
    `${t.gap > 0 ? "▲ " : "▼ "}L5 ${t.h.L5} vs season ${t.h.Season}`]);

  // newly out (played his previous game) + limited, for this run's games
  const freshRows = logRows.filter((r) => recentFresh.has(r.game_id) && P[r.player_id]?.tracked);
  const byPlayer: Record<string, LogRow[]> = {};
  for (const r of logRows) (byPlayer[r.player_id] ||= []).push(r);
  const prevPlayed = (r: LogRow) => {
    const prior = (byPlayer[r.player_id] || []).filter((x) => x.game_date < r.game_date).sort((x, y) => (x.game_date < y.game_date ? 1 : -1))[0];
    return !!prior && prior.status === "PLAYED";
  };
  const dnp = freshRows.filter((r) => r.status !== "PLAYED" && r.status !== "PENDING" && prevPlayed(r));
  if (dnp.length) items.push(["DNP / INACTIVE", dnp.length + " newly out", dnp.slice(0, 40).map((r) => `${r.player} (${r.team})`).join(", ") + (dnp.length > 40 ? ", …" : "") + " — not counted in hit rates"]);
  const lim = freshRows.filter((r) => (r as NbaLogRow).limited_minutes === "Y" || (r as NflLogRow).limited_snaps === "Y");
  if (lim.length) items.push(["LIMITED " + (sport === "NBA" ? "MINUTES" : "SNAPS"), lim.length + " tracked players",
    lim.slice(0, 40).map((r) => r.player + " " + (sport === "NBA" ? `${(r as NbaLogRow).minutes} min` : `${(r as NflLogRow).off_snap_pct ?? ""}% snaps`) +
      ((r as NbaLogRow).ejected === "Y" ? " (ejected)" : "")).join(", ") + " — counted, but flagged"]);

  // unverified: every blank / mismatch / pending row (any game)
  const grouped: Record<string, LogRow[]> = {};
  for (const r of logRows) if (!isOk(r.check_status) && (!P[r.player_id] || P[r.player_id].tracked || r.source === "ESPN")) (grouped[r.check_status] ||= []).push(r);
  for (const [k, list] of Object.entries(grouped)) {
    const detail = list.slice(0, 25).map((r) => r.player + " " + r.game_date + (r.check_note ? ` [${r.check_note}]` : "")).join("; ") +
      (list.length > 25 ? `; … (${list.length} total — filter Game Logs by check_status)` : "");
    items.push(["UNVERIFIED", `${k} — ${list.length} rows`, detail]);
  }

  // NBA: one spot-check line per new game, with a Basketball-Reference link
  if (sport === "NBA") {
    // Object.keys() order in the Sheet: integer-like game ids ascend numerically
    for (const gid of [...recentFresh].sort((a, b) => Number(a) - Number(b))) {
      const rs = (logRows as NbaLogRow[]).filter((r) => r.game_id === gid && r.status === "PLAYED");
      if (!rs.length) continue;
      const home = rs.find((r) => r.home_away === "H");
      const homeTeam = home ? home.team : rs[0].opponent;
      const url = `https://www.basketball-reference.com/boxscores/${rs[0].game_date.replace(/-/g, "")}0${BBREF_TEAM[homeTeam] || homeTeam}.html`;
      const line = "MIN/PTS/REB/AST/3PM — " + rs.filter((r) => Number(r.minutes) >= 10)
        .map((r) => r.player + " " + [r.minutes, r.pts, r.reb, r.ast, r.fg3m].map((v) => v ?? "").join("/")).join("; ");
      items.push(["VERIFY", `${gid} ${rs[0].game_date} ${url}`, line]);
    }
  }
  if (!items.length) items.push(["NOTE", "No new games", "Nothing changed since the last run."]);
  return items;
}
