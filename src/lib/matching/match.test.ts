import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/mock";
import type { BetType, Game } from "@/lib/types";
import { looksTruncated, matchLeg, normalizeName, splitMatchup, toLeague } from "./match";

let games: Game[] = [];
const slate = async () => (games.length ? games : (games = await new MockProvider().listGames("2026-11-07", { simMinute: 0 })));
const leg = (pick: string, opponent: string | null, league: string, betType: BetType = "moneyline") => ({ pick, opponent, league, betType });

describe("name cleanup", () => {
  it("handles real slip spellings", () => {
    expect(normalizeName("Miss. Valley St.")).toBe("mississippi valley state");
    expect(normalizeName("Hawaiʻi")).toBe(normalizeName("Hawai'i"));
    expect(normalizeName("Hawai`i")).toBe("hawaii");
    expect(normalizeName("Prairie View A&M")).toBe("prairie view a and m");
    expect(normalizeName("N. Dakota St.")).toBe("north dakota state");
    expect(normalizeName("Montana St...")).toBe("montana state");
    expect(normalizeName("St. John's")).toBe("saint johns");
  });
  it("spots cut-off names and splits matchups", () => {
    expect(looksTruncated("Southern ...")).toBe(true);
    expect(looksTruncated("Southern…")).toBe(true);
    expect(looksTruncated("Southern")).toBe(false);
    expect(splitMatchup("Prairie View A&M vs Southern ...")).toEqual(["Prairie View A&M", "Southern ..."]);
    expect(splitMatchup("BUF/KC")).toEqual(["BUF", "KC"]);
    expect(splitMatchup("UCLA @ Gonzaga")).toEqual(["UCLA", "Gonzaga"]);
  });
  it("reads league names", () => {
    expect(toLeague("NCAA Football")).toBe("NCAAF");
    expect(toLeague("FCS")).toBe("NCAAF");
    expect(toLeague("College Basketball")).toBe("NCAAB");
    expect(toLeague("NCAAM")).toBe("NCAAB");
    expect(toLeague("NFL")).toBe("NFL");
    expect(toLeague("")).toBeNull();
  });
});

describe("matching legs to games", () => {
  it("abbreviations and aliases", async () => {
    const g = await slate();
    const r = matchLeg(leg("Miss. Valley St.", "Alcorn St.", "College Football", "spread"), g);
    expect(r).toMatchObject({ gameId: "m-mvsu-alcn", pickTeamId: "cfb-mvsu", confidence: "high" });
    expect(matchLeg(leg("Hawai'i", "San Diego St.", "NCAAF"), g)).toMatchObject({ gameId: "m-sdsu-haw", pickTeamId: "cfb-haw", confidence: "high" });
    expect(matchLeg(leg("Okla. St.", "Texas Tech", "NCAA Football", "spread"), g)).toMatchObject({ pickTeamId: "cfb-okst", confidence: "high" });
    expect(matchLeg(leg("NDSU", "S. Dakota St.", "FCS"), g)).toMatchObject({ pickTeamId: "cfb-ndsu", confidence: "high" });
    expect(matchLeg(leg("Chiefs", "Bills", "NFL", "spread"), g)).toMatchObject({ gameId: "m-buf-kc", pickTeamId: "nfl-kc", confidence: "high" });
  });

  it("fills a cut-off opponent from the schedule when the pick is unique", async () => {
    const r = matchLeg(leg("Prairie View A&M", null, "NCAA Football"), await slate());
    expect(r).toMatchObject({ gameId: "m-pvamu-sou", pickTeamId: "cfb-pvamu", confidence: "high", filledOpponent: "Southern" });
    const r2 = matchLeg(leg("Prairie View A&M", "Southern ...", "NCAA Football"), await slate());
    expect(r2).toMatchObject({ gameId: "m-pvamu-sou", confidence: "high", filledOpponent: "Southern" });
  });

  it("a cut-off pick name still resolves", async () => {
    expect(matchLeg(leg("Montana St...", null, "NCAA Football"), await slate())).toMatchObject({
      gameId: "m-mont-mtst",
      pickTeamId: "cfb-mtst",
      confidence: "high",
    });
  });

  it("never guesses between two games: same school in football and basketball, no league", async () => {
    const r = matchLeg(leg("Prairie View", null, ""), await slate());
    expect(r.gameId).toBeNull();
    expect(r.confidence).toBe("none");
    expect(r.candidates).toEqual(expect.arrayContaining(["m-pvamu-sou", "m-txso-pvamu"]));
  });

  it("totals match on both team names", async () => {
    const g = await slate();
    expect(matchLeg(leg("Over", "BUF/KC", "NFL", "total"), g)).toMatchObject({ gameId: "m-buf-kc", pickTeamId: null, confidence: "high" });
    expect(matchLeg(leg("Under", "UCLA vs Gonzaga", "College Basketball", "total"), g)).toMatchObject({ gameId: "m-ucla-gonz", confidence: "high" });
  });

  it("flags a wrong opponent instead of trusting it", async () => {
    const r = matchLeg(leg("Ohio State", "Michigan", "NCAAF", "spread"), await slate());
    expect(r.confidence).toBe("low");
    expect(r.gameId).toBe("m-psu-osu");
  });

  it("props without a team name ask the user", async () => {
    const r = matchLeg(leg("Jalen Hurts", null, "NFL", "prop"), await slate());
    expect(r).toMatchObject({ gameId: null, confidence: "none" });
  });

  it("unknown teams come back unmatched", async () => {
    expect(matchLeg(leg("Vanderbilt", "Georgia", "NCAAF"), await slate())).toMatchObject({ gameId: null, confidence: "none" });
  });
});
