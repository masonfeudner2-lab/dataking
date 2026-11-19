import type { Metadata } from "next";
import Link from "next/link";
import { PropsNav } from "@/components/props/PropsNav";
import { loadProps } from "@/lib/props/server";
import { fmtDay, fmtPt } from "@/lib/props/view";

export const metadata: Metadata = { title: "Hit rates · Dataking", description: "How often every NBA and NFL player clears each stat line." };

export default async function PropsLayout({ children }: { children: React.ReactNode }) {
  const { ds } = await loadProps();
  return (
    <main className="props">
      <header className="top">
        <h1>Hit rates</h1>
        <Link className="btn ghost small-btn" href="/">Parlay board</Link>
      </header>
      <PropsNav />
      <div className="fresh" role="status">
        {(["NBA", "NFL"] as const).map((s) => (
          <span key={s} className="fresh-item">
            <b>{s}</b> updated {fmtPt(ds.meta[s].lastUpdatedUtc)} · games thru {fmtDay(ds.meta[s].lastGameDate)}
            {ds.meta[s].lastRunProblem && <span className="badge warn" title={ds.meta[s].lastRunProblem!}>last update incomplete, retrying</span>}
            {ds.meta[s].unverifiedRows > 0 && (
              <Link href="/props/summary#unverified" className="badge warn">{ds.meta[s].unverifiedRows} unverified</Link>
            )}
          </span>
        ))}
        {ds.isSnapshot && <span className="fresh-item snap">Preview data: your Sheet’s Nov 18 snapshot. Not updating yet.</span>}
      </div>
      {children}
    </main>
  );
}
