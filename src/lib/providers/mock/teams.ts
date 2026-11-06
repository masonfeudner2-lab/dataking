import type { Team } from "@/lib/types";

// Real team names as plain text (allowed). No logos. Ratings are invented and only steer
// the fake scores in the mock feed.
export interface MockTeam extends Team {
  rating: number; // 0 (weak) .. 1 (strong)
}

const t = (
  id: string,
  name: string,
  short: string,
  league: Team["league"],
  rating: number,
  division?: string,
  aliases: string[] = [],
): MockTeam => ({ id, name, short, league, rating, division, aliases });

export const MOCK_TEAMS: MockTeam[] = [
  // College football: FCS
  t("cfb-pvamu", "Prairie View A&M", "PVAMU", "NCAAF", 0.45, "FCS", ["Prairie View", "PV A&M", "Prairie View A&M Panthers"]),
  t("cfb-southern", "Southern", "SOU", "NCAAF", 0.5, "FCS", ["Southern U.", "Southern University", "Southern Jaguars"]),
  t("cfb-mvsu", "Mississippi Valley State", "MVSU", "NCAAF", 0.2, "FCS", ["Miss. Valley St.", "Miss Valley St", "MVSU", "Mississippi Valley St."]),
  t("cfb-alcorn", "Alcorn State", "ALCN", "NCAAF", 0.45, "FCS", ["Alcorn St.", "Alcorn"]),
  t("cfb-jsu", "Jackson State", "JKST", "NCAAF", 0.65, "FCS", ["Jackson St.", "JSU"]),
  t("cfb-gram", "Grambling State", "GRAM", "NCAAF", 0.4, "FCS", ["Grambling", "Grambling St."]),
  t("cfb-ndsu", "North Dakota State", "NDSU", "NCAAF", 0.85, "FCS", ["N. Dakota St.", "North Dakota St.", "NDSU"]),
  t("cfb-sdsu-jacks", "South Dakota State", "SDST", "NCAAF", 0.85, "FCS", ["S. Dakota St.", "South Dakota St."]),
  t("cfb-mont", "Montana", "MONT", "NCAAF", 0.7, "FCS", ["Montana Grizzlies"]),
  t("cfb-mtst", "Montana State", "MTST", "NCAAF", 0.75, "FCS", ["Montana St."]),
  // College football: FBS
  t("cfb-okst", "Oklahoma State", "OKST", "NCAAF", 0.5, "FBS", ["Oklahoma St.", "Okla. St."]),
  t("cfb-ttu", "Texas Tech", "TTU", "NCAAF", 0.6, "FBS", ["Texas Tech Red Raiders"]),
  t("cfb-haw", "Hawai'i", "HAW", "NCAAF", 0.35, "FBS", ["Hawaii", "Hawai`i", "Hawaiʻi"]),
  t("cfb-sdsu", "San Diego State", "SDSU", "NCAAF", 0.4, "FBS", ["San Diego St."]),
  t("cfb-osu", "Ohio State", "OSU", "NCAAF", 0.9, "FBS", ["Ohio St."]),
  t("cfb-psu", "Penn State", "PSU", "NCAAF", 0.82, "FBS", ["Penn St."]),
  t("cfb-bama", "Alabama", "ALA", "NCAAF", 0.85, "FBS", ["Bama"]),
  t("cfb-lsu", "LSU", "LSU", "NCAAF", 0.75, "FBS", ["Louisiana State"]),
  t("cfb-ore", "Oregon", "ORE", "NCAAF", 0.88, "FBS"),
  t("cfb-wash", "Washington", "WASH", "NCAAF", 0.65, "FBS"),
  // NFL
  t("nfl-kc", "Kansas City Chiefs", "KC", "NFL", 0.8, undefined, ["Chiefs", "Kansas City"]),
  t("nfl-buf", "Buffalo Bills", "BUF", "NFL", 0.82, undefined, ["Bills", "Buffalo"]),
  t("nfl-phi", "Philadelphia Eagles", "PHI", "NFL", 0.8, undefined, ["Eagles", "Philadelphia"]),
  t("nfl-dal", "Dallas Cowboys", "DAL", "NFL", 0.5, undefined, ["Cowboys", "Dallas"]),
  t("nfl-det", "Detroit Lions", "DET", "NFL", 0.78, undefined, ["Lions", "Detroit"]),
  t("nfl-gb", "Green Bay Packers", "GB", "NFL", 0.7, undefined, ["Packers", "Green Bay"]),
  t("nfl-sf", "San Francisco 49ers", "SF", "NFL", 0.7, undefined, ["49ers", "Niners", "San Francisco"]),
  t("nfl-lar", "Los Angeles Rams", "LAR", "NFL", 0.65, undefined, ["Rams", "LA Rams"]),
  // NBA
  t("nba-lal", "Los Angeles Lakers", "LAL", "NBA", 0.6, undefined, ["Lakers", "LA Lakers"]),
  t("nba-gsw", "Golden State Warriors", "GSW", "NBA", 0.55, undefined, ["Warriors", "Golden State"]),
  t("nba-bos", "Boston Celtics", "BOS", "NBA", 0.75, undefined, ["Celtics", "Boston"]),
  t("nba-nyk", "New York Knicks", "NYK", "NBA", 0.7, undefined, ["Knicks", "New York"]),
  t("nba-den", "Denver Nuggets", "DEN", "NBA", 0.7, undefined, ["Nuggets", "Denver"]),
  t("nba-okc", "Oklahoma City Thunder", "OKC", "NBA", 0.85, undefined, ["Thunder", "OKC"]),
  t("nba-mil", "Milwaukee Bucks", "MIL", "NBA", 0.55, undefined, ["Bucks", "Milwaukee"]),
  t("nba-mia", "Miami Heat", "MIA", "NBA", 0.5, undefined, ["Heat", "Miami"]),
  // College basketball
  t("cbb-duke", "Duke", "DUKE", "NCAAB", 0.85, "D1", ["Duke Blue Devils"]),
  t("cbb-ku", "Kansas", "KU", "NCAAB", 0.8, "D1", ["Kansas Jayhawks"]),
  t("cbb-gonz", "Gonzaga", "GONZ", "NCAAB", 0.78, "D1", ["Zags"]),
  t("cbb-ucla", "UCLA", "UCLA", "NCAAB", 0.65, "D1"),
  t("cbb-uk", "Kentucky", "UK", "NCAAB", 0.75, "D1", ["Kentucky Wildcats"]),
  t("cbb-hou", "Houston", "HOU", "NCAAB", 0.82, "D1", ["Houston Cougars"]),
  t("cbb-pvamu", "Prairie View A&M", "PVAMU", "NCAAB", 0.35, "D1", ["Prairie View", "PV A&M"]),
  t("cbb-txso", "Texas Southern", "TXSO", "NCAAB", 0.4, "D1", ["Texas Southern", "TSU", "Texas So."]),
];

export const TEAM_BY_ID = new Map(MOCK_TEAMS.map((x) => [x.id, x]));
