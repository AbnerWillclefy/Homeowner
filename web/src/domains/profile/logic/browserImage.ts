import { cropBox, fitsLimit, JPEG_QUALITY, JPEG_RETRY_QUALITY, PHOTO_SIZE, pickEncoding } from "./photoImage";

export type PreparedPhoto =
  | { kind: "ok"; blob: Blob }
  /** The file is not an image, or this browser cannot decode it (for example a HEIC photo outside Safari). */
  | { kind: "unreadable" }
  /** The browser could not make a photo within the API's limit. */
  | { kind: "failed" };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draws the centred square of the bitmap onto a 512x512 canvas. */
function drawSquare(bitmap: ImageBitmap): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  // JPEG has no transparency: a transparent PNG would turn black without a background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  const { sx, sy, size } = cropBox(bitmap.width, bitmap.height);
  context.drawImage(bitmap, sx, sy, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  return canvas;
}

/**
 * Encodes the canvas as WebP, or as JPEG when the browser did not really produce WebP (Safari ignores the request
 * and answers PNG, so the type of the blob is what tells). A result over the API's limit gets one smaller JPEG try.
 */
async function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const first = await toBlob(canvas, "image/webp", JPEG_QUALITY);
  let blob = first;
  if (first !== null) {
    const encoding = pickEncoding(first.type);
    if (encoding.type !== first.type) blob = await toBlob(canvas, encoding.type, encoding.quality);
  }
  if (blob !== null && fitsLimit(blob.size)) return blob;
  const smaller = await toBlob(canvas, "image/jpeg", JPEG_RETRY_QUALITY);
  return smaller !== null && fitsLimit(smaller.size) ? smaller : null;
}

/**
 * Turns a picked file into the square 512px photo to upload. `createImageBitmap` is asked for the EXIF
 * orientation explicitly, so a portrait phone photo comes out upright. The bitmap is closed as soon as it is
 * drawn, so a 48 MP photo does not stay in memory.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { kind: "unreadable" };
  }
  try {
    const canvas = drawSquare(bitmap);
    if (canvas === null) return { kind: "failed" };
    const blob = await encode(canvas);
    return blob === null ? { kind: "failed" } : { kind: "ok", blob };
  } finally {
    bitmap.close();
  }
}
