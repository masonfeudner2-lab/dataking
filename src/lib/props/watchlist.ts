// "My Props": sport + player required; team, stat and line optional (readWatchlist_).
import type { Sport } from "./schema";
import { normName } from "./util";

export interface WatchInput { sport: string; player: string; team?: string | null; stat?: string | null; line?: number | string | null; notes?: string | null }
export interface WatchEntry { sport: Sport; player: string; norm: string; team: string; stat: string; line: number | null; notes: string }

export function toWatchEntries(rows: WatchInput[]): WatchEntry[] {
  return rows.filter((r) => r.sport && r.player).map((r) => ({
    sport: String(r.sport).trim().toUpperCase() as Sport,
    player: String(r.player).trim(), norm: normName(r.player),
    team: String(r.team || "").trim().toUpperCase(), stat: String(r.stat || "").trim().toUpperCase(),
    line: r.line === "" || r.line === null || r.line === undefined ? null : Number(String(r.line).replace("+", "")),
    notes: String(r.notes || ""),
  }));
}
