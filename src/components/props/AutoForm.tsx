"use client";

/** A GET form that re-submits whenever a field changes (still works without JavaScript via its button). */
export function AutoForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form method="get" className={className} onChange={(e) => {
      const f = e.currentTarget;
      // changing the stat resets the line to that stat's default
      if ((e.target as HTMLElement).getAttribute("name") === "stat") { const l = f.elements.namedItem("line") as HTMLSelectElement | null; if (l) l.value = ""; }
      // picking a team shows its whole roster (any hit rate, 1+ games); clearing it goes back to the defaults
      if ((e.target as HTMLElement).getAttribute("name") === "team") {
        const on = (e.target as unknown as HTMLSelectElement).value !== "";
        const min = f.elements.namedItem("min") as HTMLSelectElement | null; if (min) min.value = on ? "0" : "80";
        const games = f.elements.namedItem("games") as HTMLSelectElement | null; if (games) games.value = on ? "1" : "5";
      }
      if ((e.target as HTMLElement).getAttribute("name") === "sport") {
        const tm = f.elements.namedItem("team") as HTMLSelectElement | null;
        if (tm?.value) { // leaving a team view: back to the normal filters
          const min = f.elements.namedItem("min") as HTMLSelectElement | null; if (min) min.value = "80";
          const games = f.elements.namedItem("games") as HTMLSelectElement | null; if (games) games.value = "5";
        }
        for (const n of ["stat", "line", "team"]) { const el = f.elements.namedItem(n) as HTMLSelectElement | null; if (el) el.value = ""; } }
      f.requestSubmit();
    }}>
      {children}
    </form>
  );
}
