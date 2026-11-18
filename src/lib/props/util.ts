// Small helpers ported from PropTracker.gs. Behaviour must match the Apps Script exactly.

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** normName_: strip accents, punctuation and Jr/Sr/II/III suffixes; lower-case. */
export function normName(n: unknown): string {
  return String(n ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[.'’,]/g, "").replace(/-/g, " ").split(/\s+/)
    .filter((t) => t && !SUFFIXES.has(t)).join(" ");
}

/** num_: ESPN cell → number, or null when blank/"--"/unparseable. Never guesses. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s === "--" || s === "-") return null;
  const n = Number(s.replace("+", ""));
  return Number.isNaN(n) ? null : n;
}

/** splitPair_: "5-10" → [5, 10]; "16/26" → [16, 26]; anything else → [null, null]. */
export function splitPair(v: unknown, sep: string): [number | null, number | null] {
  const p = String(v ?? "").split(sep);
  return p.length === 2 ? [num(p[0]), num(p[1])] : [null, null];
}

export function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const round1 = (x: number) => Math.round(x * 10) / 10;

/** frac_: "8/10 – 80%" (en dash), or "—" when there are no games. */
export const frac = (h: number, n: number) => (n ? `${h}/${n} – ${Math.round((100 * h) / n)}%` : "—");

/** Days between a YYYY-MM-DD date (noon UTC) and `now`. */
export const daysAgo = (dateStr: string, now: Date) =>
  (now.getTime() - new Date(dateStr + "T12:00:00Z").getTime()) / 86400000;

export function ymdInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export const nowUtcIso = (d = new Date()) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Sort comparator used by the Sheet for log tabs: newest date first, then game+team+player. */
export function logOrder(a: { game_date: string; game_id: string; team: string; player: string },
  b: { game_date: string; game_id: string; team: string; player: string }) {
  return a.game_date < b.game_date ? 1 : a.game_date > b.game_date ? -1
    : (a.game_id + a.team + a.player).localeCompare(b.game_id + b.team + b.player);
}
