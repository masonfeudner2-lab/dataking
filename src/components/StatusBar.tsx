import { statusLine, type SlipSummary } from "@/lib/grading";

const VERDICT: Record<SlipSummary["verdict"], string> = {
  open: "Still alive",
  won: "Slip won",
  lost: "Slip lost",
  push: "Slip pushed",
};

export function StatusBar({ summary, source }: { summary: SlipSummary; source: string }) {
  const verdict = summary.verdict === "open" && summary.lost === 0 ? "open" : summary.verdict;
  return (
    <section className="bar" aria-live="polite">
      <div className="bar-row">
        <span className="num big">
          {summary.won}
          <small>/{summary.total}</small>
        </span>
        <div className="bar-text">
          <b>{statusLine(summary)}</b>
          <span className={`pill ${verdict}`}>{VERDICT[verdict]}</span>
        </div>
      </div>
      <div className="meter" aria-hidden>
        {(["won", "lost", "push", "live", "notStarted", "needsGrade"] as const).map((k) =>
          summary[k] ? <span key={k} className={`seg ${k}`} style={{ flexGrow: summary[k] }} /> : null,
        )}
      </div>
      {source && <p className="muted small">{source}</p>}
    </section>
  );
}
