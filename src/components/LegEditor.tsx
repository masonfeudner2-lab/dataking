"use client";

import type { DraftLeg } from "@/lib/extract/drafts";
import { gameWhen } from "@/lib/format";
import { toLeague } from "@/lib/matching/match";
import { LEAGUE_LABEL, LEAGUES, type BetType, type Game } from "@/lib/types";

interface Props {
  leg: DraftLeg;
  index: number;
  games: Game[];
  byId: Map<string, Game>;
  /** Set when this leg repeats an earlier one (1-based number of that leg). */
  duplicateOf?: number;
  onChange: (patch: Partial<DraftLeg>) => void;
  onRemove: () => void;
}

const BET_TYPES: { value: BetType; label: string }[] = [
  { value: "moneyline", label: "To win" },
  { value: "spread", label: "Spread" },
  { value: "total", label: "Over/under" },
  { value: "prop", label: "Prop" },
  { value: "other", label: "Other" },
];

const gameLabel = (g: Game) => `${g.away.name} at ${g.home.name} · ${gameWhen(g)}`;

export function LegEditor({ leg, index, games, byId, duplicateOf, onChange, onRemove }: Props) {
  const league = toLeague(leg.league);
  const game = leg.gameId ? byId.get(leg.gameId) : undefined;
  const flagged = leg.flags.length > 0 || duplicateOf !== undefined;
  const needsSide = (leg.betType === "moneyline" || leg.betType === "spread") && game;
  const candidateGames = leg.candidates.map((id) => byId.get(id)).filter((g): g is Game => !!g);
  const leagueGames = games.filter((g) => !league || g.league === league);

  const pickGame = (id: string) => {
    const g = byId.get(id);
    onChange({
      gameId: id || null,
      pickTeamId: null,
      league: g ? g.league : leg.league,
      flags: [],
      note: "",
      match: id ? "high" : "none",
    });
  };

  return (
    <li className={`draft ${flagged ? "flagged" : ""}`} aria-label={`Leg ${index + 1}`}>
      <div className="draft-head">
        <input
          className="draft-pick"
          value={leg.pick}
          placeholder="Pick (team, Over/Under, or player)"
          aria-label="Pick"
          onChange={(e) => onChange({ pick: e.target.value })}
        />
        <button type="button" className="x" aria-label={`Remove leg ${index + 1}`} onClick={onRemove}>
          ×
        </button>
      </div>

      <div className="draft-row">
        <label>
          <span>Bet</span>
          <select value={leg.betType} onChange={(e) => onChange({ betType: e.target.value as BetType })}>
            {BET_TYPES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        {leg.betType !== "moneyline" && (
          <label>
            <span>Line</span>
            <input
              className="short"
              value={leg.line}
              placeholder={leg.betType === "total" ? "o48.5" : leg.betType === "spread" ? "-3.5" : "25+ pts"}
              onChange={(e) => onChange({ line: e.target.value })}
            />
          </label>
        )}
        <label>
          <span>League</span>
          <select
            value={league ?? ""}
            onChange={(e) => onChange({ league: e.target.value, gameId: null, pickTeamId: null })}
          >
            <option value="">Not sure</option>
            {LEAGUES.map((l) => (
              <option key={l} value={l}>
                {LEAGUE_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Price</span>
          <input className="short" value={leg.price} onChange={(e) => onChange({ price: e.target.value })} />
        </label>
      </div>

      <label className="draft-game">
        <span>Game</span>
        <select value={leg.gameId ?? ""} onChange={(e) => pickGame(e.target.value)}>
          <option value="">{leg.gameId ? "No game" : "Choose the game…"}</option>
          {candidateGames.length > 0 && (
            <optgroup label="Best matches">
              {candidateGames.map((g) => (
                <option key={`c-${g.id}`} value={g.id}>
                  {gameLabel(g)}
                </option>
              ))}
            </optgroup>
          )}
          {(league ? [league] : LEAGUES).map((lg) => {
            const list = leagueGames.filter((g) => g.league === lg);
            return list.length ? (
              <optgroup key={lg} label={LEAGUE_LABEL[lg]}>
                {list.map((g) => (
                  <option key={g.id} value={g.id}>
                    {gameLabel(g)}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>

      {needsSide && (
        <div className="side" role="group" aria-label="Which team did you pick?">
          <span className="muted small">Your pick:</span>
          {[game.away, game.home].map((t) => (
            <button
              key={t.teamId}
              type="button"
              aria-pressed={leg.pickTeamId === t.teamId}
              onClick={() => onChange({ pickTeamId: t.teamId, opponent: (t === game.away ? game.home : game.away).name })}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {flagged && (
        <div className="why">
          <ul>
            {duplicateOf !== undefined && <li>Same as leg {duplicateOf}. Remove one, or pick a different game.</li>}
            {leg.flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          {leg.flags.length > 0 && (
            <button type="button" className="btn ghost small-btn" onClick={() => onChange({ flags: [] })}>
              Looks right
            </button>
          )}
        </div>
      )}
      {!flagged && leg.note && <p className="muted small">{leg.note}</p>}
    </li>
  );
}
