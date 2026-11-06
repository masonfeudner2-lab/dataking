"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { legState } from "@/lib/grading";
import { gameWhen, legChip, legLabel } from "@/lib/format";
import { LEAGUE_LABEL, type Game, type League, type Leg } from "@/lib/types";

interface Props {
  id: string;
  game: Game | undefined;
  legs: Leg[];
  onOpen: () => void;
}

export function GameTile({ id, game, legs, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const states = legs.map((l) => legState(l, game));
  const tone = states.some((s) => s.result === "lost")
    ? "lost"
    : states.length && states.every((s) => s.result === "won" || s.result === "push")
      ? "won"
      : "";
  const picked = new Set(legs.map((l) => l.pickTeamId).filter(Boolean));
  const live = game?.status === "in_progress" || game?.status === "halftime";

  return (
    <div ref={setNodeRef} style={style} className={`tile ${tone} ${isDragging ? "dragging" : ""}`}>
      <div className="tile-top">
        <span className="tile-league">
          {game ? LEAGUE_LABEL[game.league as League] : "Game"}
          {game?.division === "FCS" ? " · FCS" : ""}
        </span>
        <button
          ref={setActivatorNodeRef}
          className="grip"
          type="button"
          aria-label="Drag to reorder. With a keyboard, press space then arrow keys."
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </div>
      <button className="tile-body" type="button" onClick={onOpen} aria-label={game ? `${game.away.name} at ${game.home.name}, details` : "Game details"}>
        {game ? (
          <>
            {[game.away, game.home].map((t) => (
              <div key={t.teamId} className={`team ${picked.has(t.teamId) ? "mine" : ""}`}>
                <span className="name">{t.name}</span>
                <span className="score num">{t.score ?? "–"}</span>
              </div>
            ))}
            <p className={`when ${live ? "live" : ""}`}>
              {live && <span className="dot" aria-hidden />}
              {gameWhen(game)}
            </p>
          </>
        ) : (
          <p className="when">Loading…</p>
        )}
        {legs.length > 0 && (
          <ul className="tile-legs">
            {legs.map((l, i) => {
              const chip = legChip(states[i]);
              return (
                <li key={l.id}>
                  <span className="leg-name">{legLabel(l)}</span>
                  <span className={`chip ${chip.tone}`}>{chip.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </button>
    </div>
  );
}
