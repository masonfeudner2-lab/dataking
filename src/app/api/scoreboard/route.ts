import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { LEAGUES, type League } from "@/lib/types";

// GET /api/scoreboard?date=YYYY-MM-DD&leagues=NFL,NBA&sim=280
// The browser asks this route; this route asks the data provider. Keeping the provider on
// the server means API keys stay secret, and later we can cache so many users share one call.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const leagues = url.searchParams
    .get("leagues")
    ?.split(",")
    .filter((l): l is League => (LEAGUES as string[]).includes(l));
  const simRaw = url.searchParams.get("sim");
  const simMinute = simRaw !== null && simRaw !== "" ? Number(simRaw) : undefined;

  const provider = getProvider();
  const games = await provider.listGames(date, { leagues, simMinute });
  return NextResponse.json(
    { provider: { id: provider.id, label: provider.label, isDemo: provider.isDemo }, date, games },
    { headers: { "Cache-Control": "no-store" } },
  );
}
