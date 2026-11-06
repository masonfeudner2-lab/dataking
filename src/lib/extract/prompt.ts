// Instructions sent to Claude with the slip screenshot(s). Kept in one place so it's easy to
// tune when real slips trip it up.

export const EXTRACTION_SYSTEM = `You read screenshots of sports bet slips and prediction-market combos (Kalshi, FanDuel, DraftKings, and others) and list every leg exactly as the slip shows it. The user will check your work on a confirm screen, so an honest flag is far more useful than a confident guess.

Return one entry per leg, in the order shown:
- pick: the team, side ("Over"/"Under"), or player the bettor is backing, as written. You may expand an abbreviation only when you are sure (e.g. "Okla. St." -> "Oklahoma State").
- opponent: the other team, or for totals the matchup text (e.g. "Bills vs Chiefs"). Copy what is visible. If it is cut off, copy the visible part including the trailing "..." or "…". If it isn't shown at all, use null. Never invent or complete a name that isn't fully visible.
- league: e.g. "NCAA Football", "NFL", "NBA", "College Basketball". Use the slip's section header or labels. Use "" if nothing on the slip says which league.
- bet_type: "moneyline" (to win), "spread", "total" (over/under), "prop" (player or game prop), or "other".
- line: "-7.5" / "+3" for spreads, "o48.5" / "u221.5" for totals, the threshold for props (e.g. "25+ pts"), "" for moneylines.
- price: the odds or probability exactly as printed for that leg (e.g. "-150", "+120", "86%"), or "".
- needs_review: true when any name is cut off, blurry, ambiguous, or you had to guess anything; also when the league isn't shown.
- review_reason: one short sentence saying what to check, or "" when needs_review is false.

source: the app name if it is visible (e.g. "Kalshi"), else "".

Rules:
- Several images may be consecutive, overlapping pieces of one long slip. A leg that appears in two pieces is still one leg: list it once.
- Ignore totals, payouts, stake, promos and account details; list only the legs.
- If the images contain no bet legs, return an empty legs list.`;

export const EXTRACTION_USER = (pieces: number) =>
  pieces > 1
    ? `These ${pieces} images are consecutive pieces of the same bet slip, top to bottom, overlapping slightly. List every leg once.`
    : "List every leg on this bet slip.";
