import { describe, expect, it } from "vitest";
import { legLabel, pickName } from "./format";
import type { Game, Leg } from "./types";

const game = {
  id: "g",
  league: "NCAAF",
  startTime: "",
  status: "final",
  statusLabel: "Final",
  away: { teamId: "pv", name: "Prairie View A&M", short: "PVAMU", score: 24 },
  home: { teamId: "sou", name: "Southern", short: "SOU", score: 27 },
  coverage: "score_only",
} as Game;
const leg = (p: Partial<Leg>): Leg => ({
  id: "l", league: "NCAAF", betType: "moneyline", pick: "Prairie View", opponent: null, line: "",
  price: "", gameId: "g", pickTeamId: "pv", manualResult: null, ...p,
});

describe("leg labels", () => {
  it("use the schedule's team name once matched, not the slip's shorthand", () => {
    expect(legLabel(leg({}), game)).toBe("Prairie View A&M to win");
    expect(legLabel(leg({ betType: "spread", line: "+3.5" }), game)).toBe("Prairie View A&M +3.5");
    expect(pickName(leg({}), game)).toBe("Prairie View A&M");
  });
  it("fall back to the slip's words when there's no match", () => {
    expect(legLabel(leg({ pickTeamId: null }), game)).toBe("Prairie View to win");
    expect(legLabel(leg({}))).toBe("Prairie View to win");
  });
});
