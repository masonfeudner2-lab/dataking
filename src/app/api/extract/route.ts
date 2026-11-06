import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { EXTRACTION_SYSTEM, EXTRACTION_USER } from "@/lib/extract/prompt";
import { ExtractionSchema, type ExtractErrorCode, type ExtractResponse } from "@/lib/extract/schema";

// POST /api/extract  { images: [{ data: <base64>, mediaType: "image/jpeg" }] }
// Sends the slip screenshot(s) to Claude and returns the legs as JSON.
// The API key lives only on the server (ANTHROPIC_API_KEY); the browser never sees it.

export const maxDuration = 60; // seconds; reading a long slip can take a while

const MODEL = "claude-opus-5-5";
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 1_500_000; // per piece, after the browser shrinks it
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const fail = (code: ExtractErrorCode, message: string, status: number) =>
  NextResponse.json<ExtractResponse>({ ok: false, code, message }, { status });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("not_configured", "Slip reading isn't switched on yet: the server has no Claude API key.", 503);
  }

  // Optional: once the app has a public link, a shared passcode stops strangers from
  // spending your Claude credit.
  const passcode = process.env.SLIP_READER_PASSCODE;
  if (passcode && req.headers.get("x-passcode") !== passcode) {
    return fail("passcode", "Enter the passcode to read slips.", 401);
  }

  let images: { data: string; mediaType: MediaType }[];
  try {
    const body = await req.json();
    images = body?.images;
    if (!Array.isArray(images) || images.length < 1 || images.length > MAX_IMAGES) throw new Error("count");
    for (const img of images) {
      if (typeof img?.data !== "string" || !MEDIA_TYPES.includes(img.mediaType)) throw new Error("shape");
      if ((img.data.length * 3) / 4 > MAX_IMAGE_BYTES) throw new Error("size");
    }
  } catch {
    return fail("bad_request", "That upload couldn't be read. Try a PNG or JPG screenshot.", 400);
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety check declines the request, the API retries it on its recommended
      // fallback model instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(ExtractionSchema) },
      system: EXTRACTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
            })),
            { type: "text" as const, text: EXTRACTION_USER(images.length) },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return fail("refused", "This image couldn't be processed. Try a different screenshot.", 422);
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = ExtractionSchema.safeParse(safeJson(text));
    if (!parsed.success) {
      return fail("invalid_output", "The slip couldn't be read cleanly. Try again, or crop closer to the legs.", 502);
    }
    if (!parsed.data.legs.length) {
      return fail("no_legs", "No bet legs found in that image. Try a tighter screenshot of the slip.", 422);
    }
    console.info(`[extract] ${images.length} image(s), ${parsed.data.legs.length} legs, usage`, response.usage);
    return NextResponse.json<ExtractResponse>({ ok: true, extraction: parsed.data });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return fail("rate_limited", "Too many reads in a short time. Wait a minute and try again.", 429);
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("[extract] Claude API key rejected");
      return fail("not_configured", "The server's Claude API key was rejected. Check ANTHROPIC_API_KEY.", 503);
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("[extract] bad request", err.message);
      return fail("bad_request", "That image couldn't be read. Try a PNG or JPG screenshot.", 400);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[extract] API error", err.status, err.message);
    } else {
      console.error("[extract] unexpected error", err);
    }
    return fail("failed", "Something interrupted the read. Try again.", 502);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
