import type { LegState } from "@/lib/grading";
import type { Game, Leg } from "@/lib/types";

/**
 * The team name to show for a leg: the schedule's official name once the leg is matched
 * ("Prairie View A&M"), otherwise what the slip said ("Prairie View").
 */
export function pickName(leg: Leg, game?: Game): string {
  const team = game && leg.pickTeamId ? [game.away, game.home].find((t) => t.teamId === leg.pickTeamId) : undefined;
  return team?.name ?? leg.pick;
}

/** "Southern to win", "Texas Tech -6.5", "Over 47.5", "Jalen Hurts 40+ rush yds" */
export function legLabel(leg: Leg, game?: Game): string {
  switch (leg.betType) {
    case "moneyline":
      return `${pickName(leg, game) || "Pick"} to win`;
    case "spread":
      return `${pickName(leg, game)} ${leg.line}`.trim();
    case "total": {
      const n = leg.line.replace(/^(o|u|over|under)\s*/i, "");
      const side = /^u/i.test(leg.line) || /^under/i.test(leg.pick) ? "Under" : "Over";
      return `${side} ${n}`.trim();
    }
    default:
      return `${leg.pick} ${leg.line}`.trim();
  }
}

export type Tone = "won" | "lost" | "push" | "winning" | "losing" | "neutral" | "attention";

export function legChip(st: LegState): { text: string; tone: Tone } {
  const you = st.manual ? " (you)" : "";
  if (st.result === "won") return { text: "Won" + you, tone: "won" };
  if (st.result === "lost") return { text: "Lost" + you, tone: "lost" };
  if (st.result === "push") return { text: "Push" + you, tone: "push" };
  if (st.needsManualGrade) return { text: "Needs your call", tone: "attention" };
  if (st.status === "live") {
    if (st.trend === "winning") return { text: "Winning", tone: "winning" };
    if (st.trend === "losing") return { text: "Losing", tone: "losing" };
    if (st.trend === "even") return { text: "Even", tone: "neutral" };
    return { text: "Live", tone: "neutral" };
  }
  if (st.status === "no_game") return { text: "No game matched", tone: "attention" };
  return { text: "Not started", tone: "neutral" };
}

export function startTimeLabel(game: Game): string {
  const d = new Date(game.startTime);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function gameWhen(game: Game): string {
  return game.status === "scheduled" ? startTimeLabel(game) : game.statusLabel;
}

/** Today's date in California, as YYYY-MM-DD. */
export function todayPT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}
