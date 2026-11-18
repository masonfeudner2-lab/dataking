import Link from "next/link";
import { notFound } from "next/navigation";
import { WatchButton } from "@/components/props/WatchButton";
import { STAT_FIELD, type StatCode } from "@/lib/props/config";
import { isOk, type HitRow, type NbaLogRow, type NflLogRow, type Sport } from "@/lib/props/schema";
import { loadProps } from "@/lib/props/server";
import { sameWatch } from "@/lib/props/watchCookie";
import { fmtDay, heat, playerHref, splitFrac, STAT_LABEL, STAT_SHORT } from "@/lib/props/view";

type Col = { key: string; label: string; stat?: StatCode; get: (r: NbaLogRow & NflLogRow) => string | number | null };

const NBA_COLS: Col[] = [
  { key: "minutes", label: "MIN", get: (r) => r.minutes },
  { key: "pts", label: "PTS", stat: "PTS", get: (r) => r.pts },
  { key: "reb", label: "REB", stat: "REB", get: (r) => r.reb },
  { key: "ast", label: "AST", stat: "AST", get: (r) => r.ast },
  { key: "fg3m", label: "3PM", stat: "3PM", get: (r) => r.fg3m },
];
const NFL_QB: Col[] = [
  { key: "snap", label: "SNAP", get: (r) => (r.off_snap_pct === null ? null : r.off_snap_pct + "%") },
  { key: "ca", label: "C/A", get: (r) => (r.pass_att === null ? null : `${r.pass_cmp ?? "?"}/${r.pass_att}`) },
  { key: "pass_yds", label: "PASS", stat: "PASS_YDS", get: (r) => r.pass_yds },
  { key: "pass_td", label: "TD", stat: "PASS_TD", get: (r) => r.pass_td },
  { key: "rush_yds", label: "RUSH", stat: "RUSH_YDS", get: (r) => r.rush_yds },
];
const NFL_SKILL: Col[] = [
  { key: "snap", label: "SNAP", get: (r) => (r.off_snap_pct === null ? null : r.off_snap_pct + "%") },
  { key: "receptions", label: "REC", stat: "REC", get: (r) => r.receptions },
  { key: "targets", label: "TGT", get: (r) => r.targets },
  { key: "rec_yds", label: "YDS", stat: "REC_YDS", get: (r) => r.rec_yds },
  { key: "carries", label: "CAR", get: (r) => r.carries },
  { key: "rush_yds", label: "RUSH", stat: "RUSH_YDS", get: (r) => r.rush_yds },
];

const STATUS_TEXT: Record<string, string> = { DNP: "DNP", NOT_IN_BOX: "Out", PENDING: "Pending" };

export default async function PlayerPage({ params, searchParams }: {
  params: Promise<{ sport: string; id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { sport: s, id } = await params;
  const q = await searchParams;
  const sport = s.toUpperCase() as Sport;
  if (sport !== "NBA" && sport !== "NFL") notFound();
  const { ds, watchInput } = await loadProps();
  const bundle = sport === "NBA" ? ds.nba : ds.nfl;
  const p = bundle.P[id];
  if (!p) notFound();
  const pos = "pos" in p ? p.pos : "";
  const rows = (bundle.hit as HitRow[]).filter((h) => h.player_key === p.key);
  // tabs in the Settings ladder order (Points first), not alphabetical
  const order = ds.settings.ladders[sport].map((l) => l.stat as string);
  const stats = ([...new Set(rows.map((h) => h.stat))] as StatCode[]).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const stat = (stats.includes(String(q.stat) as StatCode) ? String(q.stat) : stats[0]) as StatCode | undefined;
  const ladder = rows.filter((h) => h.stat === stat);
  const lineQ = Number(q.line);
  const sel = ladder.find((h) => h._line === lineQ);
  const logs = (bundle.logRows as (NbaLogRow & NflLogRow)[]).filter((r) => r.player_id === id);
  const cols = sport === "NBA" ? NBA_COLS : pos === "QB" ? NFL_QB : NFL_SKILL;
  const field = stat ? STAT_FIELD[stat] : undefined;
  const notCounted = logs.filter((r) => r.status !== "PLAYED").length;
  const unverified = logs.filter((r) => !isOk(r.check_status)).length;
  const limited = logs.filter((r) => r.limited_minutes === "Y" || r.limited_snaps === "Y").length;
  const playerEntry = { sport, player: p.name, team: p.team };
  const watchingPlayer = watchInput.some((w) => sameWatch(w, playerEntry));
  const lineEntry = sel && stat ? { ...playerEntry, stat, line: sel._line } : null;
  const watchingLine = !!lineEntry && watchInput.some((w) => sameWatch(w, lineEntry));
  const avgLabel = sport === "NBA" ? `${"avgMin" in p ? p.avgMin.toFixed(1) : ""} min` : `${"avgPct" in p ? Math.round(p.avgPct) : ""}% snaps`;
  const first = ladder[0];

  return (
    <article className="player">
      <header className="phead">
        <div>
          <h2>{p.name}</h2>
          <p className="muted">{sport} · {p.team}{pos ? " · " + pos : ""} · {p.games.length} games · avg {avgLabel}</p>
        </div>
        <WatchButton entry={playerEntry} on={watchingPlayer} label="☆ Watch player" offLabel="★ Watching" />
      </header>

      {!p.tracked && <p className="flag">Below the tracking threshold ({sport === "NBA" ? `${ds.settings.nbaMinMinutes}+ avg minutes` : "1+ target, 1+ carry or a QB"}), so no ladder. Watching him adds one.</p>}

      {stats.length > 0 && (
        <nav className="chips" aria-label="Stat">
          {stats.map((st) => (
            <Link key={st} href={playerHref(sport, id, { stat: st })} className="fchip" aria-current={st === stat ? "true" : undefined} scroll={false}>
              {STAT_LABEL[st] ?? st}
            </Link>
          ))}
        </nav>
      )}

      {first && (
        <p className="small statline">
          <span>avg <b className="num">{first.avg}</b></span>
          <span>median <b className="num">{first.median}</b></span>
          <span className="muted">last 10: {first.last10_values_newest_first}</span>
          {first.limited_games_L10 > 0 && <span className="lim">⚠ {first.limited_games_L10} limited in L10</span>}
        </p>
      )}

      {ladder.length > 0 && (
        <div className="tablewrap">
          <table className="ladder">
            <thead>
              <tr><th scope="col">Line</th><th scope="col">L5</th><th scope="col">L10</th><th scope="col">Season</th><th scope="col">Home</th><th scope="col">Away</th><th scope="col">Streak</th></tr>
            </thead>
            <tbody>
              {ladder.map((h) => {
                const on = sel?._line === h._line;
                const cell = (txt: string, pct: number | null) => { const f = splitFrac(txt); return <td className={"cell " + heat(pct)}><b>{f.frac}</b><small>{f.pct}</small></td>; };
                return (
                  <tr key={h.line} className={on ? "sel" : undefined}>
                    <th scope="row">
                      <Link href={playerHref(sport, id, { stat, line: on ? undefined : h._line })} scroll={false} aria-pressed={on}>{h.line}</Link>
                    </th>
                    {cell(h.L5, h.L5_pct)}{cell(h.L10, h.L10_pct)}{cell(h.Season, h.season_pct)}{cell(h.Home, h.home_pct)}{cell(h.Away, h.away_pct)}
                    <td className={h.streak.startsWith("Hit") ? "streak hit" : "streak miss"}>{h.streak.replace("Hit ", "H").replace("Miss ", "M")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {ladder.length > 0 && (
        <div className="row-actions">
          {sel && lineEntry ? (
            <>
              <span className="small">{STAT_LABEL[stat!]} {sel.line}: hits marked in the log below.</span>
              <WatchButton entry={lineEntry} on={watchingLine} label="☆ Watch this line" offLabel="★ Watching this line" />
            </>
          ) : <span className="muted small">Tap a line to mark hits in the game log and to watch it.</span>}
        </div>
      )}

      <section className="block">
        <h3>Game log</h3>
        <p className="muted small">
          {logs.length} games · {notCounted} not counted (DNP / out / pending){limited ? ` · ${limited} limited ⚠` : ""}{unverified ? ` · ${unverified} unverified` : ""}
        </p>
        <div className="tablewrap">
          <table className="glog">
            <thead>
              <tr>
                <th scope="col">{sport === "NFL" ? "Wk" : "Date"}</th><th scope="col">Opp</th>
                {cols.map((c) => <th scope="col" key={c.key} className={c.stat && c.stat === stat ? "hl" : undefined}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {logs.map((r) => {
                const played = r.status === "PLAYED";
                const lim = r.limited_minutes === "Y" || r.limited_snaps === "Y";
                const bad = !isOk(r.check_status);
                const date = sport === "NFL" ? `${r.week}` : fmtDay(r.game_date);
                const v = field ? (r as unknown as Record<string, number | null>)[field] : null;
                const hitMark = sel && played && v !== null && v !== undefined ? (v >= sel._line ? "y" : "n") : "";
                return (
                  <tr key={r.game_id} className={[played ? "" : "out", bad ? "unv" : ""].join(" ")}>
                    <td className="d">
                      {date}{r.season_type !== "Regular" && <span className="tag">{r.season_type === "Postseason" ? "PO" : r.season_type}</span>}
                    </td>
                    <td className="o">{r.home_away === "A" ? "@" : "vs"} {r.opponent}<small>{r.team_result}</small></td>
                    {played ? cols.map((c) => {
                      const val = c.get(r);
                      const isSel = c.stat && c.stat === stat;
                      return (
                        <td key={c.key} className={[isSel ? "hl" : "", isSel && hitMark ? "hit-" + hitMark : ""].join(" ")}>
                          {val === null || val === undefined ? <span className="q" title="Unverified: left blank on purpose">?</span> : val}
                          {c.key === (sport === "NBA" ? "minutes" : "snap") && lim && <span className="lim" title={r.ejected === "Y" ? "Ejected" : "Limited: 35%+ below his average"}> ⚠</span>}
                        </td>
                      );
                    }) : (
                      <td colSpan={cols.length} className="why">
                        <b>{STATUS_TEXT[r.status] ?? r.status}</b> <span className="muted">{r.dnp_reason}</span> <span className="nc">not counted</span>
                      </td>
                    )}
                  </tr>
                );
              }).flatMap((tr, i) => {
                const r = logs[i];
                if (isOk(r.check_status)) return [tr];
                return [tr, (
                  <tr key={r.game_id + "-note"} className="note"><td colSpan={cols.length + 2}>⚑ {r.check_status}{r.check_note ? " — " + r.check_note : ""}</td></tr>
                )];
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small legend">⚠ limited (minutes or snap share 35%+ below his average, or ejected): counted, but flagged. <span className="q">?</span> a stat that failed a cross-check, left blank and not counted for that stat.</p>
      </section>
    </article>
  );
}
