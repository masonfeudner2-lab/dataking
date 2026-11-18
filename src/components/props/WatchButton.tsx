"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { parseWatchCookie, sameWatch, WATCH_COOKIE } from "@/lib/props/watchCookie";
import type { WatchInput } from "@/lib/props/watchlist";

function readCookie(): WatchInput[] {
  const m = document.cookie.split("; ").find((c) => c.startsWith(WATCH_COOKIE + "="));
  return parseWatchCookie(m ? m.slice(WATCH_COOKIE.length + 1) : undefined);
}
function writeCookie(list: WatchInput[]) {
  document.cookie = `${WATCH_COOKIE}=${encodeURIComponent(JSON.stringify(list))}; path=/; max-age=31536000; samesite=lax`;
}

/** Adds or removes one watchlist entry (player, or player + stat + line). */
export function WatchButton({ entry, on, label, offLabel, className = "btn ghost" }: {
  entry: WatchInput; on: boolean; label: string; offLabel?: string; className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = () => {
    const cur = readCookie();
    const next = on ? cur.filter((w) => !sameWatch(w, entry)) : [...cur.filter((w) => !sameWatch(w, entry)), entry];
    writeCookie(next);
    start(() => router.refresh());
  };
  return (
    <button type="button" className={className} aria-pressed={on} onClick={toggle} disabled={pending}>
      {on ? offLabel ?? "★ Watching" : label}
    </button>
  );
}
