import { authedRequest } from "../../auth/api/client";

/** What `POST /me/photo/uploads` hands out: where to send the photo and exactly how. */
export interface Upload {
  /** The pending object's key, which `PUT /me/photo` confirms. */
  key: string;
  url: string;
  method: string;
  headers: Record<string, string>;
}

type Failure =
  | { kind: "not-signed-in" }
  /** The service could not be reached. */
  | { kind: "offline" }
  /** 503: photos are switched off on the server. */
  | { kind: "photos-off" }
  | { kind: "error" };

export type RequestUploadResult = { kind: "ok"; upload: Upload } | Failure;
export type PutResult = { kind: "ok" } | { kind: "offline" } | { kind: "error" };
/** `photoUrl` is the public URL of the new photo. A 200 without one is an `error`, never a saved photo. */
export type ConfirmResult = { kind: "ok"; photoUrl: string } | Failure;
export type RemoveResult = { kind: "ok" } | Failure;

/** An Upload from the API's answer, or null when it is not one. */
export function parseUpload(raw: unknown): Upload | null {
  const body = typeof raw === "object" ? (raw as Record<string, unknown> | null) : null;
  const { key, url, method, headers } = body ?? {};
  if (typeof key !== "string" || typeof url !== "string" || typeof method !== "string") return null;
  if (key === "" || url === "" || method === "") return null;
  if (typeof headers !== "object" || headers === null) return null;
  const sent: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== "string") return null;
    sent[name] = value;
  }
  return { key, url, method, headers: sent };
}

/** The failure for an answer that was not the success status, or `error`. */
function failure(status: number): Failure {
  return status === 503 ? { kind: "photos-off" } : { kind: "error" };
}

/** Step 1, ask: a short-lived upload for a photo of this type and size. */
export async function requestUpload(contentType: string, size: number): Promise<RequestUploadResult> {
  try {
    const result = await authedRequest({
      url: "/me/photo/uploads",
      method: "POST",
      data: { contentType, size },
    });
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return failure(result.response.status);
    const upload = parseUpload(result.response.data);
    return upload === null ? { kind: "error" } : { kind: "ok", upload };
  } catch {
    return { kind: "offline" };
  }
}

/**
 * Step 2, put: the photo goes straight to storage. This is plain `fetch`, never the Axios client
 * (`authedRequest` or `httpClient`): the bearer token must not be sent to S3, and any header beyond the ones the
 * API returned would break the signature. The browser sets Content-Length from the blob, which the signature binds.
 */
export async function putToStorage(upload: Pick<Upload, "url" | "method" | "headers">, blob: Blob): Promise<PutResult> {
  try {
    const response = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: blob });
    return response.ok ? { kind: "ok" } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Step 3, confirm: the API checks the object and makes it the User's photo. */
export async function confirmUpload(key: string): Promise<ConfirmResult> {
  try {
    const result = await authedRequest({
      url: "/me/photo",
      method: "PUT",
      data: { key },
    });
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return failure(result.response.status);
    const body: unknown = result.response.data;
    const photoUrl = typeof body === "object" && body !== null && "photoUrl" in body ? body.photoUrl : undefined;
    return typeof photoUrl === "string" && photoUrl !== "" ? { kind: "ok", photoUrl } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Removes the photo. Idempotent on the API. */
export async function removePhoto(): Promise<RemoveResult> {
  try {
    const result = await authedRequest({ url: "/me/photo", method: "DELETE" });
    if (result.kind === "not-signed-in") return result;
    return result.response.status === 204 ? { kind: "ok" } : failure(result.response.status);
  } catch {
    return { kind: "offline" };
  }
}
