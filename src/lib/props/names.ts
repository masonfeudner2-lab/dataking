// Cross-source name matching (nvMatch_ in PropTracker.gs). Never matches ambiguously:
// any step that finds 2+ candidates falls through, and the final step returns null.
import { normName } from "./util";

export interface Named { player_display_name?: string; name?: string; position?: string }

const nameOf = (x: Named) => x.player_display_name || x.name || "";

export interface MatchOptions {
  /**
   * Normalized names of every player we know on this team (from our own box scores).
   * The fallbacks (first initial + last name, unique last name) are only used when no OTHER roster player
   * shares that key. Without this guard a backup who sat out (absent from the snap list) gets matched
   * to the starter with the same last name, e.g. Kyle Allen → Josh Allen.
   */
  roster?: Iterable<string>;
  /**
   * Our player's position (e.g. "WR"). When known, a fallback candidate must be in the same position group,
   * so a WR can't be matched to an offensive lineman with the same last name (Adonai → Max Mitchell).
   */
  position?: string;
  /**
   * "safe" (default): exact → first initial + last → unique last name, each fallback guarded by `roster`.
   * "sheet-live": exact → first initial + last, unguarded. Reproduces the Sheet that was live on Nov 18, 2026
   * (used only by the comparison test; it matched Brian Robinson Jr. to Bijan Robinson's snaps).
   */
  mode?: "safe" | "sheet-live";
}

const GROUP: Record<string, string> = { HB: "RB", FB: "RB", OL: "OL", T: "OL", G: "OL", C: "OL", OT: "OL", OG: "OL" };
const group = (p?: string) => { const u = String(p || "").toUpperCase(); return GROUP[u] || u; };

const lastOf = (n: string) => { const p = n.split(" "); return p[p.length - 1]; };
const initLast = (n: string) => n.split(" ")[0][0] + " " + lastOf(n);

export function matchName<T extends Named>(list: T[] | undefined, name: string, opts: MatchOptions = {}): T | null {
  if (!list) return null;
  const n = normName(name);
  // 1) exact normalized name (accents, punctuation, Jr/Sr/II/III removed)
  let m = list.filter((x) => normName(nameOf(x)) === n);
  if (m.length === 1) return m[0];
  const live = opts.mode === "sheet-live";
  const parts = n.split(" ");
  if (!parts[0]) return null;
  const last = parts[parts.length - 1], fi = parts[0][0];
  const others = opts.roster && !live ? [...opts.roster].filter((r) => r !== n) : [];
  const posOk = (x: T) => live || !opts.position || !x.position || group(x.position) === group(opts.position);
  // 2) first initial + last name
  if (!others.some((o) => o && initLast(o) === initLast(n))) {
    m = list.filter((x) => { const q = normName(nameOf(x)).split(" "); return !!q[0] && q[q.length - 1] === last && q[0][0] === fi && posOk(x); });
    if (m.length === 1) return m[0];
  }
  if (live) return null;
  // 3) nickname fallback (Hollywood/Marquise Brown, Drew/Andrew Ogletree): last name unique on BOTH sides
  if (others.some((o) => o && lastOf(o) === last)) return null;
  m = list.filter((x) => lastOf(normName(nameOf(x))) === last && posOk(x));
  return m.length === 1 ? m[0] : null;
}
