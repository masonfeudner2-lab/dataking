// The update job end to end, with a fake network (ESPN can't be reached from the test machine).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../config";
import { LiveStore } from "./files";
import { updateNba, updateNfl, type Net } from "./update";

const cfg = defaultSettings();
const KEYS = ["minutes", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
  "freeThrowsMade-freeThrowsAttempted", "rebounds", "assists", "points"];
const ath = (id: string, name: string, min: number, pts: number, dnp = false) => dnp
  ? { athlete: { id, displayName: name }, didNotPlay: true, reason: "Rest", stats: [] }
  : { athlete: { id, displayName: name }, stats: [String(min), "5-10", "1-3", "0-0", "4", "3", String(pts)] };
const team = (id: string, abbr: string, athletes: ReturnType<typeof ath>[], pts: number, n: number) => ({
  team: { id, abbreviation: abbr },
  statistics: [{ keys: KEYS, totals: ["", "", `${n}-${3 * n}`, "", String(4 * n), String(3 * n), String(pts)], athletes }],
});
function nbaGame(id: string, date: string, homePts: number, awayPts: number, dnpAway = false) {
  const home = [ath("h1", "Home Star", 34, homePts - 10), ath("h2", "Home Bench", 20, 10)];
  const away = [ath("a1", "Away Star", 36, dnpAway ? awayPts : awayPts - 8, false), ath("a2", "Away Guard", 25, 8, dnpAway)];
  return {
    ev: { id, date: date + "T23:30:00Z", season: { type: 2 }, status: { type: { completed: true, name: "STATUS_FINAL" } },
      competitions: [{ competitors: [{ homeAway: "home", score: String(homePts), team: { id: "1", abbreviation: "BOS" } }, { homeAway: "away", score: String(awayPts), team: { id: "2", abbreviation: "NY" } }] }] },
    box: { boxscore: { players: [team("1", "BOS", home, homePts, 2), team("2", "NY", away, awayPts, dnpAway ? 1 : 2)] } },
  };
}

function fakeNet(games: ReturnType<typeof nbaGame>[], missingBox: string[] = []): Net & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    fetchAll: async (urls) => urls.map((url) => {
      calls.push(url);
      const d = /dates=(\d{8})/.exec(url)?.[1];
      const day = d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : "";
      return { url, ok: true, code: 200, body: { events: games.filter((g) => g.ev.date.startsWith(day)).map((g) => g.ev) } as never };
    }),
    fetchBoxes: async (_s, ids) => ids.map((id) => (missingBox.includes(id) ? null : games.find((g) => g.ev.id === id)?.box ?? null)),
    fetchText: async () => null,
  };
}

describe("NBA update job", () => {
  it("backfills, writes logs + state + summary, then only fetches what's new", async () => {
    const store = new LiveStore(mkdtempSync(join(tmpdir(), "live-")));
    const games = [nbaGame("g1", "2026-10-21", 110, 100), nbaGame("g2", "2026-10-23", 105, 99, true), nbaGame("g3", "2026-10-25", 120, 101)];
    const now = new Date("2026-10-27T13:00:00Z");
    const r = await updateNba(store, cfg, [], now, fakeNet(games));
    expect(r.info.gamesProcessed).toBe(3);
    const logs = store.readNbaLogs();
    expect(logs.filter((x) => x.status === "PLAYED").length).toBe(11);
    expect(logs.find((x) => x.game_id === "g2" && x.player === "Away Guard")?.status).toBe("DNP");
    expect(logs.every((x) => x.status !== "PLAYED" || x.check_status === "OK – matches team totals")).toBe(true);
    expect(store.readState().NBA.scanFrom).toBe("2026-10-25");
    expect(store.readSummaryText()).toContain("NBA update");

    // 2 days later: the last 14 days are re-checked for ESPN corrections
    const r2 = await updateNba(store, cfg, [], new Date("2026-10-29T13:00:00Z"), fakeNet(games));
    expect(r2.info.gamesProcessed).toBe(3);
    // a week after the last full refresh: the whole season is re-checked, even games older than 14 days
    const r3 = await updateNba(store, cfg, [], new Date("2026-11-12T13:00:00Z"), fakeNet(games));
    expect(r3.info.gamesProcessed).toBe(3);
    // 3 days after that full refresh: games older than 14 days aren't re-fetched
    const r4 = await updateNba(store, cfg, [], new Date("2026-11-15T13:00:00Z"), fakeNet(games));
    expect(r4.info.gamesProcessed).toBe(0);
  });

  it("a missing box score is skipped, flagged and retried; existing rows are kept", async () => {
    const store = new LiveStore(mkdtempSync(join(tmpdir(), "live-")));
    const games = [nbaGame("g1", "2026-10-21", 110, 100), nbaGame("g2", "2026-10-23", 105, 99)];
    const r = await updateNba(store, cfg, [], new Date("2026-10-24T13:00:00Z"), fakeNet(games, ["g2"]));
    expect(r.items.some(([s, i]) => s === "UNVERIFIED" && i.includes("2026-10-23"))).toBe(true);
    expect(store.readState().NBA.missing).toEqual(["2026-10-23"]);
    expect(store.readNbaLogs().some((x) => x.game_id === "g2")).toBe(false);
    const r2 = await updateNba(store, cfg, [], new Date("2026-10-25T13:00:00Z"), fakeNet(games));
    expect(r2.info.freshIds).toContain("g2");
    expect(store.readState().NBA.missing).toEqual([]);
  });

  it("a team-total mismatch blanks the stat and keeps retrying the game", async () => {
    const store = new LiveStore(mkdtempSync(join(tmpdir(), "live-")));
    const g = nbaGame("g1", "2026-10-21", 110, 100);
    g.box.boxscore.players[0].statistics[0].totals[4] = "99"; // team rebounds don't add up
    await updateNba(store, cfg, [], new Date("2026-10-22T13:00:00Z"), fakeNet([g]));
    const star = store.readNbaLogs().find((x) => x.player === "Home Star")!;
    expect(star.reb).toBeNull();
    expect(star.check_status).toBe("FAILED – team total mismatch");
    // re-fetched: ESPN's corrected box score now adds up
    const net = fakeNet([nbaGame("g1", "2026-10-21", 110, 100)]);
    const r = await updateNba(store, cfg, [], new Date("2026-10-26T13:00:00Z"), net);
    expect(r.info.freshIds).toEqual(["g1"]);
    expect(store.readNbaLogs().find((x) => x.player === "Home Star")!.reb).toBe(4);
  });
});

describe("NFL update job", () => {
  it("with nflverse unavailable, rows are PENDING single-source and the run is marked not ok", async () => {
    const store = new LiveStore(mkdtempSync(join(tmpdir(), "live-")));
    const ev = { id: "n1", date: "2026-11-15T18:00:00Z", status: { type: { completed: true, name: "STATUS_FINAL" } },
      competitions: [{ competitors: [{ homeAway: "home", score: "20", team: { id: "1", abbreviation: "KC" } }, { homeAway: "away", score: "10", team: { id: "2", abbreviation: "DEN" } }] }] };
    const side = (id: string, abbr: string) => ({ team: { id, abbreviation: abbr }, statistics: [
      { name: "receiving", keys: ["receptions", "receivingYards", "receivingTouchdowns", "receivingTargets"], athletes: [{ athlete: { id: id + "w", displayName: "WR " + abbr, position: { abbreviation: "WR" } }, stats: ["5", "60", "0", "7"] }] }] });
    const net: Net = {
      fetchAll: async (urls) => urls.map((url) => ({ url, ok: true, code: 200, body: { events: /seasontype=2&week=10$/.test(url) ? [ev] : [] } as never })),
      fetchBoxes: async (_s, ids) => ids.map(() => ({ boxscore: { players: [side("1", "KC"), side("2", "DEN")] } })),
      fetchText: async () => null,
    };
    const r = await updateNfl(store, cfg, [], new Date("2026-11-17T18:00:00Z"), net);
    expect(r.info.ok).toBe(false);
    const logs = store.readNflLogs();
    expect(logs.length).toBe(2);
    expect(logs.every((x) => x.check_status === "PENDING – single source (nflverse not posted yet)")).toBe(true);
    expect(logs[0].week).toBe(10);
    expect(store.readNflRaw()[0].rec_yds).toBe(60);
  });
});
