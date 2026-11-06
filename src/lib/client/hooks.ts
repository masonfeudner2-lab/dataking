"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game, LegResult, Play, Slip } from "@/lib/types";
import { DEFAULT_SIM_MINUTE } from "@/lib/providers/mock/constants";

// ---------- Browser storage (Phase A only; Phase C moves slips to your account) ----------
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage full: the board still works, it just won't be remembered */
  }
}

// ---------- Demo clock (mock data only) ----------
export interface DemoClock {
  sim: number; // minutes since the fake slate began
  running: boolean;
  speed: number; // 1 = real time
}
const CLOCK_KEY = "dk:demoClock:v1";
const DEFAULT_CLOCK: DemoClock = { sim: DEFAULT_SIM_MINUTE, running: true, speed: 1 };

export function useDemoClock() {
  const [clock, setClock] = useState<DemoClock>(DEFAULT_CLOCK);
  const [jumped, setJumped] = useState(0); // bumps when the user jumps, to refresh scores at once

  useEffect(() => setClock(load(CLOCK_KEY, DEFAULT_CLOCK)), []);
  useEffect(() => {
    if (!clock.running) return;
    const t = setInterval(() => setClock((c) => ({ ...c, sim: c.sim + c.speed / 60 })), 1000);
    return () => clearInterval(t);
  }, [clock.running, clock.speed]);
  useEffect(() => save(CLOCK_KEY, clock), [clock]);

  return {
    clock,
    jumped,
    jump: (min: number) => {
      setClock((c) => ({ ...c, sim: Math.max(0, c.sim + min) }));
      setJumped((n) => n + 1);
    },
    toggle: () => setClock((c) => ({ ...c, running: !c.running })),
    setSpeed: (speed: number) => setClock((c) => ({ ...c, speed })),
    reset: () => {
      setClock(DEFAULT_CLOCK);
      setJumped((n) => n + 1);
    },
  };
}

// ---------- Polling the scoreboard ----------
// Asks our server for scores on a timer: every 5s on demo data, every 30s on a real feed.
// Pauses while the tab is hidden so phones don't burn data in the background.
export interface ProviderInfo {
  id: string;
  label: string;
  isDemo: boolean;
}

function usePoll(run: () => Promise<void>, intervalMs: number, deps: unknown[]) {
  const ref = useRef(run);
  ref.current = run;
  useEffect(() => {
    let alive = true;
    const go = () => {
      if (alive && document.visibilityState === "visible") ref.current().catch(() => {});
    };
    go();
    const t = setInterval(go, intervalMs);
    document.addEventListener("visibilitychange", go);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", go);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}

export function useScoreboard(date: string, sim: number, jumped: number) {
  const [games, setGames] = useState<Game[]>([]);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const simRef = useRef(sim);
  simRef.current = sim;

  usePoll(
    async () => {
      try {
        const res = await fetch(`/api/scoreboard?date=${date}&sim=${simRef.current.toFixed(2)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setGames(data.games);
        setProvider(data.provider);
        setError(false);
        setUpdatedAt(new Date());
      } catch {
        setError(true);
      }
    },
    provider && !provider.isDemo ? 30_000 : 5_000,
    [date, jumped],
  );

  return { games, provider, error, updatedAt };
}

export function usePlays(gameId: string | null, sim: number, live: boolean, demo: boolean) {
  const [state, setState] = useState<{ coverage: string; plays: Play[] | null } | null>(null);
  const simRef = useRef(sim);
  simRef.current = sim;
  useEffect(() => setState(null), [gameId]);
  usePoll(
    async () => {
      if (!gameId) return;
      const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/plays?sim=${simRef.current.toFixed(2)}`);
      if (res.ok) setState(await res.json());
    },
    live ? (demo ? 5_000 : 30_000) : 600_000,
    [gameId],
  );
  return state;
}

// ---------- The board: your slip, which games show, and in what order ----------
export interface BoardState {
  slip: Slip | null;
  order: string[]; // game ids, in the order you dragged them
  extra: string[]; // games you added by hand
  hidden: string[]; // slip games you took off the board (their legs still count)
}
const BOARD_KEY = "dk:board:v1";
const EMPTY: BoardState = { slip: null, order: [], extra: [], hidden: [] };

export function useBoard() {
  const [board, setBoard] = useState<BoardState>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setBoard(load(BOARD_KEY, EMPTY));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save(BOARD_KEY, board);
  }, [board, ready]);

  const slipGameIds = [...new Set((board.slip?.legs ?? []).map((l) => l.gameId).filter((x): x is string => !!x))];
  const visible = new Set([...slipGameIds.filter((id) => !board.hidden.includes(id)), ...board.extra]);
  const tileIds = [...board.order.filter((id) => visible.has(id)), ...[...visible].filter((id) => !board.order.includes(id))];

  const toggleGame = useCallback(
    (id: string) =>
      setBoard((b) => {
        const inSlip = (b.slip?.legs ?? []).some((l) => l.gameId === id);
        const onBoard = inSlip ? !b.hidden.includes(id) : b.extra.includes(id);
        if (inSlip) return { ...b, hidden: onBoard ? [...b.hidden, id] : b.hidden.filter((x) => x !== id) };
        return { ...b, extra: onBoard ? b.extra.filter((x) => x !== id) : [...b.extra, id] };
      }),
    [],
  );

  return {
    board,
    ready,
    tileIds,
    onBoard: (id: string) => visible.has(id),
    setOrder: (order: string[]) => setBoard((b) => ({ ...b, order })),
    toggleGame,
    loadSlip: (slip: Slip) => setBoard({ slip, order: [], extra: [], hidden: [] }),
    clearSlip: () => setBoard((b) => ({ ...b, slip: null, hidden: [] })),
    setManual: (legId: string, result: LegResult | null) =>
      setBoard((b) =>
        b.slip
          ? { ...b, slip: { ...b.slip, legs: b.slip.legs.map((l) => (l.id === legId ? { ...l, manualResult: result } : l)) } }
          : b,
      ),
  };
}
