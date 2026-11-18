// The non-negotiable data rules, one test (or a few) per rule.
import { describe, expect, it } from "vitest";
import { defaultSettings } from "./config";
import { ladderRows } from "./ladder";
import { matchName } from "./names";
import { parseNbaBox, rebuildNba, type GameRef } from "./nba";
import { buildNflverse, parseNflBox, rebuildNfl, verifyNfl, type NflGameRef } from "./nfl";
import type { NbaLogRow, NflLogRow } from "./schema";
import { normName, splitPair } from "./util";

const cfg = defaultSettings();

// ---------------------------------------------------------------- fixtures
const NBA_KEYS = ["minutes", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
  "freeThrowsMade-freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds", "rebounds", "assists", "steals", "blocks",
  "turnovers", "fouls", "plusMinus", "points"];
type P = { id: string; name: string; min: number; pts: number; reb: number; ast: number; f3: string; dnp?: boolean; reason?: string; ejected?: boolean };
const stat = (p: P, keys = NBA_KEYS) => keys.map((k) => ({
  minutes: String(p.min), "fieldGoalsMade-fieldGoalsAttempted": "5-10", "threePointFieldGoalsMade-threePointFieldGoalsAttempted": p.f3,
  "freeThrowsMade-freeThrowsAttempted": "0-0", offensiveRebounds: "0", defensiveRebounds: String(p.reb), rebounds: String(p.reb),
  assists: String(p.ast), steals: "0", blocks: "0", turnovers: "0", fouls: "0", plusMinus: "+3", points: String(p.pts),
}[k] as string));
function nbaTeam(id: string, abbr: string, ps: P[], totals: { pts?: number; reb?: number; ast?: number; f3m?: number } = {}, keys = NBA_KEYS) {
  const sum = (f: (p: P) => number) => ps.filter((p) => !p.dnp).reduce((a, p) => a + f(p), 0);
  const t = { pts: totals.pts ?? sum((p) => p.pts), reb: totals.reb ?? sum((p) => p.reb), ast: totals.ast ?? sum((p) => p.ast),
    f3m: totals.f3m ?? sum((p) => Number(p.f3.split("-")[0])) };
  const totRow = keys.map((k) => ({ points: String(t.pts), rebounds: String(t.reb), assists: String(t.ast),
    "threePointFieldGoalsMade-threePointFieldGoalsAttempted": `${t.f3m}-20` } as Record<string, string>)[k] ?? "");
  return {
    team: { id, abbreviation: abbr },
    statistics: [{ keys, totals: totRow, athletes: ps.map((p) => p.dnp
      ? { athlete: { id: p.id, displayName: p.name }, didNotPlay: true, reason: p.reason, stats: [] }
      : { athlete: { id: p.id, displayName: p.name }, starter: true, ejected: !!p.ejected, stats: stat(p, keys) }) }],
  };
}
const game = (id: string, date: string, homeScore: number, awayScore: number): GameRef => ({
  id, date, stype: 2, home: { id: "1", abbr: "BOS", score: homeScore }, away: { id: "2", abbr: "NY", score: awayScore } });

const nbaRow = (over: Partial<NbaLogRow>): NbaLogRow => ({
  game_id: "g", game_date: "2026-11-01", season: "2026-27", season_type: "Regular", player_id: "p1", player: "Test Player",
  team: "BOS", opponent: "NY", home_away: "H", team_result: "W", status: "PLAYED", dnp_reason: "", starter: "Y",
  minutes: 30, pts: 20, reb: 5, ast: 5, fg3m: 2, fg3a: 5, fgm: 8, fga: 15, ftm: 2, fta: 2, oreb: 1, dreb: 4, stl: 1, blk: 0,
  tov: 2, pf: 2, plus_minus: 5, ejected: "", limited_minutes: "", check_status: "OK – matches team totals", check_note: "",
  source: "ESPN", updated_utc: "", ...over,
});

// ---------------------------------------------------------------- Rule 1: never guess; blank is excluded, not 0
describe("rule 1: unverified stats are blank (null) and excluded, never filled in", () => {
  it("a blank stat is skipped for that stat's hit rate, not counted as 0", () => {
    const games = [nbaRow({ game_id: "a", game_date: "2026-11-03", pts: 25 }), nbaRow({ game_id: "b", game_date: "2026-11-02", pts: null }),
      nbaRow({ game_id: "c", game_date: "2026-11-01", pts: 10 })];
    const L = cfg.ladders.NBA.find((l) => l.stat === "PTS")!;
    const r20 = ladderRows({ name: "T", team: "BOS", games, watch: [] }, "k", "NBA", "", L, "limited_minutes").find((h) => h._line === 20)!;
    expect(r20.games).toBe(2);
    expect(r20.Season).toBe("1/2 – 50%");
    expect(r20.last10_values_newest_first).toBe("25, 10");
  });
  it("box score with a changed format (missing 'points' key) is refused, not guessed", () => {
    const keys = NBA_KEYS.filter((k) => k !== "points");
    const body = { boxscore: { players: [nbaTeam("1", "BOS", [], {}, keys), nbaTeam("2", "NY", [], {}, keys)] } };
    expect(parseNbaBox(body, game("x", "2026-11-01", 0, 0))).toBeNull();
  });
});

// ---------------------------------------------------------------- Rule 2: DNP is not a miss
describe("rule 2: DNP / inactive / not in box score is logged but never counted", () => {
  const rows: NbaLogRow[] = [
    nbaRow({ game_id: "a", game_date: "2026-11-03", pts: 30 }),
    nbaRow({ game_id: "b", game_date: "2026-11-02", status: "DNP", dnp_reason: "Coach's decision", minutes: null, pts: null }),
    nbaRow({ game_id: "c", game_date: "2026-11-01", pts: 28 }),
    nbaRow({ game_id: "d", game_date: "2026-10-30", pts: 26 }),
    // a teammate's game where Test Player is absent from the box entirely
    nbaRow({ game_id: "e", game_date: "2026-11-04", player_id: "p2", player: "Mate", pts: 10 }),
  ];
  const res = rebuildNba(rows, cfg, []);
  it("DNP game is excluded from every window", () => {
    const h = res.hit.find((x) => x.player === "Test Player" && x.stat === "PTS" && x._line === 25)!;
    expect(h.games).toBe(3);
    expect(h.Season).toBe("3/3 – 100%");
    expect(h.streak).toBe("Hit 3");
  });
  it("a team game he's missing from becomes a NOT_IN_BOX row, shown in the log but not counted", () => {
    const nib = res.logRows.filter((r) => r.player === "Test Player" && r.status === "NOT_IN_BOX");
    expect(nib.map((r) => r.game_id)).toEqual(["e"]);
    expect(nib[0].check_status).toBe("OK (not counted)");
  });
  it("DNP reason from ESPN is kept", () => {
    const body = { boxscore: { players: [
      nbaTeam("1", "BOS", [{ id: "1", name: "A", min: 30, pts: 10, reb: 2, ast: 2, f3: "1-3" }, { id: "9", name: "Hurt Guy", min: 0, pts: 0, reb: 0, ast: 0, f3: "0-0", dnp: true, reason: "Left knee soreness" }]),
      nbaTeam("2", "NY", [{ id: "2", name: "B", min: 30, pts: 8, reb: 2, ast: 2, f3: "0-1" }])] } };
    const out = parseNbaBox(body, game("x", "2026-11-01", 10, 8))!;
    const dnp = out.find((r) => r.player === "Hurt Guy")!;
    expect(dnp.status).toBe("DNP");
    expect(dnp.dnp_reason).toBe("Left knee soreness");
    expect(dnp.pts).toBeNull();
  });
});

// ---------------------------------------------------------------- Rule 3: limited games flagged but counted
describe("rule 3: limited games are flagged (>35% below season avg, or ejected) but still counted", () => {
  const rows = [30, 30, 30, 19, 20].map((m, i) => nbaRow({ game_id: "g" + i, game_date: `2026-11-0${i + 1}`, minutes: m, pts: 20 }));
  rows.push(nbaRow({ game_id: "g9", game_date: "2026-11-09", minutes: 28, pts: 20, ejected: "Y" }));
  const res = rebuildNba(rows, cfg, []);
  const flag = (id: string) => res.logRows.find((r) => r.game_id === id)!.limited_minutes;
  it("avg 26.2 min → threshold 17.03: 19 and 20 are not limited; ejected game is", () => {
    expect(flag("g3")).toBe("");
    expect(flag("g4")).toBe("");
    expect(flag("g9")).toBe("Y");
  });
  it("a game more than 35% below average is flagged", () => {
    const r2 = [30, 30, 30, 10].map((m, i) => nbaRow({ game_id: "h" + i, game_date: `2026-11-0${i + 1}`, minutes: m }));
    const out = rebuildNba(r2, cfg, []);
    expect(out.logRows.find((r) => r.game_id === "h3")!.limited_minutes).toBe("Y");
    const h = out.hit.find((x) => x.stat === "PTS" && x._line === 20)!;
    expect(h.games).toBe(4); // still counted
    expect(h.limited_games_L10).toBe(1);
  });
});

// ---------------------------------------------------------------- Rule 4: NFL zero-stat & PENDING
const nflRow = (over: Partial<NflLogRow>): NflLogRow => ({
  game_id: "n1", game_date: "2026-11-02", season: "2026", season_type: "Regular", week: 9, player_id: "w1", player: "Wide Out",
  position: "WR", team: "KC", opponent: "DEN", home_away: "H", team_result: "W", status: "PLAYED", dnp_reason: "",
  pass_cmp: 0, pass_att: 0, pass_yds: 0, pass_td: 0, pass_int: 0, carries: 0, rush_yds: 0, rush_td: 0, receptions: 4, targets: 6,
  rec_yds: 50, rec_td: 0, off_snaps: null, off_snap_pct: null, limited_snaps: "", check_status: "", check_note: "", source: "ESPN",
  updated_utc: "", espn_team_check: "", ...over,
});
const nvStatsHeader = ["player_id", "player_display_name", "position", "week", "team", "completions", "attempts", "passing_yards",
  "passing_tds", "carries", "rushing_yards", "receptions", "targets", "receiving_yards"];
const nvStat = (name: string, week: number, team: string, o: Partial<Record<string, number>> = {}) => [
  "00-1", name, "WR", String(week), team, "0", "0", "0", "0", String(o.carries ?? 0), String(o.rushing_yards ?? 0),
  String(o.receptions ?? 4), String(o.targets ?? 6), String(o.receiving_yards ?? 50)];
const snapHeader = ["week", "player", "position", "team", "offense_snaps", "offense_pct"];

describe("rule 4: NFL zero-stat games and PENDING", () => {
  const espn = () => [nflRow({ game_id: "n1", week: 8, game_date: "2026-10-26" }),
    nflRow({ game_id: "n2", week: 9, game_date: "2026-11-02", player_id: "x", player: "Teammate" }),
    nflRow({ game_id: "n3", week: 10, game_date: "2026-11-09", player_id: "x", player: "Teammate" })];
  it("on the field per snap counts but no stats = a real 0 (counted)", () => {
    const nv = buildNflverse([nvStatsHeader, nvStat("Wide Out", 8, "KC"), nvStat("Teammate", 9, "KC"), nvStat("Teammate", 10, "KC")],
      [snapHeader, ["8", "Wide Out", "WR", "KC", "40", "0.7"], ["9", "Wide Out", "WR", "KC", "30", "0.5"], ["9", "Teammate", "WR", "KC", "50", "0.8"],
        ["10", "Teammate", "WR", "KC", "50", "0.8"]]);
    const res = rebuildNfl(espn(), nv, cfg, []);
    const w9 = res.logRows.find((r) => r.player === "Wide Out" && r.week === 9)!;
    expect(w9.status).toBe("PLAYED");
    expect(w9.receptions).toBe(0);
    expect(w9.check_status).toBe("OK – played (snap count), no stats in box score");
    const w10 = res.logRows.find((r) => r.player === "Wide Out" && r.week === 10)!;
    expect(w10.status).toBe("DNP"); // snaps posted for that week, he's not in them
    const h = res.hit.find((x) => x.player === "Wide Out" && x.stat === "REC" && x._line === 2)!;
    expect(h.Season).toBe("1/2 – 50%");
  });
  it("snap counts not posted yet → PENDING, excluded until confirmed", () => {
    const nv = buildNflverse([nvStatsHeader, nvStat("Wide Out", 8, "KC")], [snapHeader, ["8", "Wide Out", "WR", "KC", "40", "0.7"]]);
    const res = rebuildNfl(espn(), nv, cfg, []);
    const w9 = res.logRows.find((r) => r.player === "Wide Out" && r.week === 9)!;
    expect(w9.status).toBe("PENDING");
    expect(w9.check_status).toBe("PENDING – snap counts not posted");
    const h = res.hit.find((x) => x.player === "Wide Out" && x.stat === "REC" && x._line === 2)!;
    expect(h.games).toBe(1);
  });
  it("ESPN row with no nflverse week yet → PENDING single source (counted, flagged unverified)", () => {
    const rows = [nflRow({})];
    verifyNfl(rows, buildNflverse(null, null));
    expect(rows[0].check_status).toBe("PENDING – single source (nflverse not posted yet)");
    expect(rows[0].rec_yds).toBe(50);
  });
});

// ---------------------------------------------------------------- Rule 5: cross-checks
describe("rule 5: NBA team-total cross-check", () => {
  const ps: P[] = [{ id: "1", name: "A", min: 30, pts: 20, reb: 5, ast: 3, f3: "2-5" }, { id: "2", name: "B", min: 25, pts: 10, reb: 4, ast: 6, f3: "1-4" }];
  const opp: P[] = [{ id: "3", name: "C", min: 30, pts: 28, reb: 9, ast: 9, f3: "4-8" }];
  it("sums match totals and final score → OK", () => {
    const out = parseNbaBox({ boxscore: { players: [nbaTeam("1", "BOS", ps), nbaTeam("2", "NY", opp)] } }, game("x", "2026-11-01", 30, 28))!;
    expect(out.every((r) => r.check_status === "OK – matches team totals")).toBe(true);
    expect(out.find((r) => r.player === "A")!.fg3m).toBe(2);
  });
  it("rebounds don't add up → REB blanked for that team, other stats kept, marked FAILED (retried)", () => {
    const out = parseNbaBox({ boxscore: { players: [nbaTeam("1", "BOS", ps, { reb: 10 }), nbaTeam("2", "NY", opp)] } }, game("x", "2026-11-01", 30, 28))!;
    const a = out.find((r) => r.player === "A")!;
    expect(a.reb).toBeNull();
    expect(a.pts).toBe(20);
    expect(a.check_status).toBe("FAILED – team total mismatch");
    expect(a.check_note).toContain("reb: players sum 9 vs team 10");
    expect(out.find((r) => r.player === "C")!.check_status).toBe("OK – matches team totals");
  });
  it("points must equal the FINAL SCORE (not just the box total)", () => {
    const out = parseNbaBox({ boxscore: { players: [nbaTeam("1", "BOS", ps), nbaTeam("2", "NY", opp)] } }, game("x", "2026-11-01", 31, 28))!;
    expect(out.find((r) => r.player === "A")!.pts).toBeNull();
  });
  it("parses by key name, not column position", () => {
    const shuffled = [...NBA_KEYS].reverse();
    const out = parseNbaBox({ boxscore: { players: [nbaTeam("1", "BOS", ps, {}, shuffled), nbaTeam("2", "NY", opp, {}, shuffled)] } }, game("x", "2026-11-01", 30, 28))!;
    const b = out.find((r) => r.player === "B")!;
    expect([b.pts, b.reb, b.ast, b.fg3m, b.fg3a, b.fgm, b.fga]).toEqual([10, 4, 6, 1, 4, 5, 10]);
  });
});

describe("rule 5: NFL nflverse cross-check", () => {
  const nv = (o: Partial<Record<string, number>>) => buildNflverse([nvStatsHeader, nvStat("Wide Out", 9, "KC", o)], null);
  it("all five key stats match → OK", () => {
    const rows = [nflRow({})]; verifyNfl(rows, nv({}));
    expect(rows[0].check_status).toBe("OK – ESPN & nflverse match");
  });
  it("receiving yards mismatch → rec_yds blanked, others kept", () => {
    const rows = [nflRow({})]; verifyNfl(rows, nv({ receiving_yards: 52 }));
    expect(rows[0].rec_yds).toBeNull();
    expect(rows[0].receptions).toBe(4);
    expect(rows[0].check_status).toBe("MISMATCH – blanked");
    expect(rows[0].check_note).toContain("rec_yds: ESPN 50 vs nflverse 52");
  });
  it("targets-only mismatch is noted but blanks nothing", () => {
    const rows = [nflRow({})]; verifyNfl(rows, nv({ targets: 7 }));
    expect(rows[0].check_status).toBe("OK – minor mismatch (carries/targets/att only)");
    expect(rows[0].rec_yds).toBe(50);
    expect(rows[0].targets).toBe(6);
  });
  it("team passing ≠ receiving yards is a note only", () => {
    const g: NflGameRef = { id: "n", date: "2026-11-02", stype: 2, week: 9, home: { id: "1", abbr: "KC", score: 20 }, away: { id: "2", abbr: "DEN", score: 10 } };
    const team = (id: string, abbr: string, recYds: string) => ({ team: { id, abbreviation: abbr }, statistics: [
      { name: "passing", keys: ["completions/passingAttempts", "passingYards", "passingTouchdowns", "interceptions"], athletes: [{ athlete: { id: id + "q", displayName: "QB " + abbr, position: { abbreviation: "QB" } }, stats: ["16/26", "200", "1", "0"] }] },
      { name: "receiving", keys: ["receptions", "receivingYards", "receivingTouchdowns", "receivingTargets"], athletes: [{ athlete: { id: id + "w", displayName: "WR " + abbr }, stats: ["5", recYds, "1", "8"] }] }] });
    const out = parseNflBox({ boxscore: { players: [team("1", "KC", "190"), team("2", "DEN", "200")] } }, g)!;
    const qb = out.find((r) => r.player === "QB KC")!;
    expect([qb.pass_cmp, qb.pass_att, qb.pass_yds]).toEqual([16, 26, 200]);
    expect(qb.espn_team_check).toContain("≠ receiving yds (190)");
    expect(out.find((r) => r.player === "WR DEN")!.espn_team_check).toBe("");
  });
});

// ---------------------------------------------------------------- Rule 7: name matching
describe("rule 7: name matching", () => {
  const L = (...ns: [string, string?][]) => ns.map(([name, position]) => ({ name, position }));
  it("normalizes accents, punctuation and suffixes", () => {
    expect(normName("Luka Dončić")).toBe("luka doncic");
    expect(normName("Brian Robinson Jr.")).toBe("brian robinson");
    expect(normName("A.J. Brown")).toBe("aj brown");
    expect(normName("Marvin Harrison III")).toBe("marvin harrison");
    expect(normName("Amon-Ra St. Brown")).toBe("amon ra st brown");
    expect(matchName(L(["Luka Doncic"]), "Luka Dončić")?.name).toBe("Luka Doncic");
  });
  it("falls back to first initial + last name", () => {
    expect(matchName(L(["Kenneth Gainwell", "RB"]), "Kenny Gainwell", { position: "RB" })?.name).toBe("Kenneth Gainwell");
  });
  it("falls back to a unique last name on the team (nicknames)", () => {
    expect(matchName(L(["Marquise Brown", "WR"], ["Jalen Hurts", "QB"]), "Hollywood Brown", { position: "WR" })?.name).toBe("Marquise Brown");
    expect(matchName(L(["Andrew Ogletree", "TE"]), "Drew Ogletree", { position: "TE" })?.name).toBe("Andrew Ogletree");
  });
  it("never matches ambiguously", () => {
    expect(matchName(L(["Josh Allen"], ["Jordan Allen"]), "Kyle Allen")).toBeNull();
    expect(matchName(L(["Jalen Brown"], ["Jaylen Brown"]), "J. Brown")).toBeNull();
  });
  it("won't use a fallback when another roster player has that name (backup sat out)", () => {
    expect(matchName(L(["Josh Allen", "QB"]), "Kyle Allen", { roster: ["kyle allen", "josh allen"], position: "QB" })).toBeNull();
    expect(matchName(L(["Bijan Robinson", "RB"]), "Brian Robinson Jr.", { roster: ["brian robinson", "bijan robinson"], position: "RB" })).toBeNull();
  });
  it("won't match across position groups (WR ≠ offensive lineman)", () => {
    expect(matchName(L(["Max Mitchell", "OL"]), "Adonai Mitchell", { position: "WR" })).toBeNull();
    expect(matchName(L(["Trey Smith", "G"]), "Brashard Smith", { position: "RB" })).toBeNull();
  });
  it("splits ESPN pairs", () => {
    expect(splitPair("5-10", "-")).toEqual([5, 10]);
    expect(splitPair("16/26", "/")).toEqual([16, 26]);
    expect(splitPair("--", "-")).toEqual([null, null]);
  });
});

// ---------------------------------------------------------------- ladders incl. the 15-yard lines
describe("ladders", () => {
  it("default NFL yardage ladders include 15", () => {
    for (const s of ["REC_YDS", "RUSH_YDS"]) expect(cfg.ladders.NFL.find((l) => l.stat === s)!.lines.slice(0, 4)).toEqual([10, 15, 20, 30]);
  });
  it("exactly 15 yards hits 15+ (at or above), 14 doesn't", () => {
    const L = cfg.ladders.NFL.find((l) => l.stat === "RUSH_YDS")!;
    const games = [nflRow({ game_id: "a", game_date: "2026-11-02", rush_yds: 15 }), nflRow({ game_id: "b", game_date: "2026-11-01", rush_yds: 14 })];
    const r15 = ladderRows({ name: "T", team: "KC", games, watch: [] }, "k", "NFL", "RB", L, "limited_snaps").find((h) => h._line === 15)!;
    expect(r15.Season).toBe("1/2 – 50%");
    expect(r15.line).toBe("15+");
  });
  it("L5/L10/home/away/streak/median/avg", () => {
    const L = cfg.ladders.NBA.find((l) => l.stat === "PTS")!;
    const pts = [31, 22, 25, 18, 40, 9, 26, 30, 12, 20, 33]; // newest first
    const games = pts.map((p, i) => nbaRow({ game_id: "g" + i, game_date: `2026-11-${String(30 - i).padStart(2, "0")}`, pts: p, home_away: i % 2 ? "A" : "H" }));
    const r = ladderRows({ name: "T", team: "BOS", games, watch: [] }, "k", "NBA", "", L, "limited_minutes").find((h) => h._line === 25)!;
    expect(r.L5).toBe("3/5 – 60%");
    expect(r.L10).toBe("5/10 – 50%");
    expect(r.Season).toBe("6/11 – 55%");
    expect(r.Home).toBe("5/6 – 83%"); // 31,25,40,26,12,33
    expect(r.Away).toBe("1/5 – 20%"); // 22,18,9,30,20
    expect(r.streak).toBe("Hit 1");
    expect(r.median).toBe(25);
    expect(r.avg).toBe(24.2);
    expect(r.last10_values_newest_first).toBe("31, 22, 25, 18, 40, 9, 26, 30, 12, 20");
    expect(r.season_pct).toBe(54.5);
  });
});
