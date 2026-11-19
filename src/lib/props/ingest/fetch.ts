// HTTP helpers for the update job: parallel batches (like UrlFetchApp.fetchAll), retries, never throws.

export interface FetchResult<T> { url: string; ok: boolean; code: number; body: T | null }

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; prop-tracker/1.0)", Accept: "application/json, text/csv, */*" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once(url: string, asJson: boolean): Promise<FetchResult<unknown>> {
  try {
    const r = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(30000) });
    if (!r.ok) return { url, ok: false, code: r.status, body: null };
    const t = await r.text();
    if (!asJson) return { url, ok: true, code: r.status, body: t };
    try { return { url, ok: true, code: r.status, body: JSON.parse(t) }; } catch { return { url, ok: false, code: r.status, body: null }; }
  } catch {
    return { url, ok: false, code: 0, body: null };
  }
}

/** One URL, with up to 2 retries on network errors / 5xx / 429. */
export async function fetchOne<T = unknown>(url: string, asJson = true): Promise<FetchResult<T>> {
  let res = await once(url, asJson);
  for (let i = 0; i < 2 && !res.ok && (res.code === 0 || res.code === 429 || res.code >= 500); i++) {
    await sleep(1500 * (i + 1));
    res = await once(url, asJson);
  }
  return res as FetchResult<T>;
}

/** Many URLs, 12 at a time, results in input order. */
export async function fetchAll<T = unknown>(urls: string[], asJson = true): Promise<FetchResult<T>[]> {
  const out: FetchResult<T>[] = [];
  for (let i = 0; i < urls.length; i += 12) {
    out.push(...(await Promise.all(urls.slice(i, i + 12).map((u) => fetchOne<T>(u, asJson)))));
    if (i + 12 < urls.length) await sleep(250);
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Box score with fallback: ESPN site.web.api summary, then the ESPN cdn game package. null = not available. */
export async function fetchBoxes(sport: "NBA" | "NFL", ids: string[]): Promise<(any | null)[]> {
  const lg = sport === "NBA" ? "basketball/nba" : "football/nfl";
  const first = await fetchAll<any>(ids.map((id) => `https://site.web.api.espn.com/apis/site/v2/sports/${lg}/summary?event=${id}`));
  const out = first.map((r) => (r.ok && r.body?.boxscore?.players ? r.body : null));
  const miss = ids.filter((_, i) => !out[i]);
  if (miss.length) {
    const second = await fetchAll<any>(miss.map((id) => `https://cdn.espn.com/core/${sport.toLowerCase()}/boxscore?xhr=1&gameId=${id}`));
    second.forEach((r, j) => {
      const gp = r.ok && r.body?.gamepackageJSON;
      if (gp?.boxscore?.players) out[ids.indexOf(miss[j])] = gp;
    });
  }
  return out;
}
