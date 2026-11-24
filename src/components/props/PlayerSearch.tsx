"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normName } from "@/lib/props/util";
import { playerHref } from "@/lib/props/view";
import type { Sport } from "@/lib/props/schema";
import { searchTeams } from "@/lib/props/teams";

export interface SearchPlayer { sport: Sport; id: string; name: string; team: string; pos: string; games: number; watched: boolean }

export function PlayerSearch({ players }: { players: SearchPlayer[] }) {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState<"ALL" | Sport>("ALL");
  const indexed = useMemo(() => players.map((p) => ({ p, n: normName(p.name), t: p.team.toLowerCase() })), [players]);
  const nq = normName(q);
  const sports: Sport[] = sport === "ALL" ? ["NBA", "NFL"] : [sport];
  // Teams: "Warriors", "golden", "GS", "dubs"… Only teams we actually have players for.
  const rosterSize = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of players) m.set(p.sport + ":" + p.team, (m.get(p.sport + ":" + p.team) ?? 0) + 1);
    return m;
  }, [players]);
  const teams = searchTeams(q, sports).filter((h) => rosterSize.has(h.sport + ":" + h.code)).slice(0, 6);
  const teamKeys = new Set(teams.filter((h) => h.score >= 2).map((h) => h.sport + ":" + h.code));
  const nameHit = (n: string) => n.includes(nq) || n.split(" ").some((w) => w.startsWith(nq));
  const hits = nq.length < 2 ? [] : indexed
    .filter(({ p, n, t }) => (sport === "ALL" || p.sport === sport) && (nameHit(n) || t === nq || teamKeys.has(p.sport + ":" + p.team)))
    .sort((a, b) => Number(nameHit(b.n)) - Number(nameHit(a.n)) || Number(b.p.watched) - Number(a.p.watched) || Number(b.n.startsWith(nq)) - Number(a.n.startsWith(nq)) || b.p.games - a.p.games)
    .slice(0, 25);
  return (
    <section className="psearch">
      <label htmlFor="psearch" className="sr-only">Search a player</label>
      <input id="psearch" className="search big" type="search" autoComplete="off" autoCorrect="off" spellCheck={false}
        placeholder="Search a player or team (e.g. Brunson, Warriors)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="chips" role="group" aria-label="Sport">
        {(["ALL", "NBA", "NFL"] as const).map((s) => (
          <button key={s} type="button" className="fchip" aria-pressed={sport === s} onClick={() => setSport(s)}>{s === "ALL" ? "Both" : s}</button>
        ))}
      </div>
      {teams.length > 0 && (
        <>
          <h3 className="plist-head">Teams</h3>
          <ul className="plist">
            {teams.map((h) => (
              <li key={h.sport + h.code}>
                <Link href={`/props/browse?sport=${h.sport}&team=${encodeURIComponent(h.code)}`} className="prow team">
                  <span className="pname">{h.full}</span>
                  <span className="muted small nowrap">{h.sport} · {rosterSize.get(h.sport + ":" + h.code)} players →</span>
                </Link>
              </li>
            ))}
          </ul>
          {hits.length > 0 && <h3 className="plist-head">Players</h3>}
        </>
      )}
      {nq.length >= 2 && (hits.length > 0 || !teams.length) && (
        <ul className="plist">
          {hits.map(({ p }) => (
            <li key={p.sport + p.id}>
              <Link href={playerHref(p.sport, p.id)} className={p.watched ? "prow watched" : "prow"}>
                <span className="pname">{p.watched && <span aria-label="watching">★ </span>}{p.name}</span>
                <span className="muted small">{p.sport} · {p.team}{p.pos ? " · " + p.pos : ""} · {p.games} g</span>
              </Link>
            </li>
          ))}
          {!hits.length && <li className="muted small pad">No tracked player or team matches “{q}”.</li>}
        </ul>
      )}
    </section>
  );
}
