import { describe, expect, it } from "vitest";
import { MockProvider, MOCK_SLATE } from "./index";
import { momentAt } from "./sim";

const p = new MockProvider();

describe("mock provider", () => {
  it("gives a mix of final, live and upcoming games at the default demo time", async () => {
    const games = await p.listGames("2026-11-07", { simMinute: 280 });
    expect(games).toHaveLength(MOCK_SLATE.length);
    const by = (s: string) => games.filter((g) => g.status === s).length;
    expect(by("final")).toBeGreaterThan(2);
    expect(by("in_progress") + by("halftime")).toBeGreaterThan(5);
    expect(by("scheduled")).toBeGreaterThan(2);
  });

  it("is repeatable: same time, same scores", async () => {
    const a = await p.listGames("2026-11-07", { simMinute: 300 });
    const b = await p.listGames("2026-11-07", { simMinute: 300 });
    expect(a).toEqual(b);
  });

  it("scores only go up as time passes, and finals never end tied", async () => {
    let prev = await p.listGames("2026-11-07", { simMinute: 0 });
    for (let m = 10; m <= 700; m += 10) {
      const now = await p.listGames("2026-11-07", { simMinute: m });
      now.forEach((g, i) => {
        expect(g.away.score ?? 0).toBeGreaterThanOrEqual(prev[i].away.score ?? 0);
        expect(g.home.score ?? 0).toBeGreaterThanOrEqual(prev[i].home.score ?? 0);
      });
      prev = now;
    }
    for (const g of prev) {
      expect(g.status).toBe("final");
      expect(g.away.score).not.toBe(g.home.score);
    }
  });

  it("scores look like the sport", async () => {
    const games = await p.listGames("2026-11-07", { simMinute: 2000 });
    for (const g of games) {
      const total = (g.away.score ?? 0) + (g.home.score ?? 0);
      if (g.league === "NBA") expect(total).toBeGreaterThan(150);
      if (g.league === "NCAAB") expect(total).toBeGreaterThan(90);
      if (g.league === "NFL" || g.league === "NCAAF") expect(total).toBeLessThan(120);
    }
  });

  it("FCS games are score-only; others have play-by-play", async () => {
    expect(await p.getPlays("m-pvamu-sou", { simMinute: 300 })).toBeNull();
    const plays = await p.getPlays("m-psu-osu", { simMinute: 300 });
    expect(plays && plays.length).toBeGreaterThan(3);
  });

  it("walks through quarters and halftime", () => {
    expect(momentAt("NFL", -5).status).toBe("scheduled");
    expect(momentAt("NFL", 10).status).toBe("in_progress");
    expect(momentAt("NFL", 100).status).toBe("halftime");
    expect(momentAt("NFL", 209).status).toBe("in_progress");
    expect(momentAt("NFL", 211).status).toBe("final");
  });
});
