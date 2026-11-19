// Scheduled update. Usage: npx tsx scripts/update.ts nba|nfl|both
// Reads/writes data/live (committed by the GitHub Actions workflow). Settings: data/settings.csv.
import { readFileSync } from "node:fs";
import { loadSettingsCsv } from "../src/lib/props/csv";
import { LiveStore } from "../src/lib/props/ingest/files";
import { updateNba, updateNfl } from "../src/lib/props/ingest/update";

const which = (process.argv[2] || "both").toLowerCase();
const cfg = loadSettingsCsv(readFileSync("data/settings.csv", "utf8"));
const store = new LiveStore();

async function main() {
  let failed = false;
  for (const sport of ["nba", "nfl"] as const) {
    if (which !== sport && which !== "both") continue;
    const r = sport === "nba" ? await updateNba(store, cfg, []) : await updateNfl(store, cfg, []);
    console.log(`\n== ${sport.toUpperCase()}: ${r.info.message}`);
    for (const [sec, item, detail] of r.items) console.log(`${sec.padEnd(16)} ${item} — ${detail.slice(0, 200)}`);
    if (!r.info.ok) failed = true;
  }
  // a partial run still saves what it got; the exit code just makes the problem visible in GitHub
  if (failed) process.exitCode = 1;
}
main();
