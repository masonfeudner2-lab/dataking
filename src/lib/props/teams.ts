// Team names for the hit-rate tracker. The data stores ESPN's short codes ("GS", "NY", "UTAH");
// this turns them into names people search for ("Warriors", "Golden State", "Dubs").

import type { Sport } from "./schema";
import { normName } from "./util";

export interface TeamInfo {
  code: string; // ESPN code as stored in the data
  city: string;
  name: string; // nickname, e.g. "Warriors"
  aliases?: string[];
}

const t = (code: string, city: string, name: string, aliases: string[] = []): TeamInfo => ({ code, city, name, aliases });

export const TEAMS: Record<Sport, TeamInfo[]> = {
  NBA: [
    t("ATL", "Atlanta", "Hawks"),
    t("BKN", "Brooklyn", "Nets", ["BRK", "BKN"]),
    t("BOS", "Boston", "Celtics", ["Cs"]),
    t("CHA", "Charlotte", "Hornets", ["CHO"]),
    t("CHI", "Chicago", "Bulls"),
    t("CLE", "Cleveland", "Cavaliers", ["Cavs"]),
    t("DAL", "Dallas", "Mavericks", ["Mavs"]),
    t("DEN", "Denver", "Nuggets"),
    t("DET", "Detroit", "Pistons"),
    t("GS", "Golden State", "Warriors", ["GSW", "Dubs"]),
    t("HOU", "Houston", "Rockets"),
    t("IND", "Indiana", "Pacers"),
    t("LAC", "LA", "Clippers", ["Los Angeles Clippers"]),
    t("LAL", "Los Angeles", "Lakers", ["LA Lakers"]),
    t("MEM", "Memphis", "Grizzlies", ["Grizz"]),
    t("MIA", "Miami", "Heat"),
    t("MIL", "Milwaukee", "Bucks"),
    t("MIN", "Minnesota", "Timberwolves", ["Wolves", "Twolves"]),
    t("NO", "New Orleans", "Pelicans", ["NOP", "Pels"]),
    t("NY", "New York", "Knicks", ["NYK"]),
    t("OKC", "Oklahoma City", "Thunder"),
    t("ORL", "Orlando", "Magic"),
    t("PHI", "Philadelphia", "76ers", ["Sixers", "Philly"]),
    t("PHX", "Phoenix", "Suns", ["PHO"]),
    t("POR", "Portland", "Trail Blazers", ["Blazers"]),
    t("SA", "San Antonio", "Spurs", ["SAS"]),
    t("SAC", "Sacramento", "Kings"),
    t("TOR", "Toronto", "Raptors", ["Raps"]),
    t("UTAH", "Utah", "Jazz", ["UTA"]),
    t("WSH", "Washington", "Wizards", ["WAS", "Wiz"]),
  ],
  NFL: [
    t("ARI", "Arizona", "Cardinals", ["Cards"]),
    t("ATL", "Atlanta", "Falcons"),
    t("BAL", "Baltimore", "Ravens"),
    t("BUF", "Buffalo", "Bills"),
    t("CAR", "Carolina", "Panthers"),
    t("CHI", "Chicago", "Bears"),
    t("CIN", "Cincinnati", "Bengals"),
    t("CLE", "Cleveland", "Browns"),
    t("DAL", "Dallas", "Cowboys"),
    t("DEN", "Denver", "Broncos"),
    t("DET", "Detroit", "Lions"),
    t("GB", "Green Bay", "Packers", ["Pack"]),
    t("HOU", "Houston", "Texans"),
    t("IND", "Indianapolis", "Colts"),
    t("JAX", "Jacksonville", "Jaguars", ["Jags"]),
    t("KC", "Kansas City", "Chiefs"),
    t("LAC", "Los Angeles", "Chargers", ["LA Chargers", "Bolts"]),
    t("LAR", "Los Angeles", "Rams", ["LA Rams"]),
    t("LV", "Las Vegas", "Raiders"),
    t("MIA", "Miami", "Dolphins", ["Fins"]),
    t("MIN", "Minnesota", "Vikings", ["Vikes"]),
    t("NE", "New England", "Patriots", ["Pats"]),
    t("NO", "New Orleans", "Saints"),
    t("NYG", "New York", "Giants"),
    t("NYJ", "New York", "Jets"),
    t("PHI", "Philadelphia", "Eagles", ["Philly"]),
    t("PIT", "Pittsburgh", "Steelers"),
    t("SEA", "Seattle", "Seahawks", ["Hawks"]),
    t("SF", "San Francisco", "49ers", ["Niners"]),
    t("TB", "Tampa Bay", "Buccaneers", ["Bucs"]),
    t("TEN", "Tennessee", "Titans"),
    t("WSH", "Washington", "Commanders", ["WAS"]),
  ],
};

export function teamInfo(sport: Sport, code: string): TeamInfo | undefined {
  return TEAMS[sport].find((x) => x.code === code);
}

/** "Golden State Warriors"; falls back to the code for a team we don't know yet. */
export function teamFullName(sport: Sport, code: string): string {
  const x = teamInfo(sport, code);
  return x ? `${x.city} ${x.name}` : code;
}

export interface TeamHit {
  sport: Sport;
  code: string;
  full: string;
  score: number;
}

/**
 * Teams matching what someone typed. "warriors", "golden", "GS", "dubs", "golden state w" all find
 * Golden State. Needs 2+ characters. Best matches first.
 */
export function searchTeams(query: string, sports: Sport[] = ["NBA", "NFL"]): TeamHit[] {
  const q = normName(query);
  if (q.length < 2) return [];
  const qWords = q.split(" ");
  const hits: TeamHit[] = [];
  for (const sport of sports) {
    for (const team of TEAMS[sport]) {
      const full = `${team.city} ${team.name}`;
      const forms = [team.code, team.name, team.city, full, ...(team.aliases ?? [])].map(normName);
      const words = normName(`${full} ${(team.aliases ?? []).join(" ")}`).split(" ");
      let score = 0;
      if (forms.includes(q)) score = 3; // exact: "warriors", "gs", "golden state warriors"
      else if (forms.some((f) => f.startsWith(q))) score = 2; // start of a name: "golden", "warr"
      else if (qWords.every((w) => words.some((x) => x.startsWith(w)))) score = 1; // "state warriors"
      if (score) hits.push({ sport, code: team.code, full, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.full.localeCompare(b.full));
}
