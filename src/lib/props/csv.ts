// Minimal RFC 4180 CSV reader/writer + loaders that turn Sheet exports into typed log rows.
import { buildSettings, type LadderInput, type Settings } from "./config";
import { NBA_NUM_COLS, NFL_NUM_COLS, type NbaLogRow, type NflLogRow } from "./schema";
import { num } from "./util";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function csvObjects(text: string): Record<string, string>[] {
  const [head, ...rest] = parseCsv(text);
  return rest.filter((r) => r.length > 1 || r[0] !== "").map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

export function toCsv(cols: readonly string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

function typed<T>(r: Record<string, string>, numCols: readonly string[]): T {
  const o: Record<string, unknown> = { ...r };
  for (const c of numCols) o[c] = num(r[c]);
  return o as T;
}

export const loadNbaLogs = (text: string) => csvObjects(text).map((r) => typed<NbaLogRow>(r, NBA_NUM_COLS));
export const loadNflLogs = (text: string) => csvObjects(text).map((r) => typed<NflLogRow>(r, NFL_NUM_COLS));

/** The Settings tab: ladders in columns A–E, name/value settings in columns G–H. */
export function loadSettingsCsv(text: string): Settings {
  const [, ...rows] = parseCsv(text);
  const ladders: LadderInput[] = []; const kv: Record<string, string> = {};
  for (const r of rows) {
    if (r[0] && r[1]) ladders.push({ sport: r[0], stat: r[1], label: r[2], lines: r[3], applies: r[4] });
    if (r[6]) kv[r[6]] = r[7];
  }
  return buildSettings(ladders, kv);
}
