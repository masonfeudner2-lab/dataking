import type { Team } from "@/lib/types";

// Real team names as plain text (allowed). No logos. Ratings are invented and only steer
// the fake scores in the mock feed. Other spellings live in src/lib/matching/aliases.ts.
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
): MockTeam => ({ id, name, short, league, rating, division });

export const MOCK_TEAMS: MockTeam[] = [
  // College football: FCS
  t("cfb-pvamu", "Prairie View A&M", "PVAMU", "NCAAF", 0.45, "FCS"),
  t("cfb-southern", "Southern", "SOU", "NCAAF", 0.5, "FCS"),
  t("cfb-mvsu", "Mississippi Valley State", "MVSU", "NCAAF", 0.2, "FCS"),
  t("cfb-alcorn", "Alcorn State", "ALCN", "NCAAF", 0.45, "FCS"),
  t("cfb-jsu", "Jackson State", "JKST", "NCAAF", 0.65, "FCS"),
  t("cfb-gram", "Grambling State", "GRAM", "NCAAF", 0.4, "FCS"),
  t("cfb-ndsu", "North Dakota State", "NDSU", "NCAAF", 0.85, "FCS"),
  t("cfb-sdsu-jacks", "South Dakota State", "SDST", "NCAAF", 0.85, "FCS"),
  t("cfb-mont", "Montana", "MONT", "NCAAF", 0.7, "FCS"),
  t("cfb-mtst", "Montana State", "MTST", "NCAAF", 0.75, "FCS"),
  // College football: FBS
  t("cfb-okst", "Oklahoma State", "OKST", "NCAAF", 0.5, "FBS"),
  t("cfb-ttu", "Texas Tech", "TTU", "NCAAF", 0.6, "FBS"),
  t("cfb-haw", "Hawai'i", "HAW", "NCAAF", 0.35, "FBS"),
  t("cfb-sdsu", "San Diego State", "SDSU", "NCAAF", 0.4, "FBS"),
  t("cfb-osu", "Ohio State", "OSU", "NCAAF", 0.9, "FBS"),
  t("cfb-psu", "Penn State", "PSU", "NCAAF", 0.82, "FBS"),
  t("cfb-bama", "Alabama", "ALA", "NCAAF", 0.85, "FBS"),
  t("cfb-lsu", "LSU", "LSU", "NCAAF", 0.75, "FBS"),
  t("cfb-ore", "Oregon", "ORE", "NCAAF", 0.88, "FBS"),
  t("cfb-wash", "Washington", "WASH", "NCAAF", 0.65, "FBS"),
  // NFL
  t("nfl-kc", "Kansas City Chiefs", "KC", "NFL", 0.8, undefined),
  t("nfl-buf", "Buffalo Bills", "BUF", "NFL", 0.82, undefined),
  t("nfl-phi", "Philadelphia Eagles", "PHI", "NFL", 0.8, undefined),
  t("nfl-dal", "Dallas Cowboys", "DAL", "NFL", 0.5, undefined),
  t("nfl-det", "Detroit Lions", "DET", "NFL", 0.78, undefined),
  t("nfl-gb", "Green Bay Packers", "GB", "NFL", 0.7, undefined),
  t("nfl-sf", "San Francisco 49ers", "SF", "NFL", 0.7, undefined),
  t("nfl-lar", "Los Angeles Rams", "LAR", "NFL", 0.65, undefined),
  // NBA
  t("nba-lal", "Los Angeles Lakers", "LAL", "NBA", 0.6, undefined),
  t("nba-gsw", "Golden State Warriors", "GSW", "NBA", 0.55, undefined),
  t("nba-bos", "Boston Celtics", "BOS", "NBA", 0.75, undefined),
  t("nba-nyk", "New York Knicks", "NYK", "NBA", 0.7, undefined),
  t("nba-den", "Denver Nuggets", "DEN", "NBA", 0.7, undefined),
  t("nba-okc", "Oklahoma City Thunder", "OKC", "NBA", 0.85, undefined),
  t("nba-mil", "Milwaukee Bucks", "MIL", "NBA", 0.55, undefined),
  t("nba-mia", "Miami Heat", "MIA", "NBA", 0.5, undefined),
  // College basketball
  t("cbb-duke", "Duke", "DUKE", "NCAAB", 0.85, "D1"),
  t("cbb-ku", "Kansas", "KU", "NCAAB", 0.8, "D1"),
  t("cbb-gonz", "Gonzaga", "GONZ", "NCAAB", 0.78, "D1"),
  t("cbb-ucla", "UCLA", "UCLA", "NCAAB", 0.65, "D1"),
  t("cbb-uk", "Kentucky", "UK", "NCAAB", 0.75, "D1"),
  t("cbb-hou", "Houston", "HOU", "NCAAB", 0.82, "D1"),
  t("cbb-pvamu", "Prairie View A&M", "PVAMU", "NCAAB", 0.35, "D1"),
  t("cbb-txso", "Texas Southern", "TXSO", "NCAAB", 0.4, "D1"),
];

export const TEAM_BY_ID = new Map(MOCK_TEAMS.map((x) => [x.id, x]));
