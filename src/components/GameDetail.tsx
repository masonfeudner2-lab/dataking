"use client";

import { legState } from "@/lib/grading";
import { gameWhen, legChip, legLabel, pickName } from "@/lib/format";
import { usePlays } from "@/lib/client/hooks";
import { LEAGUE_LABEL, type Game, type League, type Leg, type LegResult } from "@/lib/types";
import { Sheet } from "./Sheet";

interface Props {
  game: Game;
  legs: Leg[];
  sim: number;
  demo: boolean;
  setManual: (legId: string, r: LegResult | null) => void;
  onClose: () => void;
}

const OPTIONS: { value: LegResult | null; label: string }[] = [
  { value: null, label: "Auto" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "push", label: "Push" },
];

export function GameDetail({ game, legs, sim, demo, setManual, onClose }: Props) {
  const live = game.status === "in_progress" || game.status === "halftime";
  const plays = usePlays(game.id, sim, live, demo);

  return (
    <Sheet title={`${game.away.short} at ${game.home.short}`} onClose={onClose}>
      <div className="detail-score">
        {[game.away, game.home].map((t) => (
          <div key={t.teamId} className="team big-team">
            <span className="name">{t.name}</span>
            <span className="score num">{t.score ?? "–"}</span>
          </div>
        ))}
        <p className="muted">
          {LEAGUE_LABEL[game.league as League]} · {gameWhen(game)}
        </p>
      </div>

      {legs.length > 0 && (
        <section className="detail-legs">
          <h3>Your legs on this game</h3>
          <ul>
            {legs.map((l) => {
              const st = legState(l, game);
              const chip = legChip(st);
              return (
                <li key={l.id}>
                  <div className="leg-head">
                    <b>{legLabel(l, game)}</b>
                    <span className={`chip ${chip.tone}`}>{chip.text}</span>
                  </div>
                  {pickName(l, game) !== l.pick && <p className="muted small">On your slip: {l.pick}</p>}
                  {l.price && <p className="muted small">Price on your slip: {l.price}</p>}
                  {l.betType === "prop" && (
                    <p className="muted small">Props are graded by you for now. Automatic prop grading arrives with player stats.</p>
                  )}
                  <div className="seg-ctl" role="group" aria-label="Grade this leg">
                    {OPTIONS.map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        aria-pressed={l.manualResult === o.value}
                        data-r={o.value ?? "auto"}
                        onClick={() => setManual(l.id, o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="plays">
        <h3>Play-by-play</h3>
        {game.coverage === "score_only" || plays?.coverage === "score_only" ? (
          <p className="muted">Score updates only. The feed has the score and clock for this game, but not individual plays.</p>
        ) : game.status === "scheduled" ? (
          <p className="muted">Starts at {gameWhen(game)}.</p>
        ) : !plays ? (
          <p className="muted">Loading plays…</p>
        ) : (
          <ol className="play-list">
            {(plays.plays ?? []).map((p) => (
              <li key={p.id} className={p.scoring ? "scoring" : ""}>
                <span className="play-when">
                  {p.periodLabel} {p.clock}
                </span>
                <span className="play-text">{p.description}</span>
                <span className="play-score num">
                  {p.awayScore}-{p.homeScore}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Sheet>
  );
}
