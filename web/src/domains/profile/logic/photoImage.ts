/** The side, in pixels, of the square photo that is stored. */
export const PHOTO_SIZE = 512;

/** The largest photo the API accepts. The same number as `MaxBytes` in `backend/internal/photos`. */
export const MAX_PHOTO_BYTES = 524288;

export const JPEG_QUALITY = 0.85;
/** The second, smaller try when a JPEG is still over the limit. */
export const JPEG_RETRY_QUALITY = 0.7;

export interface CropBox {
  sx: number;
  sy: number;
  size: number;
}

export interface Encoding {
  type: "image/webp" | "image/jpeg";
  quality: number;
}

/** The centred square of an image, in the image's own pixels. An odd margin rounds down. */
export function cropBox(width: number, height: number): CropBox {
  const size = Math.min(width, height);
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

/**
 * How to keep the result, given the type the canvas actually produced. We always ask for WebP, but Safari ignores
 * that and answers PNG (and a canvas can answer anything), so WebP is kept only when the browser really made it;
 * every other answer is encoded again as JPEG, which the API also accepts.
 */
export function pickEncoding(blobType: string): Encoding {
  return blobType === "image/webp" ? { type: "image/webp", quality: JPEG_QUALITY } : { type: "image/jpeg", quality: JPEG_QUALITY };
}

/** True when an encoded photo is worth sending: not empty and not over the API's limit. */
export function fitsLimit(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_PHOTO_BYTES;
}
