import Link from "next/link";
import { PlayerSearch, type SearchPlayer } from "@/components/props/PlayerSearch";
import { WatchButton } from "@/components/props/WatchButton";
import type { HitRow } from "@/lib/props/schema";
import type { WatchEntry } from "@/lib/props/watchlist";
import { loadProps } from "@/lib/props/server";
import { heat, playerHref, splitFrac, STAT_SHORT } from "@/lib/props/view";

export default async function PropsHome() {
  const { ds, watchInput } = await loadProps();
  const players: SearchPlayer[] = [];
  for (const sport of ["NBA", "NFL"] as const) {
    const P = sport === "NBA" ? ds.nba.P : ds.nfl.P;
    for (const [id, p] of Object.entries(P)) {
      if (!p.tracked) continue;
      players.push({ sport, id, name: p.name, team: p.team, pos: "pos" in p ? p.pos : "", games: p.games.length, watched: p.watch.length > 0 });
    }
  }

  // watchlist cards: each entry → its player + the rows it pins (the line you picked, else the line nearest his median per stat)
  const cards = watchInput.map((w) => {
    const sport = w.sport === "NFL" ? "NFL" : "NBA";
    const P: Record<string, { key?: string; watch: WatchEntry[] }> = sport === "NBA" ? ds.nba.P : ds.nfl.P;
    const hit = sport === "NBA" ? ds.nba.hit : ds.nfl.hit;
    const found = Object.entries(P).find(([, p]) => p.watch.some((x) => x.player === w.player && x.team === String(w.team || "").toUpperCase()));
    if (!found) return { w, id: null, rows: [] as HitRow[] };
    const [id, p] = found;
    const mine = hit.filter((h) => h.player_key === p.key && (!w.stat || h.stat === w.stat));
    const byStat = new Map<string, HitRow[]>();
    for (const h of mine) byStat.set(h.stat, [...(byStat.get(h.stat) || []), h]);
    const rows = [...byStat.values()].map((list) => {
      if (w.line !== null && w.line !== undefined && w.line !== "") return list.find((h) => h._line === Number(w.line)) || list[0];
      const under = list.filter((h) => h._line <= h.median);
      return under.length ? under[under.length - 1] : list[0];
    });
    return { w, id, rows };
  });

  return (
    <>
      <PlayerSearch players={players} />
      <section className="block">
        <h2>My props</h2>
        {!cards.length && (
          <p className="muted">Nothing pinned yet. Open a player and tap <b>☆ Watch player</b>, or tap a line on his ladder and <b>Watch this line</b>.</p>
        )}
        <ul className="wlist">
          {cards.map(({ w, id, rows }) => (
            <li key={JSON.stringify(w)} className="wcard">
              <div className="wcard-head">
                {id ? <Link href={playerHref(w.sport === "NFL" ? "NFL" : "NBA", id, { stat: w.stat || undefined, line: w.line ?? undefined })} className="pname">{w.player}</Link>
                  : <span className="pname">{w.player}</span>}
                <span className="muted small">{w.sport}{w.team ? " · " + w.team : ""}{w.stat ? ` · ${w.stat} ${w.line ?? ""}${w.line ? "+" : ""}` : ""}</span>
                <WatchButton entry={w} on label="☆" offLabel="Remove" className="linkbtn" />
              </div>
              {!id && <p className="flag small">Not found in this season’s box scores. Check the spelling.</p>}
              {rows.length > 0 && (
                <div className="wrows">
                  {rows.map((h) => {
                    const l10 = splitFrac(h.L10);
                    return (
                      <div key={h.stat + h.line} className="wrow">
                        <span className="wstat">{STAT_SHORT[h.stat] ?? h.stat} {h.line}</span>
                        <span className={"cell " + heat(h.L10_pct)}><b>{l10.frac}</b> <small>L10</small></span>
                        <span className="muted small">Szn {splitFrac(h.Season).frac} · {h.streak}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="muted small">
        Tracking {players.filter((p) => p.sport === "NBA").length} NBA and {players.filter((p) => p.sport === "NFL").length} NFL players.{" "}
        <Link href="/props/browse">Browse every line →</Link>
      </p>
    </>
  );
}
