// Small, browser-safe bits of the mock provider (the demo clock needs these).

/** Where the demo clock starts: a mix of final, live and upcoming games. */
export const DEFAULT_SIM_MINUTE = 280;

/** The fake slate starts at 18:00 UTC (10–11am in California) on the requested date. */
export function slateStart(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 18, 0));
}
