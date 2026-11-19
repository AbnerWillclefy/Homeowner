/** The most the API takes is 1.5 MB; a little under it. */
export const MAX_BYTES = 1_500_000;

/** Long sides to try: receipts are long and their text must stay legible, so the first is generous. */
const SIDES = [2400, 1600];
const QUALITIES = [0.85, 0.7, 0.55];

/** A decoded photo that can draw itself at a size. The browser one is `decodeFile`; tests pass a stub. */
export interface Source {
  width: number;
  height: number;
  /** A JPEG of the photo at `width` x `height`, or null when the browser cannot encode it. */
  encode(width: number, height: number, quality: number): Promise<Blob | null>;
}

/** A JPEG of at most `MAX_BYTES`, or null when none of the sizes and qualities fits. */
export async function downsize(source: Source): Promise<Blob | null> {
  for (const side of SIDES) {
    const scale = Math.min(1, side / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    for (const quality of QUALITIES) {
      const blob = await source.encode(width, height, quality);
      if (!blob) return null;
      if (blob.size <= MAX_BYTES) return blob;
    }
  }
  return null;
}

/** Decodes a chosen file, applying its EXIF rotation (phone photos carry one). Throws when it is not an image. */
export async function decodeFile(file: Blob): Promise<Source> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return {
    width: bitmap.width,
    height: bitmap.height,
    encode(width, height, quality) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
      return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    },
  };
}
