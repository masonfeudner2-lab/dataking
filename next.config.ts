import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // The hit-rate pages read data/live (written by the update job) or, until then, the Sheet snapshot.
  outputFileTracingIncludes: {
    "/props{,/**}": [
      "./data/live/**",
      "./data/settings.csv",
      "./data/snapshot-2026-11-18/{nba_game_logs,nfl_game_logs,settings}.csv",
      "./data/nflverse-2026/*.csv",
    ],
  },
};

export default nextConfig;
