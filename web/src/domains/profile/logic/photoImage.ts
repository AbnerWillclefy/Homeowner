/** The side, in pixels, of the square photo that is stored. */
export const PHOTO_SIZE = 512;

/** The largest photo the API accepts. The same number as `MaxBytes` in `backend/internal/photos`. */
export const MAX_PHOTO_BYTES = 524288;

/**
 * The encodings to try, in order: WebP, then JPEG (Safari ignores a WebP request and answers PNG), then a smaller
 * JPEG when the result is still over the limit. The API accepts exactly WebP and JPEG.
 */
export const ATTEMPTS = [
  ["image/webp", 0.85],
  ["image/jpeg", 0.85],
  ["image/jpeg", 0.7],
] as const;

export interface CropBox {
  sx: number;
  sy: number;
  size: number;
}

/** The centred square of an image, in the image's own pixels. An odd margin rounds down. */
export function cropBox(width: number, height: number): CropBox {
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

/** True when an encoded photo is worth sending: not empty and not over the API's limit. */
export function fitsLimit(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_PHOTO_BYTES;
}

/**
 * True when the canvas really produced the type that was asked for (it can answer another one, like PNG) and the
 * result fits the API's limit.
 */
export function isUsable(asked: string, blob: { type: string; size: number }): boolean {
  return blob.type === asked && fitsLimit(blob.size);
}
