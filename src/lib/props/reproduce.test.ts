// Proves the TypeScript port reproduces the live Sheet's numbers exactly (snapshot of Nov 18, 2026).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { csvObjects, loadNbaLogs, loadNflLogs, loadSettingsCsv } from "./csv";
import { rebuildNba } from "./nba";
import { buildNflverse, rebuildNfl } from "./nfl";
import { parseCsv } from "./csv";
import { HIT_COLS, type HitRow, type PlayerRow } from "./schema";
import { buildSummary } from "./summary";

const DIR = join(__dirname, "../../../data/snapshot-2026-11-18");
const read = (f: string) => readFileSync(join(DIR, f), "utf8");
const cfg = loadSettingsCsv(read("settings.csv"));
const NOW = new Date("2026-11-18T18:45:00Z");

const NUMERIC = new Set(["games", "avg", "median", "limited_games_L10", "L5_pct", "L10_pct", "season_pct", "home_pct", "away_pct"]);
/** Sheets turned the text "3PM" into the time 3:00 PM (exported as 15:00:00). That's a display bug in the Sheet, not data. */
const fixStat = (s: string) => (s === "15:00:00" ? "3PM" : s);

function compareHit(ours: HitRow[], sheet: Record<string, string>[]) {
  const key = (r: { player_key?: string; stat?: string; line?: string }) => `${r.player_key}|${fixStat(r.stat ?? "")}|${r.line}`;
  const want = new Map(sheet.map((r) => [key(r), r]));
  const got = new Map(ours.map((r) => [key(r), r]));
  const missing = [...want.keys()].filter((k) => !got.has(k));
  const extra = [...got.keys()].filter((k) => !want.has(k));
  const diffs: string[] = [];
  for (const [k, w] of want) {
    const g = got.get(k) as unknown as Record<string, unknown> | undefined;
    if (!g) continue;
    for (const c of HIT_COLS) {
      const wv = c === "stat" ? fixStat(w[c]) : w[c];
      const gv = g[c] === null || g[c] === undefined ? "" : g[c];
      const same = NUMERIC.has(c) ? (wv === "" ? gv === "" : Number(wv) === Number(gv)) : String(gv) === wv;
      if (!same) diffs.push(`${k} ${c}: sheet=${wv} ours=${gv}`);
    }
  }
  const orderSame = ours.map(key).join("\n") === sheet.map(key).join("\n");
  return { missing, extra, diffs, orderSame };
}

function comparePlayers(ours: PlayerRow[], sheet: Record<string, string>[]) {
  const want = new Map(sheet.map((r) => [r.player_key, r]));
  const diffs: string[] = [];
  for (const p of ours) {
    const w = want.get(p.player_key);
    if (!w) { diffs.push(`${p.player_key}: not in sheet`); continue; }
    if (w.tracked !== p.tracked) diffs.push(`${p.player_key} tracked: sheet=${w.tracked} ours=${p.tracked}`);
    if (Number(w.games_played) !== p.games_played) diffs.push(`${p.player_key} games: sheet=${w.games_played} ours=${p.games_played}`);
    if (Number(w.avg_minutes_or_snap_pct) !== p.avg_minutes_or_snap_pct) diffs.push(`${p.player_key} avg: sheet=${w.avg_minutes_or_snap_pct} ours=${p.avg_minutes_or_snap_pct}`);
  }
  return diffs;
}

describe("reproduce the Sheet: NBA", () => {
  const all = loadNbaLogs(read("nba_game_logs.csv"));
  const espn = all.filter((r) => r.status !== "NOT_IN_BOX"); // what the Sheet's rebuild reads back
  const sheetLimited = new Map(espn.map((r) => [r.game_id + "|" + r.player_id, r.limited_minutes]));
  const res = rebuildNba(espn.map((r) => ({ ...r })), cfg, [], NOW);

  it("hit-rate rows match NBA Hit Rates exactly", () => {
    const c = compareHit(res.hit, csvObjects(read("nba_hit_rates.csv")));
    expect(c.missing).toEqual([]);
    expect(c.extra).toEqual([]);
    expect(c.diffs.slice(0, 20)).toEqual([]);
    expect(c.orderSame).toBe(true);
  });
  it("limited-minutes flags match", () => {
    const diffs = res.logRows.filter((r) => r.source === "ESPN" && (sheetLimited.get(r.game_id + "|" + r.player_id) || "") !== r.limited_minutes);
    expect(diffs.map((r) => `${r.player} ${r.game_date}`)).toEqual([]);
  });
  it("inferred NOT_IN_BOX rows match", () => {
    const k = (r: { game_id: string; player_id: string }) => r.game_id + "|" + r.player_id;
    const want = all.filter((r) => r.status === "NOT_IN_BOX").map(k).sort();
    const got = res.logRows.filter((r) => r.status === "NOT_IN_BOX").map(k).sort();
    expect(got).toEqual(want);
  });
  it("Players tab matches", () => {
    const sheet = csvObjects(read("players.csv")).filter((r) => r.sport === "NBA");
    expect(comparePlayers(res.players, sheet).slice(0, 20)).toEqual([]);
    expect(res.players.length).toBe(sheet.length);
  });
});

const NV = join(__dirname, "../../../data/nflverse-2026");
const nv = buildNflverse(parseCsv(readFileSync(join(NV, "stats_player_week_2026.csv"), "utf8")),
  parseCsv(readFileSync(join(NV, "snap_counts_2026.csv"), "utf8")));
const nflAll = loadNflLogs(read("nfl_game_logs.csv"));
// The Sheet re-reads only ESPN rows; every inferred row (real 0 / DNP / PENDING) is re-derived from snap counts.
const nflEspn = () => nflAll.filter((r) => r.source === "ESPN").map((r) => ({ ...r, espn_team_check: "" }));
const k = (r: { game_id: string; player_id: string }) => r.game_id + "|" + r.player_id;

describe("reproduce the Sheet: NFL full pipeline, matching exactly as the live Sheet did", () => {
  const res = rebuildNfl(nflEspn(), nv, cfg, [], NOW, { nameMatching: "sheet-live" });

  it("hit-rate rows match NFL Hit Rates exactly", () => {
    const c = compareHit(res.hit, csvObjects(read("nfl_hit_rates.csv")));
    expect(c.missing).toEqual([]);
    expect(c.extra).toEqual([]);
    expect(c.diffs.slice(0, 20)).toEqual([]);
    expect(c.orderSame).toBe(true);
  });
  it("every game log row (status, check, snaps, limited, stats) matches NFL Game Logs", () => {
    const want = new Map(nflAll.map((r) => [k(r), r]));
    const diffs: string[] = [];
    for (const r of res.logRows) {
      const w = want.get(k(r));
      if (!w) { diffs.push(`extra ${r.player} ${r.game_date} ${r.status}`); continue; }
      for (const c of ["status", "dnp_reason", "check_status", "check_note", "off_snaps", "off_snap_pct", "limited_snaps", "position",
        "pass_yds", "pass_td", "rec_yds", "rush_yds", "receptions", "targets", "carries"] as const) {
        if (String(w[c] ?? "") !== String(r[c] ?? "")) diffs.push(`${r.player} ${r.game_date} ${c}: sheet=${w[c]} ours=${r[c]}`);
      }
    }
    expect(diffs.slice(0, 20)).toEqual([]);
    expect(res.logRows.length).toBe(nflAll.length);
  });
  it("Players tab matches", () => {
    const sheet = csvObjects(read("players.csv")).filter((r) => r.sport === "NFL");
    expect(comparePlayers(res.players, sheet).slice(0, 20)).toEqual([]);
    expect(res.players.length).toBe(sheet.length);
  });
});

describe("safe name matching (the app's default) changes only these known-wrong rows", () => {
  const res = rebuildNfl(nflEspn(), nv, cfg, [], NOW);
  const want = new Map(nflAll.map((r) => [k(r), r]));
  const changed = new Set<string>();
  for (const r of res.logRows) {
    const w = want.get(k(r));
    if (!w || w.status !== r.status || w.check_status !== r.check_status || String(w.off_snaps ?? "") !== String(r.off_snaps ?? "")) changed.add(r.player);
  }
  const ours = new Set(res.logRows.map(k));
  for (const r of nflAll) if (!ours.has(k(r))) changed.add(r.player);

  it("only Brian Robinson Jr., Hollywood Brown, Drew Ogletree and Bam Knight change", () => {
    expect([...changed].sort()).toEqual(["Bam Knight", "Brian Robinson Jr.", "Drew Ogletree", "Hollywood Brown"]);
  });
  it("Brian Robinson Jr. is DNP in weeks 7-10 (the Sheet gave him Bijan Robinson's snaps)", () => {
    const rows = res.logRows.filter((r) => r.player === "Brian Robinson Jr." && r.week !== null && r.week >= 7);
    expect(rows.map((r) => r.status)).toEqual(["DNP", "DNP", "DNP", "DNP"]);
  });
  it("Hollywood Brown and Drew Ogletree are cross-checked against nflverse (nicknames)", () => {
    const rows = res.logRows.filter((r) => (r.player === "Hollywood Brown" || r.player === "Drew Ogletree") && r.source === "ESPN");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.check_status === "OK – ESPN & nflverse match")).toBe(true);
  });
  it("no backup inherits a teammate's snaps (Kyle Allen ≠ Josh Allen, Raheim ≠ Shedeur Sanders)", () => {
    const ka = res.logRows.filter((r) => r.player === "Kyle Allen" && r.status === "PLAYED");
    expect(ka.every((r) => (r.off_snaps ?? 0) <= 5)).toBe(true);
    const rs = res.logRows.find((r) => r.player === "Raheim Sanders" && r.week === 9);
    expect(rs?.status).toBe("DNP");
  });
});

describe("reproduce the Sheet: Daily Summary", () => {
  const sheet = csvObjects(read("daily_summary.csv"));
  const run = (t: string, sport: string) => sheet.filter((r) => r.run_time_pt === t && r.sport === sport && r.section !== "RUN")
    .map((r) => [r.section, r.item, r.detail]);

  it("NBA 2026-11-18 05:14 run: every line matches", () => {
    const all = loadNbaLogs(read("nba_game_logs.csv"));
    const res = rebuildNba(all.filter((r) => r.status !== "NOT_IN_BOX"), cfg, [], NOW);
    const fresh = [...new Set(all.filter((r) => r.game_date === "2026-11-17").map((r) => r.game_id))];
    const items = buildSummary("NBA", res.P, res.hit, res.logRows, cfg, fresh, [], new Date("2026-11-18T13:14:00Z"));
    expect(items).toEqual(run("2026-11-18 05:14", "NBA"));
  });
  it("NFL 2026-11-18 10:42 run: league trends and unverified match", () => {
    const res = rebuildNfl(nflEspn(), nv, cfg, [], NOW, { nameMatching: "sheet-live" });
    const items = buildSummary("NFL", res.P, res.hit, res.logRows, cfg, [], [], NOW);
    const pick = (xs: string[][]) => xs.filter((x) => x[0] === "LEAGUE TREND" || x[0] === "UNVERIFIED");
    expect(pick(items)).toEqual(pick(run("2026-11-18 10:42", "NFL")));
  });
});
