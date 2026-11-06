import { describe, expect, it } from "vitest";
import { evaluateLeg, legState, parseLineNumber, statusLine, summarize, totalSide } from "./grading";
import type { Game, Leg } from "./types";

const game = (away: number | null, home: number | null, status: Game["status"] = "final"): Game => ({
  id: "g1",
  league: "NFL",
  startTime: "2026-11-07T18:00:00Z",
  status,
  statusLabel: "",
  away: { teamId: "A", name: "Away", short: "AWY", score: away },
  home: { teamId: "H", name: "Home", short: "HOM", score: home },
  coverage: "play_by_play",
});

const leg = (p: Partial<Leg>): Leg => ({
  id: "l1",
  league: "NFL",
  betType: "moneyline",
  pick: "Home",
  opponent: "Away",
  line: "",
  price: "",
  gameId: "g1",
  pickTeamId: "H",
  manualResult: null,
  ...p,
});

describe("parsing lines", () => {
  it("reads numbers from spreads and totals", () => {
    expect(parseLineNumber("-3.5")).toBe(-3.5);
    expect(parseLineNumber("+7")).toBe(7);
    expect(parseLineNumber("o48.5")).toBe(48.5);
    expect(parseLineNumber("Under 221")).toBe(221);
    expect(parseLineNumber("PK")).toBe(0);
    expect(parseLineNumber("")).toBeNull();
  });
  it("finds over/under from the line or the pick", () => {
    expect(totalSide({ line: "o48.5", pick: "" })).toBe("over");
    expect(totalSide({ line: "u221.5", pick: "" })).toBe("under");
    expect(totalSide({ line: "48.5", pick: "Over" })).toBe("over");
    expect(totalSide({ line: "48.5", pick: "Under" })).toBe("under");
    expect(totalSide({ line: "48.5", pick: "Chiefs" })).toBeNull();
  });
});

describe("moneyline", () => {
  it("wins, loses, pushes", () => {
    expect(evaluateLeg(leg({}), game(10, 20))).toBe("won");
    expect(evaluateLeg(leg({}), game(20, 10))).toBe("lost");
    expect(evaluateLeg(leg({}), game(17, 17))).toBe("push");
    expect(evaluateLeg(leg({ pickTeamId: "A" }), game(20, 10))).toBe("won");
  });
  it("can't grade when the picked team isn't in the game", () => {
    expect(evaluateLeg(leg({ pickTeamId: "X" }), game(20, 10))).toBeNull();
  });
});

describe("spread", () => {
  it("favorite has to cover", () => {
    const fav = leg({ betType: "spread", line: "-3.5" });
    expect(evaluateLeg(fav, game(20, 24))).toBe("won");
    expect(evaluateLeg(fav, game(20, 23))).toBe("lost");
  });
  it("underdog can lose and still cover", () => {
    const dog = leg({ betType: "spread", line: "+7", pickTeamId: "A" });
    expect(evaluateLeg(dog, game(20, 26))).toBe("won");
    expect(evaluateLeg(dog, game(20, 27))).toBe("push");
    expect(evaluateLeg(dog, game(20, 28))).toBe("lost");
  });
});

describe("total", () => {
  it("over and under", () => {
    expect(evaluateLeg(leg({ betType: "total", pick: "Over", line: "o44.5", pickTeamId: null }), game(21, 24))).toBe("won");
    expect(evaluateLeg(leg({ betType: "total", pick: "Over", line: "o44.5", pickTeamId: null }), game(21, 20))).toBe("lost");
    expect(evaluateLeg(leg({ betType: "total", pick: "Under", line: "u221.5", pickTeamId: null }), game(110, 105))).toBe("won");
    expect(evaluateLeg(leg({ betType: "total", pick: "Over", line: "o45", pickTeamId: null }), game(20, 25))).toBe("push");
  });
});

describe("leg state", () => {
  it("not started before kickoff", () => {
    expect(legState(leg({}), game(null, null, "scheduled"))).toMatchObject({ status: "not_started", result: null });
  });
  it("live shows a trend but no grade", () => {
    expect(legState(leg({}), game(3, 10, "in_progress"))).toMatchObject({ status: "live", result: null, trend: "winning" });
    expect(legState(leg({}), game(14, 10, "halftime"))).toMatchObject({ status: "live", trend: "losing" });
  });
  it("final grades automatically", () => {
    expect(legState(leg({}), game(3, 10))).toMatchObject({ status: "final", result: "won", manual: false });
  });
  it("manual override beats the automatic grade", () => {
    expect(legState(leg({ manualResult: "lost" }), game(3, 10))).toMatchObject({ result: "lost", manual: true });
  });
  it("props need a manual grade when the game ends", () => {
    expect(legState(leg({ betType: "prop", pick: "QB 250+ pass yds" }), game(3, 10))).toMatchObject({
      result: null,
      needsManualGrade: true,
    });
  });
  it("legs without a matched game", () => {
    expect(legState(leg({ gameId: null }), undefined)).toMatchObject({ status: "no_game", result: null });
  });
});

describe("slip summary", () => {
  it("any lost leg loses the slip", () => {
    const s = summarize([
      legState(leg({}), game(3, 10)),
      legState(leg({}), game(30, 10)),
      legState(leg({}), game(0, 0, "in_progress")),
    ]);
    expect(s.verdict).toBe("lost");
  });
  it("all won = won; pushes don't sink it", () => {
    const s = summarize([legState(leg({}), game(3, 10)), legState(leg({}), game(10, 10))]);
    expect(s).toMatchObject({ won: 1, push: 1, verdict: "won" });
  });
  it("still open while legs are pending", () => {
    const s = summarize([legState(leg({}), game(3, 10)), legState(leg({}), game(null, null, "scheduled"))]);
    expect(s.verdict).toBe("open");
  });
  it("writes the status bar sentence", () => {
    const s = summarize([
      legState(leg({}), game(3, 10)),
      legState(leg({}), game(3, 10, "in_progress")),
      legState(leg({}), game(null, null, "scheduled")),
      legState(leg({}), game(null, null, "scheduled")),
    ]);
    expect(statusLine(s)).toBe("1 of 4 legs won, 1 live, 2 not started");
  });
});
