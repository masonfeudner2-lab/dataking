// Display helpers shared by the hit-rate screens (safe for client and server).
import type { Sport } from "./schema";

export const STAT_LABEL: Record<string, string> = {
  PTS: "Points", REB: "Rebounds", AST: "Assists", "3PM": "3-Pointers",
  PASS_YDS: "Pass yds", PASS_TD: "Pass TD", REC: "Receptions", REC_YDS: "Rec yds", RUSH_YDS: "Rush yds",
};
export const STAT_SHORT: Record<string, string> = {
  PTS: "PTS", REB: "REB", AST: "AST", "3PM": "3PM", PASS_YDS: "PASS", PASS_TD: "P TD", REC: "REC", REC_YDS: "REC YDS", RUSH_YDS: "RUSH",
};

/** Heat bucket for a hit-rate %, used as a CSS class. */
export function heat(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "h-none";
  if (pct >= 80) return "h5";
  if (pct >= 60) return "h4";
  if (pct >= 40) return "h3";
  if (pct >= 20) return "h2";
  return "h1";
}

/** "8/10 – 80%" → { frac: "8/10", pct: "80%" } */
export function splitFrac(s: string): { frac: string; pct: string } {
  const m = /^(\d+\/\d+) – (\d+%)$/.exec(s);
  return m ? { frac: m[1], pct: m[2] } : { frac: s, pct: "" };
}

export const playerHref = (sport: Sport, id: string, q: Record<string, string | number | undefined> = {}) => {
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return `/props/${sport.toLowerCase()}/${id}${qs ? "?" + qs : ""}`;
};

const PT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtPt = (iso: string) => (iso ? PT.format(new Date(iso)) + " PT" : "—");
const D = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "numeric", day: "numeric" });
export const fmtDay = (ymd: string) => D.format(new Date(ymd + "T12:00:00Z"));
