import { MockProvider } from "./mock";
import type { ScoreProvider } from "./types";

// Picks the score feed from the DATA_PROVIDER environment variable.
// Phase D adds real ones here (e.g. "cfbd", a multi-sport API, later "sportradar").
let cached: ScoreProvider | null = null;

export function getProvider(): ScoreProvider {
  if (cached) return cached;
  const which = (process.env.DATA_PROVIDER || "mock").toLowerCase();
  switch (which) {
    case "mock":
      cached = new MockProvider();
      break;
    default:
      throw new Error(`Unknown DATA_PROVIDER "${which}". Use "mock" for now.`);
  }
  return cached;
}

export type { ScoreProvider } from "./types";
