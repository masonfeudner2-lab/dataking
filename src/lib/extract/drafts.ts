import { looksTruncated, matchLeg, toLeague, type MatchConfidence } from "@/lib/matching/match";
import type { Game, Leg, Slip } from "@/lib/types";
import type { Extraction } from "./schema";

/** A leg on the confirm screen: the leg itself plus what needs the user's attention. */
export interface DraftLeg extends Leg {
  /** Why this leg is highlighted (from the AI read and/or the schedule match). */
  flags: string[];
  /** Quieter info, e.g. "Opponent filled in from today's schedule". */
  note: string;
  match: MatchConfidence;
  candidates: string[];
}

let n = 0;
const newId = () => `leg-${Date.now().toString(36)}-${(n++).toString(36)}`;

export function draftsFromExtraction(ex: Extraction, games: Game[]): DraftLeg[] {
  return ex.legs.map((l) => {
    const league = toLeague(l.league) ?? l.league;
    const m = matchLeg({ pick: l.pick, opponent: l.opponent, league: l.league, betType: l.bet_type }, games);
    const flags: string[] = [];
    // The AI's own flag stays up unless the schedule fully settled it (e.g. a cut-off opponent we filled in).
    // A cut-off *pick* name always stays flagged, even if it matched: the user should see it.
    const settledByMatch = m.confidence === "high" && !!m.filledOpponent && !looksTruncated(l.pick);
    if (l.needs_review && l.review_reason && !settledByMatch) flags.push(l.review_reason);
    else if (l.needs_review && !settledByMatch) flags.push("Check this leg.");
    if (m.confidence !== "high" && m.note) flags.push(m.note);
    return {
      id: newId(),
      league,
      betType: l.bet_type,
      pick: l.pick,
      opponent: m.filledOpponent ?? l.opponent,
      line: l.line,
      price: l.price,
      gameId: m.gameId,
      pickTeamId: m.pickTeamId,
      manualResult: null,
      flags,
      note: m.confidence === "high" ? m.note : "",
      match: m.confidence,
      candidates: m.candidates,
    };
  });
}

/** Re-open a saved slip on the confirm screen ("Edit legs"). */
export function draftsFromSlip(slip: Slip): DraftLeg[] {
  return slip.legs.map((l) => ({ ...l, flags: [], note: "", match: l.gameId ? "high" : "none", candidates: [] }));
}

export function newBlankDraft(): DraftLeg {
  return {
    id: newId(),
    league: "",
    betType: "moneyline",
    pick: "",
    opponent: null,
    line: "",
    price: "",
    gameId: null,
    pickTeamId: null,
    manualResult: null,
    flags: [],
    note: "",
    match: "none",
    candidates: [],
  };
}

export function slipFromDrafts(drafts: DraftLeg[], source: string, existing?: Slip | null): Slip {
  return {
    id: existing?.id ?? `slip-${Date.now().toString(36)}`,
    source: source || "your slip",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    legs: drafts
      .filter((d) => d.pick.trim())
      .map(({ flags: _f, note: _n, match: _m, candidates: _c, ...leg }) => leg),
  };
}
