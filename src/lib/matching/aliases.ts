import type { League } from "@/lib/types";

// Other ways team names show up on bet slips, keyed by the name the score feed uses.
// The matcher already handles case, punctuation, accents/ʻokina ("Hawaiʻi"), "St." → "State",
// "Miss." → "Mississippi", "N."/"S." → "North"/"South", and names cut off with "...".
// Add a row here whenever a real slip uses a spelling the matcher misses.
// When a real feed arrives (Phase D), its team names become the keys.

export const TEAM_ALIASES: Record<League, Record<string, string[]>> = {
  NCAAF: {
    // SWAC (FCS)
    "Prairie View A&M": ["Prairie View", "PV A&M", "PVAMU", "Prairie View A and M"],
    Southern: ["Southern U", "Southern University", "Southern Jaguars", "SU Jaguars"],
    "Mississippi Valley State": ["MVSU", "Miss Valley", "Mississippi Valley", "Miss Valley St", "MS Valley St"],
    "Alcorn State": ["Alcorn", "ASU Braves"],
    "Jackson State": ["Jackson St", "JSU", "Jackson State Tigers"],
    "Grambling State": ["Grambling", "Grambling St", "GSU Tigers"],
    "Alabama A&M": ["AAMU", "Alabama A and M"],
    "Alabama State": ["Bama State", "ALST"],
    "Arkansas-Pine Bluff": ["Arkansas Pine Bluff", "UAPB", "Ark Pine Bluff"],
    "Bethune-Cookman": ["Bethune Cookman", "B-CU", "BCU"],
    "Florida A&M": ["FAMU", "Florida A and M"],
    "Texas Southern": ["TSU", "Texas So"],
    // Other FCS
    "North Dakota State": ["NDSU", "N Dakota St", "North Dakota St", "NDSU Bison"],
    "South Dakota State": ["SDSU Jackrabbits", "S Dakota St", "South Dakota St", "SDST"],
    Montana: ["Montana Grizzlies", "Griz"],
    "Montana State": ["Montana St", "Montana State Bobcats", "MSU Bobcats"],
    // FBS
    "Oklahoma State": ["Okla St", "Oklahoma St", "OK State", "OSU Cowboys"],
    "Texas Tech": ["Texas Tech Red Raiders", "TTU"],
    "Hawai'i": ["Hawaii", "Hawaii Rainbow Warriors", "UH"],
    "San Diego State": ["San Diego St", "SDSU Aztecs"],
    "Ohio State": ["Ohio St", "tOSU", "Ohio State Buckeyes"],
    "Penn State": ["Penn St", "PSU", "Penn State Nittany Lions"],
    Alabama: ["Bama", "Alabama Crimson Tide"],
    LSU: ["Louisiana State", "LSU Tigers"],
    Oregon: ["Oregon Ducks"],
    Washington: ["Washington Huskies", "UW"],
  },
  NFL: {
    "Kansas City Chiefs": ["Chiefs", "Kansas City", "KC"],
    "Buffalo Bills": ["Bills", "Buffalo", "BUF"],
    "Philadelphia Eagles": ["Eagles", "Philadelphia", "Philly", "PHI"],
    "Dallas Cowboys": ["Cowboys", "Dallas", "DAL"],
    "Detroit Lions": ["Lions", "Detroit", "DET"],
    "Green Bay Packers": ["Packers", "Green Bay", "GB"],
    "San Francisco 49ers": ["49ers", "Niners", "San Francisco", "SF"],
    "Los Angeles Rams": ["Rams", "LA Rams", "LAR"],
  },
  NBA: {
    "Los Angeles Lakers": ["Lakers", "LA Lakers", "LAL"],
    "Golden State Warriors": ["Warriors", "Golden State", "GSW", "GS Warriors"],
    "Boston Celtics": ["Celtics", "Boston", "BOS"],
    "New York Knicks": ["Knicks", "New York", "NY Knicks", "NYK"],
    "Denver Nuggets": ["Nuggets", "Denver", "DEN"],
    "Oklahoma City Thunder": ["Thunder", "OKC", "Oklahoma City"],
    "Milwaukee Bucks": ["Bucks", "Milwaukee", "MIL"],
    "Miami Heat": ["Heat", "Miami", "MIA"],
  },
  NCAAB: {
    Duke: ["Duke Blue Devils"],
    Kansas: ["Kansas Jayhawks", "KU"],
    Gonzaga: ["Zags", "Gonzaga Bulldogs", "GONZ"],
    UCLA: ["UCLA Bruins"],
    Kentucky: ["Kentucky Wildcats", "UK"],
    Houston: ["Houston Cougars", "UH Cougars"],
    "Prairie View A&M": ["Prairie View", "PV A&M", "PVAMU"],
    "Texas Southern": ["TSU", "Texas So", "TXSO"],
  },
};
