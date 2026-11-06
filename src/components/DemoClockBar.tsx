"use client";

import { slateStart } from "@/lib/providers/mock/constants";
import type { DemoClock } from "@/lib/client/hooks";

interface Props {
  date: string;
  clock: DemoClock;
  jump: (min: number) => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  reset: () => void;
}

/** Only shown on demo data. Lets you fast-forward fake games to watch legs grade themselves. */
export function DemoClockBar({ date, clock, jump, toggle, setSpeed, reset }: Props) {
  const t = new Date(slateStart(date).getTime() + clock.sim * 60_000);
  return (
    <div className="demo" role="region" aria-label="Demo clock">
      <span className="demo-label">
        <b>Demo clock</b> {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </span>
      <div className="demo-btns">
        <button type="button" onClick={toggle} aria-label={clock.running ? "Pause demo clock" : "Play demo clock"}>
          {clock.running ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={() => setSpeed(clock.speed === 1 ? 10 : clock.speed === 10 ? 60 : 1)} aria-label="Change demo speed">
          {clock.speed}x
        </button>
        <button type="button" onClick={() => jump(15)}>+15m</button>
        <button type="button" onClick={() => jump(60)}>+1h</button>
        <button type="button" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
