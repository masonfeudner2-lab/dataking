import type { Game, League, Play } from "@/lib/types";

/**
 * The "data switch". The app only ever talks to this interface, never to a data company
 * directly. To change feeds, write a new class that implements it and point
 * DATA_PROVIDER at it. Nothing else in the app has to change.
 */
export interface ScoreProvider {
  id: string;
  label: string;
  /** True for the built-in fake data (shows the demo clock in the UI). */
  isDemo: boolean;

  /** Every game on a date (YYYY-MM-DD), optionally limited to some leagues. */
  listGames(date: string, opts?: ListOptions): Promise<Game[]>;

  /** Play-by-play for one game, or null when the feed only has score and clock. */
  getPlays(gameId: string, opts?: ListOptions): Promise<Play[] | null>;
}

export interface ListOptions {
  leagues?: League[];
  /** Mock provider only: minutes since the fake slate began. Real feeds ignore it. */
  simMinute?: number;
}
