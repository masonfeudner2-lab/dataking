// Server-side entry point for the hit-rate pages: reads the watchlist cookie, returns the dataset.
import "server-only";
import { cookies } from "next/headers";
import { getDataset } from "./store";
import { parseWatchCookie, WATCH_COOKIE } from "./watchCookie";
import { toWatchEntries, type WatchInput } from "./watchlist";

export async function loadProps() {
  const jar = await cookies();
  const watchInput: WatchInput[] = parseWatchCookie(jar.get(WATCH_COOKIE)?.value);
  const watch = toWatchEntries(watchInput);
  return { ds: getDataset(watch), watch, watchInput };
}
