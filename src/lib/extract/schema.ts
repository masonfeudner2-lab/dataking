import { z } from "zod";

// The exact shape Claude must return when reading a slip (your spec). Structured outputs make
// the API guarantee this shape; we validate again on our side anyway.
export const ExtractedLegSchema = z.object({
  pick: z.string(),
  opponent: z.string().nullable(),
  league: z.string(),
  bet_type: z.enum(["moneyline", "spread", "total", "prop", "other"]),
  line: z.string(),
  price: z.string(),
  needs_review: z.boolean(),
  review_reason: z.string(),
});

export const ExtractionSchema = z.object({
  source: z.string(),
  legs: z.array(ExtractedLegSchema),
});

export type ExtractedLeg = z.infer<typeof ExtractedLegSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;

/** What /api/extract returns. */
export type ExtractResponse =
  | { ok: true; extraction: Extraction }
  | { ok: false; code: ExtractErrorCode; message: string };

export type ExtractErrorCode =
  | "not_configured"
  | "passcode"
  | "bad_request"
  | "no_legs"
  | "refused"
  | "rate_limited"
  | "invalid_output"
  | "failed";
