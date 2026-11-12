"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LegEditor } from "@/components/LegEditor";
import { load, readBoardSlip, save, writeBoardSlip } from "@/lib/client/hooks";
import { MAX_PIECES, prepareImages } from "@/lib/client/prepareImages";
import { draftsFromExtraction, draftsFromSlip, findDuplicates, newBlankDraft, slipFromDrafts, type DraftLeg } from "@/lib/extract/drafts";
import { SAMPLE_EXTRACTION } from "@/lib/extract/sample";
import type { ExtractResponse } from "@/lib/extract/schema";
import { todayPT } from "@/lib/format";
import type { Game, Slip } from "@/lib/types";

type Step = "pick" | "reading" | "review";
const PASS_KEY = "dk:passcode";

export default function ReadSlipPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [games, setGames] = useState<Game[]>([]);
  const [drafts, setDrafts] = useState<DraftLeg[]>([]);
  const [source, setSource] = useState("");
  const [editing, setEditing] = useState<Slip | null>(null);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);
  const [needPasscode, setNeedPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [warnBuild, setWarnBuild] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const pending = useRef<File[]>([]);
  const ctl = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  // Today's schedule, for matching names to games.
  useEffect(() => {
    fetch(`/api/scoreboard?date=${todayPT()}`)
      .then((r) => r.json())
      .then((d) => setGames(d.games ?? []))
      .catch(() => setError("Couldn't load today's games. Matching will be skipped."));
    setPasscode(load(PASS_KEY, ""));
    // "Edit legs" from the board opens the current slip here.
    if (new URLSearchParams(window.location.search).get("edit") === "1") {
      const slip = readBoardSlip();
      if (slip) {
        setEditing(slip);
        setSource(slip.source);
        setDrafts(draftsFromSlip(slip));
        setStep("review");
      }
    }
  }, []);

  async function waitForGames(): Promise<Game[]> {
    if (games.length) return games;
    const r = await fetch(`/api/scoreboard?date=${todayPT()}`);
    const d = await r.json();
    setGames(d.games ?? []);
    return d.games ?? [];
  }

  async function read(files: File[]) {
    if (!files.length) return;
    pending.current = files;
    setError("");
    setNotConfigured(false);
    setThumbs(files.map((f) => URL.createObjectURL(f)));
    setStep("reading");
    ctl.current = new AbortController();
    try {
      const images = await prepareImages(files).catch((e: Error) => {
        throw new Error(
          e.message === "too_long"
            ? `That slip is too long to read in one go (over ${MAX_PIECES} pieces). Try fewer screenshots at a time.`
            : "One of those files isn't a readable image. Use PNG or JPG screenshots.",
        );
      });
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(passcode ? { "x-passcode": passcode } : {}) },
        body: JSON.stringify({ images }),
        signal: ctl.current.signal,
      });
      const data = (await res.json().catch(() => null)) as ExtractResponse | null;
      if (!data) throw new Error("Something interrupted the read. Try again.");
      if (!data.ok) {
        if (data.code === "not_configured") setNotConfigured(true);
        if (data.code === "passcode") setNeedPasscode(true);
        throw new Error(data.message);
      }
      const g = await waitForGames();
      setEditing(null);
      setSource(data.extraction.source);
      setDrafts(draftsFromExtraction(data.extraction, g));
      setStep("review");
    } catch (e) {
      const err = e as Error;
      setError(err.name === "AbortError" ? "Stopped. Choose a screenshot to try again." : err.message);
      setStep("pick");
    }
  }

  async function trySample() {
    const g = await waitForGames().catch(() => []);
    setEditing(null);
    setError("");
    setSource(SAMPLE_EXTRACTION.source);
    setDrafts(draftsFromExtraction(SAMPLE_EXTRACTION, g));
    setStep("review");
  }

  function build() {
    if (flaggedCount && !warnBuild) {
      setWarnBuild(true);
      return;
    }
    const current = readBoardSlip();
    if (!editing && current && !window.confirm("Replace the slip that's on your board now?")) return;
    writeBoardSlip(slipFromDrafts(drafts, source, editing));
    router.push("/");
  }

  const update = (id: string, patch: Partial<DraftLeg>) => {
    setWarnBuild(false);
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const duplicates = findDuplicates(drafts);
  const flaggedCount = drafts.filter((d) => d.flags.length || duplicates.has(d.id)).length;

  return (
    <main>
      <nav className="crumbs">
        <Link href="/">← Your board</Link>
      </nav>

      {step !== "review" && (
        <section>
          <h1>Read a slip</h1>
          <p className="lede muted">
            Add a screenshot of any bet slip: Kalshi, FanDuel, DraftKings or anything else. For a long slip, add every screenshot at once,
            top to bottom. You&apos;ll check every leg before it goes on your board.
          </p>

          <div
            className={`drop ${dragOver ? "over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              read([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
            }}
          >
            {step === "reading" ? (
              <div className="reading">
                <div className="thumbs">
                  {thumbs.map((t) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={t} src={t} alt="Your slip screenshot" />
                  ))}
                </div>
                <p>
                  <b>Reading your slip…</b>
                </p>
                <p className="muted small">This can take up to a minute for a long slip.</p>
                <button type="button" className="btn ghost" onClick={() => ctl.current?.abort()}>
                  Stop
                </button>
              </div>
            ) : (
              <>
                <strong>Add slip screenshots</strong>
                <span className="muted">One or several, from any app</span>
                <div className="row-actions">
                  <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                    Choose screenshots
                  </button>
                  <button type="button" className="btn ghost" onClick={trySample}>
                    Try a sample slip
                  </button>
                </div>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              multiple
              hidden
              onChange={(e) => {
                read([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </div>

          {error && <p className="err">{error}</p>}
          {notConfigured && (
            <p className="muted small" style={{ marginTop: 8 }}>
              Reading screenshots needs a Claude API key on the server (see the README). Until then, <b>Try a sample slip</b> shows the
              same confirm screen.
            </p>
          )}
          {needPasscode && (
            <form
              className="passcode"
              onSubmit={(e) => {
                e.preventDefault();
                save(PASS_KEY, passcode);
                setNeedPasscode(false);
                read(pending.current);
              }}
            >
              <label>
                <span>Passcode</span>
                <input value={passcode} onChange={(e) => setPasscode(e.target.value)} autoComplete="off" />
              </label>
              <button className="btn" type="submit">
                Try again
              </button>
            </form>
          )}
        </section>
      )}

      {step === "review" && (
        <section>
          <div className="summary">
            <span className="num">{drafts.length}</span>
            <div>
              <h2>{editing ? "legs on your slip" : "legs found"}</h2>
              {source && <small className="muted">from {source}</small>}
            </div>
          </div>
          {flaggedCount > 0 ? (
            <p className="flagnote">
              {flaggedCount === 1 ? "1 leg needs a look." : `${flaggedCount} legs need a look.`} They&apos;re marked in orange.
            </p>
          ) : (
            <p className="muted">Everything matched. Give it a quick once-over.</p>
          )}
          <p className="muted small">Tap any field to fix it. Prices stay private to you.</p>

          <ul className="drafts">
            {drafts.map((d, i) => (
              <LegEditor
                key={d.id}
                leg={d}
                index={i}
                games={games}
                byId={byId}
                duplicateOf={duplicates.get(d.id)}
                onChange={(p) => update(d.id, p)}
                onRemove={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}
              />
            ))}
          </ul>

          {warnBuild && (
            <p className="flagnote" role="alert">
              {flaggedCount === 1 ? "1 leg is" : `${flaggedCount} legs are`} still flagged. Fix them, tap &quot;Looks right&quot;, or build anyway.
            </p>
          )}
          <div className="foot">
            <button className="btn ghost" type="button" onClick={() => setDrafts((ds) => [...ds, newBlankDraft()])}>
              Add a leg
            </button>
            <button className="btn" type="button" onClick={build} disabled={!drafts.some((d) => d.pick.trim())}>
              {warnBuild ? "Build board anyway" : editing ? "Save changes" : "Build my board"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setDrafts([]);
                setEditing(null);
                setStep("pick");
              }}
            >
              Read another slip
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
