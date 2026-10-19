import { ATTEMPTS, cropBox, isUsable, PHOTO_SIZE } from "./photoImage";

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

/** The first attempt of `ATTEMPTS` that the browser really produced and that fits the API's limit, or null. */
async function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
  for (const [type, quality] of ATTEMPTS) {
    const blob = await toBlob(canvas, type, quality);
    if (blob !== null && isUsable(type, blob)) return blob;
  }
  return null;
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
