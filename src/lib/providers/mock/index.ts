import type { Game, Play } from "@/lib/types";
import type { ListOptions, ScoreProvider } from "../types";
import { DEFAULT_SIM_MINUTE, slateStart } from "./constants";
import { buildGame, buildPlays, isScoreOnly, type MockGameDef } from "./sim";

// One fake "Saturday" slate, reused every day. startOffsetMin = minutes after the slate begins.
// With the demo clock at its default (minute 280) you get a mix of final, live and upcoming games.
export const MOCK_SLATE: MockGameDef[] = [
  // College football, FCS (score updates only)
  { id: "m-pvamu-sou", league: "NCAAF", awayId: "cfb-pvamu", homeId: "cfb-southern", startOffsetMin: 150 },
  { id: "m-mvsu-alcn", league: "NCAAF", awayId: "cfb-mvsu", homeId: "cfb-alcorn", startOffsetMin: 0 },
  { id: "m-ndsu-sdst", league: "NCAAF", awayId: "cfb-ndsu", homeId: "cfb-sdsu-jacks", startOffsetMin: 210 },
  { id: "m-mont-mtst", league: "NCAAF", awayId: "cfb-mont", homeId: "cfb-mtst", startOffsetMin: 330 },
  { id: "m-gram-jsu", league: "NCAAF", awayId: "cfb-gram", homeId: "cfb-jsu", startOffsetMin: 240 },
  // College football, FBS
  { id: "m-okst-ttu", league: "NCAAF", awayId: "cfb-okst", homeId: "cfb-ttu", startOffsetMin: 30 },
  { id: "m-sdsu-haw", league: "NCAAF", awayId: "cfb-sdsu", homeId: "cfb-haw", startOffsetMin: 450 },
  { id: "m-psu-osu", league: "NCAAF", awayId: "cfb-psu", homeId: "cfb-osu", startOffsetMin: 180 },
  { id: "m-lsu-bama", league: "NCAAF", awayId: "cfb-lsu", homeId: "cfb-bama", startOffsetMin: 270 },
  { id: "m-wash-ore", league: "NCAAF", awayId: "cfb-wash", homeId: "cfb-ore", startOffsetMin: 390 },
  // NFL
  { id: "m-buf-kc", league: "NFL", awayId: "nfl-buf", homeId: "nfl-kc", startOffsetMin: 60 },
  { id: "m-dal-phi", league: "NFL", awayId: "nfl-dal", homeId: "nfl-phi", startOffsetMin: 200 },
  { id: "m-gb-det", league: "NFL", awayId: "nfl-gb", homeId: "nfl-det", startOffsetMin: 255 },
  { id: "m-lar-sf", league: "NFL", awayId: "nfl-lar", homeId: "nfl-sf", startOffsetMin: 420 },
  // NBA
  { id: "m-gsw-lal", league: "NBA", awayId: "nba-gsw", homeId: "nba-lal", startOffsetMin: 120 },
  { id: "m-nyk-bos", league: "NBA", awayId: "nba-nyk", homeId: "nba-bos", startOffsetMin: 200 },
  { id: "m-okc-den", league: "NBA", awayId: "nba-okc", homeId: "nba-den", startOffsetMin: 260 },
  { id: "m-mia-mil", league: "NBA", awayId: "nba-mia", homeId: "nba-mil", startOffsetMin: 360 },
  // College basketball
  { id: "m-ku-duke", league: "NCAAB", awayId: "cbb-ku", homeId: "cbb-duke", startOffsetMin: 100 },
  { id: "m-ucla-gonz", league: "NCAAB", awayId: "cbb-ucla", homeId: "cbb-gonz", startOffsetMin: 230 },
  { id: "m-hou-uk", league: "NCAAB", awayId: "cbb-hou", homeId: "cbb-uk", startOffsetMin: 320 },
  { id: "m-txso-pvamu", league: "NCAAB", awayId: "cbb-txso", homeId: "cbb-pvamu", startOffsetMin: 215, scoreOnly: true },
];


export class MockProvider implements ScoreProvider {
  id = "mock";
  label = "Demo data (fake games)";
  isDemo = true;

  async listGames(date: string, opts: ListOptions = {}): Promise<Game[]> {
    const start = slateStart(date);
    const sim = opts.simMinute ?? (Date.now() - start.getTime()) / 60_000;
    return MOCK_SLATE.filter((g) => !opts.leagues || opts.leagues.includes(g.league))
      .map((g) => buildGame(g, start, sim))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  async getPlays(gameId: string, opts: ListOptions = {}): Promise<Play[] | null> {
    const def = MOCK_SLATE.find((g) => g.id === gameId);
    if (!def) return [];
    if (isScoreOnly(def)) return null;
    return buildPlays(def, opts.simMinute ?? DEFAULT_SIM_MINUTE);
  }
}
