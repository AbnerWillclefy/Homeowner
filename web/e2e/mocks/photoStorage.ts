import type { Fake } from "./router";

export const STORAGE_HOST = "photos.test";

export interface StoredRequest {
  method: string;
  url: string;
  contentType: string | null;
  /** The raw Authorization header: it must stay null, because the bearer token never goes to storage. */
  authorization: string | null;
  /** Every header the browser sent, lower-cased, to prove no extra one was added to the signed request. */
  headers: Record<string, string>;
}

export interface FakeStorage extends Fake {
  /** The PUTs received, in order (the CORS preflight is not counted). */
  puts: StoredRequest[];
  /** Answers the next PUT with this status; later ones answer 200 again. */
  failNext(status: number): void;
}

/** The presigned-URL host: accepts a PUT of the photo and answers 200, or the status set by `failNext`. */
export function createFakeStorage(): FakeStorage {
  const puts: StoredRequest[] = [];
  const failures: number[] = [];
  return {
    name: "storage",
    puts,
    failNext: (status) => void failures.push(status),
    matches: (url) => url.host === STORAGE_HOST,
    handle(request) {
      puts.push({
        method: request.method,
        url: request.url.toString(),
        contentType: request.headers["content-type"] ?? null,
        authorization: request.authorization,
        headers: request.headers,
      });
      return { status: failures.shift() ?? 200 };
    },
  };
}
