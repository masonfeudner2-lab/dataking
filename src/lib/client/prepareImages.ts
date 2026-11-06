"use client";

// Phone screenshots are big (often 2–5 MB each), and a 15–20 leg slip can be a very tall image.
// Before uploading we shrink each screenshot and cut tall ones into overlapping pieces, so:
//  - the text stays sharp enough for Claude to read (one giant tall image gets scaled down a lot),
//  - the upload stays under the hosting limit (about 4.5 MB per request on Vercel),
//  - it costs less to read.

const TARGET_WIDTH = 1000; // px
const PIECE_HEIGHT = 1800; // px
const OVERLAP = 160; // px repeated between pieces so no leg gets cut in half
export const MAX_PIECES = 12;

export interface PreparedImage {
  data: string; // base64, no "data:" prefix
  mediaType: "image/jpeg";
}

async function toBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("unreadable");
  }
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export async function prepareImages(files: File[]): Promise<PreparedImage[]> {
  const out: PreparedImage[] = [];
  for (const file of files) {
    const bmp = await toBitmap(file);
    const scale = Math.min(1, TARGET_WIDTH / bmp.width);
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    for (let top = 0; top < h; top += PIECE_HEIGHT - OVERLAP) {
      const ph = Math.min(PIECE_HEIGHT, h - top);
      if (top > 0 && ph <= OVERLAP) break; // only overlap left: nothing new
      const c = document.createElement("canvas");
      c.width = w;
      c.height = ph;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, ph);
      ctx.drawImage(bmp, 0, top / scale, bmp.width, ph / scale, 0, 0, w, ph);
      out.push({ data: canvasToBase64(c), mediaType: "image/jpeg" });
      if (out.length > MAX_PIECES) throw new Error("too_long");
      if (top + ph >= h) break;
    }
    bmp.close();
  }
  return out;
}
