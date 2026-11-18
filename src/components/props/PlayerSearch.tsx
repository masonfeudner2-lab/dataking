"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normName } from "@/lib/props/util";
import { playerHref } from "@/lib/props/view";
import type { Sport } from "@/lib/props/schema";

export interface SearchPlayer { sport: Sport; id: string; name: string; team: string; pos: string; games: number; watched: boolean }

export function PlayerSearch({ players }: { players: SearchPlayer[] }) {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState<"ALL" | Sport>("ALL");
  const indexed = useMemo(() => players.map((p) => ({ p, n: normName(p.name), t: p.team.toLowerCase() })), [players]);
  const nq = normName(q);
  const hits = nq.length < 2 ? [] : indexed
    .filter(({ p, n, t }) => (sport === "ALL" || p.sport === sport) && (n.includes(nq) || n.split(" ").some((w) => w.startsWith(nq)) || t === nq))
    .sort((a, b) => Number(b.p.watched) - Number(a.p.watched) || Number(b.n.startsWith(nq)) - Number(a.n.startsWith(nq)) || b.p.games - a.p.games)
    .slice(0, 25);
  return (
    <section className="psearch">
      <label htmlFor="psearch" className="sr-only">Search a player</label>
      <input id="psearch" className="search big" type="search" autoComplete="off" autoCorrect="off" spellCheck={false}
        placeholder="Search a player or team (e.g. Brunson, DEN)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="chips" role="group" aria-label="Sport">
        {(["ALL", "NBA", "NFL"] as const).map((s) => (
          <button key={s} type="button" className="fchip" aria-pressed={sport === s} onClick={() => setSport(s)}>{s === "ALL" ? "Both" : s}</button>
        ))}
      </div>
      {nq.length >= 2 && (
        <ul className="plist">
          {hits.map(({ p }) => (
            <li key={p.sport + p.id}>
              <Link href={playerHref(p.sport, p.id)} className={p.watched ? "prow watched" : "prow"}>
                <span className="pname">{p.watched && <span aria-label="watching">★ </span>}{p.name}</span>
                <span className="muted small">{p.sport} · {p.team}{p.pos ? " · " + p.pos : ""} · {p.games} g</span>
              </Link>
            </li>
          ))}
          {!hits.length && <li className="muted small pad">No tracked player matches “{q}”.</li>}
        </ul>
      )}
    </section>
  );
}
