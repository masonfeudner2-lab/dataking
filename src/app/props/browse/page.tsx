import Link from "next/link";
import { AutoForm } from "@/components/props/AutoForm";
import { SPORT_STATS, type StatCode } from "@/lib/props/config";
import type { HitRow, Sport } from "@/lib/props/schema";
import { loadProps } from "@/lib/props/server";
import { heat, playerHref, splitFrac, STAT_LABEL } from "@/lib/props/view";

const WINDOWS = { L5: ["L5", "L5_pct"], L10: ["L10", "L10_pct"], Season: ["Season", "season_pct"], Home: ["Home", "home_pct"], Away: ["Away", "away_pct"] } as const;
type Win = keyof typeof WINDOWS;
const DEFAULT_LINE: Record<string, number> = { PTS: 20, REB: 6, AST: 4, "3PM": 2, PASS_YDS: 225, PASS_TD: 2, REC: 4, REC_YDS: 50, RUSH_YDS: 50 };

/** "8/10 – 80%" → hits, games */
const hn = (s: string) => { const m = /^(\d+)\/(\d+)/.exec(s); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const q = await searchParams;
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : q[k]) || "";
  const { ds } = await loadProps();
  const sport: Sport = one("sport") === "NFL" ? "NFL" : "NBA";
  const statList = SPORT_STATS[sport];
  const stat = (statList.includes(one("stat") as StatCode) ? one("stat") : statList[0]) as StatCode;
  const ladder = ds.settings.ladders[sport].find((l) => l.stat === stat);
  const lines = ladder?.lines ?? [];
  const line = lines.includes(Number(one("line"))) ? Number(one("line")) : lines.includes(DEFAULT_LINE[stat]) ? DEFAULT_LINE[stat] : lines[0];
  const win = (one("win") in WINDOWS ? one("win") : "L10") as Win;
  const minPct = one("min") === "" ? 80 : Math.max(0, Math.min(100, Number(one("min")) || 0));
  const minGames = one("games") === "" ? 5 : Math.max(1, Number(one("games")) || 1);
  const order = one("sort") === "low" ? "low" : "high";

  const [fracKey, pctKey] = WINDOWS[win];
  const hit = (sport === "NBA" ? ds.nba.hit : ds.nfl.hit) as HitRow[];
  const rows = hit
    .filter((h) => h.stat === stat && h._line === line)
    .filter((h) => hn(h[fracKey])[1] >= minGames && h[pctKey] !== null)
    .filter((h) => (order === "high" ? (h[pctKey] as number) >= minPct : (h[pctKey] as number) <= 100 - minPct))
    .sort((a, b) => {
      const d = (b[pctKey] as number) - (a[pctKey] as number);
      return (order === "high" ? d : -d) || hn(b[fracKey])[1] - hn(a[fracKey])[1] || (b.season_pct ?? 0) - (a.season_pct ?? 0) || a.player.localeCompare(b.player);
    });
  const watched = rows.filter((r) => r.watchlist === "Y");
  const shown = [...watched, ...rows.filter((r) => r.watchlist !== "Y")].slice(0, 300);
  const keyToId = new Map<string, string>();
  for (const [id, p] of Object.entries(sport === "NBA" ? ds.nba.P : ds.nfl.P)) if (p.key) keyToId.set(p.key, id);

  return (
    <>
      <AutoForm className="filters">
        <label>Sport
          <select name="sport" defaultValue={sport}><option>NBA</option><option>NFL</option></select>
        </label>
        <label>Stat
          <select name="stat" defaultValue={stat}>{statList.map((s) => <option key={s} value={s}>{STAT_LABEL[s]}</option>)}</select>
        </label>
        <label>Line
          <select name="line" defaultValue={String(line)}>
            <option value="" hidden>{line}+</option>
            {lines.map((l) => <option key={l} value={l}>{l}+</option>)}
          </select>
        </label>
        <label>Window
          <select name="win" defaultValue={win}>{Object.keys(WINDOWS).map((w) => <option key={w}>{w}</option>)}</select>
        </label>
        <label>{order === "high" ? "At least" : "At most"}
          <select name="min" defaultValue={String(minPct)}>
            {[0, 50, 60, 70, 80, 90, 100].map((m) => <option key={m} value={m}>{order === "high" ? m : 100 - m}%</option>)}
          </select>
        </label>
        <label>Min games
          <select name="games" defaultValue={String(minGames)}>{[1, 3, 5, 8, 10].map((g) => <option key={g} value={g}>{g}+</option>)}</select>
        </label>
        <label>Show
          <select name="sort" defaultValue={order}><option value="high">Hitting</option><option value="low">Missing</option></select>
        </label>
        <noscript><button className="btn" type="submit">Show</button></noscript>
      </AutoForm>

      <p className="small muted">
        {rows.length} {sport} players {order === "high" ? "hit" : "hit at most"} {STAT_LABEL[stat]} {line}+ in {order === "high" ? minPct : 100 - minPct}%{order === "high" ? "+" : ""} of their {win === "Season" ? "season" : win} games (min {minGames} games).
        {rows.length > shown.length && ` Showing the first ${shown.length}.`}
      </p>

      <div className="tablewrap">
        <table className="browse">
          <thead>
            <tr><th scope="col">Player</th><th scope="col" className="hl">{win}</th>{(Object.keys(WINDOWS) as Win[]).filter((w) => w !== win).map((w) => <th scope="col" key={w} className={w === "Home" || w === "Away" ? "wide-only" : undefined}>{w}</th>)}<th scope="col">Strk</th><th scope="col">Avg</th></tr>
          </thead>
          <tbody>
            {shown.map((h) => {
              const id = keyToId.get(h.player_key);
              const main = splitFrac(h[fracKey]);
              return (
                <tr key={h.player_key} className={h.watchlist === "Y" ? "watched" : undefined}>
                  <th scope="row">
                    {id ? <Link href={playerHref(sport, id, { stat, line })}>{h.watchlist === "Y" ? "★ " : ""}{h.player}</Link> : h.player}
                    <small>{h.team}{h.position ? " · " + h.position : ""}{h.limited_games_L10 ? ` · ⚠${h.limited_games_L10}` : ""}</small>
                  </th>
                  <td className={"cell big " + heat(h[pctKey] as number)}><b>{main.frac}</b><small>{main.pct}</small></td>
                  {(Object.keys(WINDOWS) as Win[]).filter((w) => w !== win).map((w) => (
                    <td key={w} className={(w === "Home" || w === "Away" ? "wide-only " : "") + "cell " + heat(h[WINDOWS[w][1]] as number | null)}><b>{splitFrac(h[WINDOWS[w][0]]).frac}</b></td>
                  ))}
                  <td className={h.streak.startsWith("Hit") ? "streak hit" : "streak miss"}>{h.streak.replace("Hit ", "H").replace("Miss ", "M")}</td>
                  <td className="num-c">{h.avg}</td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={8} className="muted pad">No players match. Lower the hit rate or games filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
