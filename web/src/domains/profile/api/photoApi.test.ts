import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import { confirmUpload, parseUpload, putToStorage, removePhoto, requestUpload } from "./photoApi";

function stubStorage() {
  const data = new Map<string, string>();
  data.set(SESSION_KEY, JSON.stringify({ idToken: "id-1", refreshToken: "rt-1", expiresAt: Date.now() + 3600_000 }));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
}

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const UPLOAD = {
  key: "pending/user-1/abc",
  url: "https://photos.test/put",
  method: "PUT",
  headers: { "Content-Type": "image/webp" },
  expiresAt: "2030-01-01T00:00:00Z",
};

beforeEach(stubStorage);
afterEach(() => vi.unstubAllGlobals());

describe("parseUpload", () => {
  it("reads the key, url, method and headers", () => {
    expect(parseUpload(UPLOAD)).toEqual({ key: UPLOAD.key, url: UPLOAD.url, method: "PUT", headers: UPLOAD.headers });
  });

  it("refuses a body that is missing a field or has a non-string header", () => {
    expect(parseUpload(null)).toBeNull();
    expect(parseUpload({ ...UPLOAD, key: "" })).toBeNull();
    expect(parseUpload({ ...UPLOAD, headers: { a: 1 } })).toBeNull();
    expect(parseUpload({ ...UPLOAD, headers: null })).toBeNull();
  });
});

describe("requestUpload", () => {
  it("posts the content type and size and returns the upload", async () => {
    const fetch = stubFetch(new Response(JSON.stringify(UPLOAD), { status: 200 }));
    const result = await requestUpload("image/webp", 1234);
    expect(result.kind).toBe("ok");
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toMatch(/\/me\/photo\/uploads$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ contentType: "image/webp", size: 1234 });
  });

  it("maps 503 to photos-off and other statuses to error", async () => {
    stubFetch(new Response(null, { status: 503 }));
    expect(await requestUpload("image/webp", 1)).toEqual({ kind: "photos-off" });
    stubFetch(new Response(null, { status: 400 }));
    expect(await requestUpload("image/webp", 1)).toEqual({ kind: "error" });
  });

  it("is offline when the request throws", async () => {
    stubFetch(new TypeError("network"));
    expect(await requestUpload("image/webp", 1)).toEqual({ kind: "offline" });
  });
});

describe("putToStorage", () => {
  it("sends the blob with exactly the returned headers and never the bearer token", async () => {
    const fetch = stubFetch(new Response(null, { status: 200 }));
    const blob = new Blob(["x"], { type: "image/webp" });
    expect(await putToStorage(UPLOAD, blob)).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(UPLOAD.url);
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({ "Content-Type": "image/webp" });
    expect(init?.body).toBe(blob);
  });

  it("maps a refusal to error and a thrown request to offline", async () => {
    stubFetch(new Response(null, { status: 403 }));
    expect(await putToStorage(UPLOAD, new Blob(["x"]))).toEqual({ kind: "error" });
    stubFetch(new TypeError("network"));
    expect(await putToStorage(UPLOAD, new Blob(["x"]))).toEqual({ kind: "offline" });
  });
});

describe("confirmUpload", () => {
  it("sends the key and returns the new photo URL", async () => {
    const fetch = stubFetch(new Response(JSON.stringify({ photoUrl: "https://cdn.test/a.webp" }), { status: 200 }));
    expect(await confirmUpload(UPLOAD.key)).toEqual({ kind: "ok", photoUrl: "https://cdn.test/a.webp" });
    const [, init] = fetch.mock.calls[0]!;
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ key: UPLOAD.key });
  });

  it("maps 503 to photos-off and 400 to error", async () => {
    stubFetch(new Response(null, { status: 503 }));
    expect(await confirmUpload("k")).toEqual({ kind: "photos-off" });
    stubFetch(new Response(JSON.stringify({ error: "not_found" }), { status: 400 }));
    expect(await confirmUpload("k")).toEqual({ kind: "error" });
  });
});

describe("removePhoto", () => {
  it("deletes and accepts 204", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await removePhoto()).toEqual({ kind: "ok" });
    expect(fetch.mock.calls[0]![1]?.method).toBe("DELETE");
  });

  it("maps 503 to photos-off", async () => {
    stubFetch(new Response(null, { status: 503 }));
    expect(await removePhoto()).toEqual({ kind: "photos-off" });
  });
});
