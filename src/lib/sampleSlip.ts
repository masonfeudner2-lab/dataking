import type { Leg, Slip } from "@/lib/types";

// An 18-leg cross-sport sample that matches the mock slate. In Phase B, legs like these
// come from reading a screenshot; here they're already matched to games.
type L = Omit<Leg, "id" | "manualResult" | "opponent"> & { opponent?: string | null };

const legs: L[] = [
  { league: "NCAAF", betType: "moneyline", pick: "Southern", opponent: "Prairie View A&M", line: "", price: "78%", gameId: "m-pvamu-sou", pickTeamId: "cfb-southern" },
  { league: "NCAAF", betType: "moneyline", pick: "Alcorn St.", opponent: "Miss. Valley St.", line: "", price: "69%", gameId: "m-mvsu-alcn", pickTeamId: "cfb-alcorn" },
  { league: "NCAAF", betType: "spread", pick: "Texas Tech", opponent: "Oklahoma State", line: "-6.5", price: "-110", gameId: "m-okst-ttu", pickTeamId: "cfb-ttu" },
  { league: "NFL", betType: "spread", pick: "Kansas City Chiefs", opponent: "Buffalo Bills", line: "-2.5", price: "-115", gameId: "m-buf-kc", pickTeamId: "nfl-kc" },
  { league: "NFL", betType: "total", pick: "Over", opponent: "Bills vs Chiefs", line: "o47.5", price: "-110", gameId: "m-buf-kc", pickTeamId: null },
  { league: "NCAAF", betType: "spread", pick: "Ohio State", opponent: "Penn State", line: "-6.5", price: "-110", gameId: "m-psu-osu", pickTeamId: "cfb-osu" },
  { league: "NFL", betType: "moneyline", pick: "Philadelphia Eagles", opponent: "Dallas Cowboys", line: "", price: "74%", gameId: "m-dal-phi", pickTeamId: "nfl-phi" },
  { league: "NFL", betType: "prop", pick: "Jalen Hurts", opponent: null, line: "40+ rush yds", price: "+120", gameId: "m-dal-phi", pickTeamId: null },
  { league: "NCAAF", betType: "moneyline", pick: "North Dakota State", opponent: "South Dakota State", line: "", price: "52%", gameId: "m-ndsu-sdst", pickTeamId: "cfb-ndsu" },
  { league: "NBA", betType: "moneyline", pick: "Los Angeles Lakers", opponent: "Golden State Warriors", line: "", price: "61%", gameId: "m-gsw-lal", pickTeamId: "nba-lal" },
  { league: "NBA", betType: "spread", pick: "Boston Celtics", opponent: "New York Knicks", line: "-4.5", price: "-110", gameId: "m-nyk-bos", pickTeamId: "nba-bos" },
  { league: "NCAAB", betType: "moneyline", pick: "Duke", opponent: "Kansas", line: "", price: "58%", gameId: "m-ku-duke", pickTeamId: "cbb-duke" },
  { league: "NCAAB", betType: "total", pick: "Under", opponent: "UCLA vs Gonzaga", line: "u152.5", price: "-110", gameId: "m-ucla-gonz", pickTeamId: null },
  { league: "NCAAF", betType: "moneyline", pick: "Alabama", opponent: "LSU", line: "", price: "69%", gameId: "m-lsu-bama", pickTeamId: "cfb-bama" },
  { league: "NCAAB", betType: "spread", pick: "Texas Southern", opponent: "Prairie View A&M", line: "+3.5", price: "-110", gameId: "m-txso-pvamu", pickTeamId: "cbb-txso" },
  { league: "NCAAF", betType: "spread", pick: "Oregon", opponent: "Washington", line: "-7.5", price: "-110", gameId: "m-wash-ore", pickTeamId: "cfb-ore" },
  { league: "NCAAB", betType: "moneyline", pick: "Houston", opponent: "Kentucky", line: "", price: "55%", gameId: "m-hou-uk", pickTeamId: "cbb-hou" },
  { league: "NFL", betType: "moneyline", pick: "San Francisco 49ers", opponent: "Los Angeles Rams", line: "", price: "63%", gameId: "m-lar-sf", pickTeamId: "nfl-sf" },
];

export function makeSampleSlip(): Slip {
  return {
    id: "sample",
    source: "Sample slip",
    createdAt: new Date().toISOString(),
    legs: legs.map((l, i) => ({ opponent: null, ...l, id: `leg-${i + 1}`, manualResult: null })),
  };
}
