import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // The hit-rate pages read the Sheet snapshot + nflverse files from /data at request time.
  outputFileTracingIncludes: {
    "/props{,/**}": ["./data/snapshot-2026-11-18/{nba_game_logs,nfl_game_logs,settings}.csv", "./data/nflverse-2026/*.csv"],
  },
};

export default nextConfig;
