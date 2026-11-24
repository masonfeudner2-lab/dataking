import { describe, expect, it } from "vitest";
import { searchTeams, teamFullName, TEAMS } from "./teams";

const codes = (q: string, sports?: ("NBA" | "NFL")[]) => searchTeams(q, sports).map((h) => `${h.sport}:${h.code}`);

describe("team search", () => {
  it("finds the Warriors however you type it", () => {
    for (const q of ["Warriors", "warr", "Golden State", "golden", "GS", "gsw", "Dubs", "golden state warriors"]) {
      expect(codes(q)[0], q).toBe("NBA:GS");
    }
  });

  it("an exact name beats a partial one", () => {
    // "bucks" is the Bucks; "Buccaneers" only starts with "buc"
    expect(codes("bucks")[0]).toBe("NBA:MIL");
    expect(codes("bucs")[0]).toBe("NFL:TB");
  });

  it("cities with two teams list both", () => {
    expect(codes("new york", ["NFL"])).toEqual(["NFL:NYG", "NFL:NYJ"]);
    expect(codes("los angeles", ["NBA"]).sort()).toEqual(["NBA:LAC", "NBA:LAL"]);
  });

  it("can be limited to one sport", () => {
    expect(codes("hou", ["NFL"])).toEqual(["NFL:HOU"]);
    expect(codes("hou")).toEqual(expect.arrayContaining(["NBA:HOU", "NFL:HOU"]));
  });

  it("needs at least 2 characters and ignores nonsense", () => {
    expect(codes("w")).toEqual([]);
    expect(codes("zzz")).toEqual([]);
  });

  it("has every team the data uses", () => {
    const nba = "ATL BKN BOS CHA CHI CLE DAL DEN DET GS HOU IND LAC LAL MEM MIA MIL MIN NO NY OKC ORL PHI PHX POR SA SAC TOR UTAH WSH".split(" ");
    const nfl = "ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WSH".split(" ");
    expect(TEAMS.NBA.map((x) => x.code).sort()).toEqual(nba.sort());
    expect(TEAMS.NFL.map((x) => x.code).sort()).toEqual(nfl.sort());
    expect(teamFullName("NBA", "GS")).toBe("Golden State Warriors");
    expect(teamFullName("NBA", "XYZ")).toBe("XYZ");
  });
});
