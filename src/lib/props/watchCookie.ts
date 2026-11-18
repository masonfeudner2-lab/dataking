// Watchlist storage for the rough version: a cookie on this phone/browser (so the server can pin and
// summarize your players). Step 3 moves it into the database behind a passcode.
import type { WatchInput } from "./watchlist";

export const WATCH_COOKIE = "props_watch";

export function parseWatchCookie(v: string | undefined): WatchInput[] {
  if (!v) return [];
  try {
    const a = JSON.parse(decodeURIComponent(v));
    return Array.isArray(a) ? a.filter((x) => x && typeof x.sport === "string" && typeof x.player === "string").slice(0, 60) : [];
  } catch {
    return [];
  }
}

export const sameWatch = (a: WatchInput, b: WatchInput) =>
  a.sport === b.sport && a.player === b.player && (a.team || "") === (b.team || "") && (a.stat || "") === (b.stat || "") &&
  String(a.line ?? "") === String(b.line ?? "");
