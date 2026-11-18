"use client";

/** A GET form that re-submits whenever a field changes (still works without JavaScript via its button). */
export function AutoForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form method="get" className={className} onChange={(e) => {
      const f = e.currentTarget;
      // changing the stat resets the line to that stat's default
      if ((e.target as HTMLElement).getAttribute("name") === "stat") { const l = f.elements.namedItem("line") as HTMLSelectElement | null; if (l) l.value = ""; }
      if ((e.target as HTMLElement).getAttribute("name") === "sport") { for (const n of ["stat", "line"]) { const el = f.elements.namedItem(n) as HTMLSelectElement | null; if (el) el.value = ""; } }
      f.requestSubmit();
    }}>
      {children}
    </form>
  );
}
