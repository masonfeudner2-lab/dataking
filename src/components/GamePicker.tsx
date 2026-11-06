"use client";

import { useState } from "react";
import { gameWhen } from "@/lib/format";
import { LEAGUE_LABEL, LEAGUES, type Game } from "@/lib/types";
import { Sheet } from "./Sheet";

interface Props {
  games: Game[];
  onBoard: (id: string) => boolean;
  inSlip: (id: string) => boolean;
  toggle: (id: string) => void;
  onClose: () => void;
}

export function GamePicker({ games, onBoard, inSlip, toggle, onClose }: Props) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const match = (g: Game) => !needle || `${g.away.name} ${g.home.name} ${g.away.short} ${g.home.short}`.toLowerCase().includes(needle);

  return (
    <Sheet title="Pick games" onClose={onClose}>
      <p className="muted">Tap a game to add it to your board or take it off. Taking a slip game off the board still counts its legs.</p>
      <input className="search" type="search" placeholder="Search teams" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search teams" />
      {LEAGUES.map((lg) => {
        const list = games.filter((g) => g.league === lg && match(g));
        if (!list.length) return null;
        return (
          <div key={lg} className="pick-group">
            <h3>{LEAGUE_LABEL[lg]}</h3>
            <ul>
              {list.map((g) => {
                const on = onBoard(g.id);
                return (
                  <li key={g.id}>
                    <button type="button" className={`pick-row ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(g.id)}>
                      <span className="check" aria-hidden>{on ? "✓" : ""}</span>
                      <span className="pick-names">
                        {g.away.name} <span className="muted">at</span> {g.home.name}
                        {inSlip(g.id) && <span className="tag-slip">on your slip</span>}
                      </span>
                      <span className="muted small">{gameWhen(g)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </Sheet>
  );
}
