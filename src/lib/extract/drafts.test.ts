import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/mock";
import { draftsFromExtraction, slipFromDrafts } from "./drafts";
import { SAMPLE_EXTRACTION } from "./sample";

describe("drafts from a slip read", async () => {
  const games = await new MockProvider().listGames("2026-11-07", { simMinute: 0 });
  const drafts = draftsFromExtraction(SAMPLE_EXTRACTION, games);
  const by = (pick: string) => drafts.find((d) => d.pick === pick)!;

  it("keeps every leg, in order", () => {
    expect(drafts.map((d) => d.pick)).toEqual(SAMPLE_EXTRACTION.legs.map((l) => l.pick));
  });

  it("a cut-off opponent that the schedule settles is filled in, not flagged", () => {
    const d = by("Prairie View A&M");
    expect(d).toMatchObject({ gameId: "m-pvamu-sou", opponent: "Southern", flags: [] });
    expect(d.note).toMatch(/filled in/);
  });

  it("clean legs have no flags", () => {
    expect(by("Miss. Valley St.").flags).toEqual([]);
    expect(by("Over").flags).toEqual([]);
  });

  it("ambiguous and unmatched legs stay flagged with reasons", () => {
    expect(by("Prairie View").flags.length).toBeGreaterThan(0);
    expect(by("Prairie View").gameId).toBeNull();
    expect(by("Jalen Hurts").flags.join(" ")).toMatch(/game/i);
  });

  it("the AI's own flag survives when matching didn't settle it", () => {
    expect(by("Montana St...").gameId).toBe("m-mont-mtst");
    expect(by("Montana St...").flags).toContain("Team name is cut off on the slip.");
  });

  it("saving drops the review details and blank legs", () => {
    const slip = slipFromDrafts([...drafts, { ...drafts[0], id: "blank", pick: "  " }], "Kalshi");
    expect(slip.legs).toHaveLength(drafts.length);
    expect(slip.source).toBe("Kalshi");
    expect(Object.keys(slip.legs[0])).not.toContain("flags");
  });
});

describe("duplicate legs", async () => {
  const { findDuplicates } = await import("./drafts");
  const games = await new MockProvider().listGames("2026-11-07", { simMinute: 0 });
  const drafts = draftsFromExtraction(SAMPLE_EXTRACTION, games);

  it("the sample has none", () => {
    expect(findDuplicates(drafts).size).toBe(0);
  });

  it("flags a leg that repeats an earlier one, even if the slip spelled it differently", () => {
    const pvA = drafts.find((d) => d.pick === "Prairie View A&M")!;
    const copy = { ...pvA, id: "copy", pick: "Prairie View" };
    expect(findDuplicates([...drafts, copy]).get("copy")).toBe(1);
  });

  it("same team, different bet type is not a duplicate", () => {
    const pvA = drafts.find((d) => d.pick === "Prairie View A&M")!;
    const spread = { ...pvA, id: "sp", betType: "spread" as const, line: "+3.5" };
    expect(findDuplicates([...drafts, spread]).has("sp")).toBe(false);
  });
});

describe("duplicate legs after editing", async () => {
  const { findDuplicates } = await import("./drafts");
  const games = await new MockProvider().listGames("2026-11-07", { simMinute: 0 });
  const drafts = draftsFromExtraction(SAMPLE_EXTRACTION, games);
  it("a spread switched to 'to win' is compared without its old line", () => {
    const pvA = drafts.find((d) => d.pick === "Prairie View A&M")!;
    const edited = { ...pvA, id: "edited", pick: "Prairie View", line: "-3.5" };
    expect(findDuplicates([...drafts, edited]).get("edited")).toBe(1);
  });
});
