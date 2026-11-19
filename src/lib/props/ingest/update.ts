// The scheduled update (updateNBA_ / updateNFL_ in PropTracker.gs), writing to the LiveStore.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { RETRY_DAYS, SEASONS, type Settings } from "../config";
import { parseCsv } from "../csv";
import { parseNbaBox, rebuildNba, type GameRef } from "../nba";
import { buildNflverse, deriveNfl, inferNfl, nflPlayerMeta, parseNflBox, verifyNfl, type NflGameRef, type Nflverse } from "../nfl";
import { isOk, type NbaLogRow, type NflLogRow, type Sport } from "../schema";
import { buildSummary, type SummaryItem } from "../summary";
import { daysAgo, logOrder, num, ymdInTz } from "../util";
import type { WatchEntry } from "../watchlist";
import { fetchAll as realFetchAll, fetchBoxes as realFetchBoxes, fetchOne, type FetchResult } from "./fetch";
import type { LiveStore, RunInfo } from "./files";

const ET = "America/New_York";
const PT = "America/Los_Angeles";

/** Network access, injectable for tests. */
export interface Net {
  fetchAll: <T = any>(urls: string[]) => Promise<FetchResult<T>[]>;
  fetchBoxes: (sport: Sport, ids: string[]) => Promise<(any | null)[]>;
  fetchText: (url: string) => Promise<string | null>;
}
export const realNet: Net = {
  fetchAll: (urls) => realFetchAll(urls),
  fetchBoxes: realFetchBoxes,
  fetchText: async (url) => { const r = await fetchOne<string>(url, false); return r.ok ? r.body : null; },
};

export interface RunResult { items: SummaryItem[]; info: RunInfo }

const ptStamp = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};

function saveSummary(store: LiveStore, sport: Sport, items: SummaryItem[], now: Date) {
  const t = ptStamp(now);
  store.appendSummary(items.map(([section, item, detail]) => ({ run_time_pt: t, sport, section, item, detail })));
}

/**
 * ESPN corrects box scores days after games (rebounds/assists moved between teammates), and the Sheet never
 * re-fetched a game that had passed its checks. So: re-fetch every FINAL game from the last 14 days on every
 * run, and the whole season once a week. A failed fetch never overwrites rows we already have.
 */
const REFRESH_DAYS = 14;
const FULL_REFRESH_EVERY_DAYS = 7;
const fullRefreshDue = (last: string | undefined, now: Date) => !last || (now.getTime() - new Date(last).getTime()) / 86400000 >= FULL_REFRESH_EVERY_DAYS - 0.1;

// ================================================================= NBA
export async function updateNba(store: LiveStore, cfg: Settings, watch: WatchEntry[], now = new Date(), net: Net = realNet): Promise<RunResult> {
  const t0 = Date.now();
  const state = store.readState();
  const st = state.NBA;
  const notes: SummaryItem[] = [];
  const existing = store.readNbaLogs().filter((r) => r.status !== "NOT_IN_BOX");
  const full = fullRefreshDue(st.lastFullRefresh, now);
  const byGame: Record<string, NbaLogRow[]> = {};
  for (const r of existing) (byGame[r.game_id] ||= []).push(r);

  // 1) which dates to scan
  const today = ymdInTz(now, ET);
  let from = full ? SEASONS.NBA.scanFrom : st.scanFrom || SEASONS.NBA.scanFrom;
  const refreshFrom = new Date(now.getTime() - REFRESH_DAYS * 86400000).toISOString().slice(0, 10);
  if (refreshFrom < from) from = refreshFrom < SEASONS.NBA.scanFrom ? SEASONS.NBA.scanFrom : refreshFrom;
  const missing = (st.missing || []).filter((d) => daysAgo(d, now) <= RETRY_DAYS);
  for (const r of existing) if (!isOk(r.check_status) && daysAgo(r.game_date, now) <= RETRY_DAYS && r.game_date < from) from = r.game_date;
  for (const d of missing) if (d < from) from = d;
  const dates: string[] = [];
  for (let d = new Date(from + "T12:00:00Z"); d.toISOString().slice(0, 10) <= today; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
  const sb = await net.fetchAll<any>(dates.map((d) => `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100&dates=${d.replace(/-/g, "")}`));

  // 2) FINAL regular / play-in / postseason games we still need
  const games: GameRef[] = []; const sbFail: string[] = [];
  let lastFullyFinalDate: string | null = null, allFinal = true;
  sb.forEach((r, i) => {
    if (!r.ok) { allFinal = false; sbFail.push(`${dates[i]} (HTTP ${r.code})`); return; }
    let dayFinal = true;
    for (const ev of r.body.events || []) {
      const comp = ev.competitions?.[0];
      const s = ev.status?.type;
      const stype = ev.season?.type || 2;
      if (stype === 1 || stype === 4) continue; // preseason / All-Star
      if (!s || !s.completed || s.name !== "STATUS_FINAL") { if (!(s && /POSTPONED|CANCELED/.test(s.name))) dayFinal = false; continue; }
      const prior = byGame[ev.id];
      const date = ymdInTz(new Date(ev.date), ET);
      const needsRetry = prior && prior.some((x) => !isOk(x.check_status)) && daysAgo(prior[0].game_date, now) <= RETRY_DAYS;
      const refresh = full || daysAgo(date, now) <= REFRESH_DAYS;
      if (prior && !needsRetry && !refresh) continue;
      const c: Record<string, any> = {};
      for (const x of comp?.competitors || []) c[x.homeAway] = { id: String(x.team.id), abbr: x.team.abbreviation, score: num(x.score) };
      if (!c.home || !c.away) continue;
      games.push({ id: String(ev.id), date, stype, home: c.home, away: c.away });
    }
    if (dayFinal && allFinal) lastFullyFinalDate = dates[i]; else allFinal = false;
  });

  // 3) box scores
  const stillMissing: string[] = []; const fresh: string[] = [];
  let added = 0;
  const boxes = await net.fetchBoxes("NBA", games.map((g) => g.id));
  games.forEach((g, j) => {
    const rows = boxes[j] ? parseNbaBox(boxes[j], g, now) : null;
    if (!rows) {
      stillMissing.push(g.date);
      // keep what we had; it stays flagged for retry
      notes.push(["UNVERIFIED", `${g.away.abbr} @ ${g.home.abbr} ${g.date}`, "Box score not available from ESPN yet; game skipped, will retry."]);
      return;
    }
    byGame[g.id] = rows; fresh.push(g.id); added += rows.length;
  });

  if (lastFullyFinalDate) {
    const d = new Date(lastFullyFinalDate + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 2);
    const s = d.toISOString().slice(0, 10);
    st.scanFrom = s < SEASONS.NBA.scanFrom ? SEASONS.NBA.scanFrom : s;
  }
  st.missing = [...new Set(stillMissing)];
  if (!sbFail.length) st.backfillDone = true;
  if (full && !sbFail.length) st.lastFullRefresh = now.toISOString();
  if (sbFail.length) notes.unshift(["UNVERIFIED", `${sbFail.length} of ${dates.length} ESPN scoreboard days did not load`, sbFail.slice(0, 5).join(", ") + (sbFail.length > 5 ? ", …" : "") + " — will retry next run"]);

  // 4) rebuild + save
  const all = Object.values(byGame).flat();
  const res = rebuildNba(all, cfg, watch, now);
  store.writeNbaLogs(res.logRows);
  const items = buildSummary("NBA", res.P, res.hit, res.logRows, cfg, fresh, watch.filter((w) => w.sport === "NBA"), now);
  const msg = `${fresh.length} games processed, ${added} player rows written, ${Math.round((Date.now() - t0) / 1000)}s`;
  const info: RunInfo = { at: now.toISOString(), ok: !sbFail.length, gamesProcessed: fresh.length, freshIds: fresh, message: msg };
  st.lastRun = info; if (info.ok) st.lastSuccess = info.at;
  store.writeState(state);
  const out: SummaryItem[] = [["RUN", "NBA update", msg], ...items, ...notes];
  saveSummary(store, "NBA", out, now);
  return { items: out, info };
}

// ================================================================= NFL
export async function loadNflverse(year: number, net: Net, notes: SummaryItem[]): Promise<Nflverse> {
  const base = "https://github.com/nflverse/nflverse-data/releases/download";
  const [s, n] = await Promise.all([
    net.fetchText(`${base}/stats_player/stats_player_week_${year}.csv`),
    net.fetchText(`${base}/snap_counts/snap_counts_${year}.csv`),
  ]);
  const nv = buildNflverse(s ? parseCsv(s) : null, n ? parseCsv(n) : null);
  if (!nv.statsOk) notes.push(["UNVERIFIED", "nflverse player stats", "Could not load second source; NFL rows marked single-source until next run."]);
  if (!nv.snapsOk) notes.push(["UNVERIFIED", "nflverse snap counts", "Could not load snap counts; DNP detection and limited-snaps flags paused."]);
  return nv;
}

export async function updateNfl(store: LiveStore, cfg: Settings, watch: WatchEntry[], now = new Date(), net: Net = realNet): Promise<RunResult> {
  const t0 = Date.now();
  const state = store.readState();
  const st = state.NFL;
  const notes: SummaryItem[] = [];
  const yr = SEASONS.NFL.year;
  const raw = store.readNflRaw();
  const byGame: Record<string, NflLogRow[]> = {};
  for (const r of raw) (byGame[r.game_id] ||= []).push(r);
  // retry decisions use the verified log's check status
  const full = fullRefreshDue(st.lastFullRefresh, now);
  const badGames = new Set(store.readNflLogs().filter((r) => r.source === "ESPN" && !isOk(r.check_status) && daysAgo(r.game_date, now) <= RETRY_DAYS).map((r) => r.game_id));

  const nv = await loadNflverse(yr, net, notes);

  const base = `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates=${yr}`;
  const urls: string[] = []; const wk: [number, number][] = [];
  for (let w = 1; w <= 18; w++) { urls.push(`${base}&seasontype=2&week=${w}`); wk.push([2, w]); }
  for (const w of [1, 2, 3, 5]) { urls.push(`${base}&seasontype=3&week=${w}`); wk.push([3, w]); }
  const sb = await net.fetchAll<any>(urls);
  const games: NflGameRef[] = []; const fail: string[] = [];
  sb.forEach((r, i) => {
    if (!r.ok) { fail.push(`${wk[i][0] === 3 ? "post " : "wk "}${wk[i][1]} (HTTP ${r.code})`); return; }
    for (const ev of r.body.events || []) {
      const s = ev.status?.type;
      if (!s || !s.completed || s.name !== "STATUS_FINAL") continue;
      const date = ymdInTz(new Date(ev.date), ET);
      const prior = byGame[ev.id];
      const retry = full || badGames.has(String(ev.id)) || daysAgo(date, now) <= REFRESH_DAYS;
      if (prior && !retry) continue;
      const c: Record<string, any> = {};
      for (const x of ev.competitions?.[0]?.competitors || []) c[x.homeAway] = { id: String(x.team.id), abbr: x.team.abbreviation, score: num(x.score) };
      if (!c.home || !c.away) continue;
      const week = wk[i][0] === 2 ? wk[i][1] : ({ 1: 19, 2: 20, 3: 21, 5: 22 } as Record<number, number>)[wk[i][1]];
      games.push({ id: String(ev.id), date, stype: wk[i][0], week, home: c.home, away: c.away });
    }
  });
  if (fail.length) notes.unshift(["UNVERIFIED", `${fail.length} ESPN scoreboard weeks did not load`, fail.slice(0, 6).join(", ") + " — will retry next run"]);

  const fresh: string[] = [];
  const boxes = await net.fetchBoxes("NFL", games.map((g) => g.id));
  games.forEach((g, j) => {
    const rows = boxes[j] ? parseNflBox(boxes[j], g, now) : null;
    if (!rows) { notes.push(["UNVERIFIED", `${g.away.abbr} @ ${g.home.abbr} ${g.date}`, "Box score not available from ESPN yet; will retry."]); return; }
    byGame[g.id] = rows; fresh.push(g.id);
  });
  if (!fail.length) st.backfillDone = true;
  if (full && !fail.length && fresh.length === games.length) st.lastFullRefresh = now.toISOString();

  // raw ESPN rows are stored untouched; verification + inference is re-derived every run
  const rawAll = Object.values(byGame).flat().sort(logOrder);
  store.writeNflRaw(rawAll);
  const espn = rawAll.map((r) => ({ ...r }));
  verifyNfl(espn, nv);
  const P = nflPlayerMeta(espn);
  const inferred = inferNfl(espn, nv, P, now);
  const res = deriveNfl(espn, inferred, P, cfg, watch); // also sets limited_snaps on these rows
  store.writeNflLogs(espn.concat(inferred).sort(logOrder));
  const items = buildSummary("NFL", res.P, res.hit, res.logRows, cfg, fresh, watch.filter((w) => w.sport === "NFL"), now);
  const msg = `${fresh.length} games processed; nflverse stats ${nv.statsOk ? "loaded" : "NOT loaded"}, snaps ${nv.snapsOk ? "loaded" : "NOT loaded"}; ${Math.round((Date.now() - t0) / 1000)}s`;
  const info: RunInfo = { at: now.toISOString(), ok: !fail.length && nv.statsOk && nv.snapsOk, gamesProcessed: fresh.length, freshIds: fresh, message: msg };
  st.lastRun = info; if (info.ok) st.lastSuccess = info.at;
  store.writeState(state);
  const out: SummaryItem[] = [["RUN", "NFL update", msg], ...items, ...notes];
  saveSummary(store, "NFL", out, now);
  return { items: out, info };
}
