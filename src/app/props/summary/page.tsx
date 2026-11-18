import { loadProps } from "@/lib/props/server";
import type { SummaryItem } from "@/lib/props/summary";
import { fmtDay } from "@/lib/props/view";

const SECTION_TITLE: Record<string, string> = {
  CHANGED: "What changed for your players", "TRENDING UP": "Trending up (your players)", "TRENDING DOWN": "Trending down (your players)",
  STREAK: "Streaks (your players)", "LEAGUE TREND": "League-wide trends (top 10)", "DNP / INACTIVE": "Newly out",
  "LIMITED MINUTES": "Limited minutes", "LIMITED SNAPS": "Limited snaps", UNVERIFIED: "Unverified", VERIFY: "Spot-check links",
  WATCHLIST: "Watchlist problems", BACKFILL: "Backfill", NOTE: "Note",
};
const ORDER = ["WATCHLIST", "CHANGED", "TRENDING UP", "TRENDING DOWN", "STREAK", "LEAGUE TREND", "DNP / INACTIVE", "LIMITED MINUTES", "LIMITED SNAPS", "UNVERIFIED", "VERIFY", "BACKFILL", "NOTE"];

function group(items: SummaryItem[]) {
  const m = new Map<string, SummaryItem[]>();
  for (const it of items) m.set(it[0], [...(m.get(it[0]) || []), it]);
  return ORDER.filter((s) => m.has(s)).map((s) => [s, m.get(s)!] as const);
}

export default async function SummaryPage() {
  const { ds, watch } = await loadProps();
  return (
    <>
      <p className="muted small">
        Same rules as the Sheet: trending = L5 at least {Math.round(ds.settings.trendGap * 100)} points above or below the season rate with {ds.settings.trendMinGames}+ games;
        streaks of {ds.settings.streakMin}+; newly out = DNP after playing the previous game.
        {!watch.length && " Add players to My Props to get the personal sections."}
      </p>
      {(["NBA", "NFL"] as const).map((sport) => (
        <section key={sport} className="block">
          <h2>{sport} <span className="muted small">games of {fmtDay(ds.meta[sport].lastGameDate)}{sport === "NFL" ? " (latest week)" : ""}</span></h2>
          {group(ds.summary[sport]).map(([sec, list]) => {
            const body = (
              <ul className="sumlist">
                {list.map((it, i) => (
                  <li key={i} className={"sum " + sec.toLowerCase().replace(/[^a-z]+/g, "-")}>
                    {sec === "VERIFY" ? (() => {
                      const [gid, date, url] = it[1].split(" ");
                      return <><a href={url} target="_blank" rel="noreferrer">Game {gid} · {date} on Basketball-Reference ↗</a><span className="muted small">{it[2]}</span></>;
                    })() : <><b>{it[1]}</b><span className={sec === "LEAGUE TREND" ? (it[2].startsWith("▲") ? "up" : "down") : "muted small"}>{it[2]}</span></>}
                  </li>
                ))}
              </ul>
            );
            return (
              <div key={sec} className="sumsec" id={sec === "UNVERIFIED" ? (sport === "NBA" ? "unverified" : "unverified-nfl") : undefined}>
                {sec === "VERIFY" ? (
                  <details><summary><h3>{SECTION_TITLE[sec]} ({list.length})</h3></summary>{body}</details>
                ) : <><h3>{SECTION_TITLE[sec] ?? sec}</h3>{body}</>}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}
