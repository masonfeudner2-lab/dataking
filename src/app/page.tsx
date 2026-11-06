"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { legState, summarize } from "@/lib/grading";
import { legChip, legLabel, todayPT } from "@/lib/format";
import { makeSampleSlip } from "@/lib/sampleSlip";
import { useBoard, useDemoClock, useScoreboard } from "@/lib/client/hooks";
import { GameTile } from "@/components/GameTile";
import { StatusBar } from "@/components/StatusBar";
import { GamePicker } from "@/components/GamePicker";
import { GameDetail } from "@/components/GameDetail";
import { DemoClockBar } from "@/components/DemoClockBar";

export default function BoardPage() {
  const [date] = useState(todayPT);
  const demo = useDemoClock();
  const { games, provider, error, updatedAt } = useScoreboard(date, demo.clock.sim, demo.jumped);
  const b = useBoard();
  const [picking, setPicking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const legs = b.board.slip?.legs ?? [];
  const summary = summarize(legs.map((l) => legState(l, l.gameId ? byId.get(l.gameId) : undefined)));
  const unmatched = legs.filter((l) => !l.gameId);
  const isDemo = provider?.isDemo ?? true;

  // Drag by the handle. Pointer events cover mouse, finger and pen; keyboard works too.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = b.tileIds.indexOf(String(e.active.id));
    const to = b.tileIds.indexOf(String(e.over.id));
    b.setOrder(arrayMove(b.tileIds, from, to));
  };

  const openGame = openId ? byId.get(openId) : undefined;

  return (
    <main className={isDemo ? "has-demo" : ""}>
      <header className="top">
        <h1>Your board</h1>
        <div className="top-actions">
          <button className="btn ghost" type="button" onClick={() => setPicking(true)}>
            Pick games
          </button>
          {b.board.slip ? (
            <button className="btn ghost" type="button" onClick={b.clearSlip}>
              Clear slip
            </button>
          ) : (
            <button className="btn" type="button" onClick={() => b.loadSlip(makeSampleSlip())}>
              Load sample slip
            </button>
          )}
        </div>
      </header>

      {b.ready && b.board.slip && <StatusBar summary={summary} source={`${legs.length}-leg slip from ${b.board.slip.source}`} />}

      {b.ready && !b.board.slip && b.tileIds.length === 0 && (
        <div className="empty">
          <p>
            <b>Nothing on your board yet.</b>
          </p>
          <p className="muted">
            Load the sample 18-leg slip to see how it works, or pick any games to follow. Reading a slip screenshot comes in the next phase.
          </p>
        </div>
      )}

      {error && <p className="err">Couldn&apos;t reach the scoreboard. Retrying…</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={b.tileIds} strategy={rectSortingStrategy}>
          <div className="board">
            {b.tileIds.map((id) => (
              <GameTile key={id} id={id} game={byId.get(id)} legs={legs.filter((l) => l.gameId === id)} onOpen={() => setOpenId(id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {unmatched.length > 0 && (
        <section className="unmatched">
          <h3>Legs not matched to a game</h3>
          <ul>
            {unmatched.map((l) => {
              const chip = legChip(legState(l, undefined));
              return (
                <li key={l.id}>
                  {legLabel(l)} <span className={`chip ${chip.tone}`}>{chip.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="fine">
        Results here are unofficial. Each app settles bets by its own rules, so tap a game to fix any grade by hand.
        {provider && (
          <>
            {" "}
            Scores: {provider.label}
            {updatedAt && `, updated ${updatedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}`}.
          </>
        )}
      </p>

      {picking && (
        <GamePicker
          games={games}
          onBoard={b.onBoard}
          inSlip={(id) => legs.some((l) => l.gameId === id)}
          toggle={b.toggleGame}
          onClose={() => setPicking(false)}
        />
      )}
      {openGame && (
        <GameDetail
          game={openGame}
          legs={legs.filter((l) => l.gameId === openGame.id)}
          sim={demo.clock.sim}
          demo={isDemo}
          setManual={b.setManual}
          onClose={() => setOpenId(null)}
        />
      )}
      {b.ready && isDemo && <DemoClockBar date={date} {...demo} />}
    </main>
  );
}
