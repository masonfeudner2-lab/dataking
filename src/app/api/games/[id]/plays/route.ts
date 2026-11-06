import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

// GET /api/games/:id/plays?sim=280
// { coverage: "play_by_play", plays: [...] } or { coverage: "score_only", plays: null }
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const simRaw = new URL(req.url).searchParams.get("sim");
  const simMinute = simRaw !== null && simRaw !== "" ? Number(simRaw) : undefined;
  const plays = await getProvider().getPlays(id, { simMinute });
  return NextResponse.json(
    { coverage: plays === null ? "score_only" : "play_by_play", plays },
    { headers: { "Cache-Control": "no-store" } },
  );
}
