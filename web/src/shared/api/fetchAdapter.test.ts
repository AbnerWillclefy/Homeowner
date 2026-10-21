import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdapter } from "./fetchAdapter";

function stubFetch(reply: () => Response) {
  const stub = vi.fn(async (_url: unknown, _init?: RequestInit) => reply());
  vi.stubGlobal("fetch", stub);
  return stub;
}

const client = () => axios.create({ baseURL: "http://api.test", adapter: fetchAdapter, validateStatus: () => true });

afterEach(() => vi.unstubAllGlobals());

describe("fetchAdapter", () => {
  it("calls the global fetch with a string URL and a RequestInit", async () => {
    const stub = stubFetch(() => new Response("{}", { status: 200 }));
    await client().get("/me", { params: { a: "1" }, headers: { Authorization: "Bearer t" } });
    const [url, init] = stub.mock.calls[0]!;
    expect(url).toBe("http://api.test/me?a=1");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer t");
  });

  it("sends a JSON body as a string with its content type", async () => {
    const stub = stubFetch(() => new Response("{}", { status: 200 }));
    await client().post("/home", { name: "Casa" });
    const [, init] = stub.mock.calls[0]!;
    expect(init?.body).toBe('{"name":"Casa"}');
    expect(new Headers(init?.headers).get("Content-Type")).toContain("application/json");
  });

  it("sends no body for a POST with no data", async () => {
    const stub = stubFetch(() => new Response(null, { status: 204 }));
    await client().post("/home/day-plan/me");
    expect(stub.mock.calls[0]![1]?.body).toBeUndefined();
  });

  it("passes fetchOptions on", async () => {
    const stub = stubFetch(() => new Response("{}", { status: 200 }));
    await client().get("/me", { fetchOptions: { cache: "no-store" } });
    expect(stub.mock.calls[0]![1]?.cache).toBe("no-store");
  });

  it("parses a JSON answer and gives the status", async () => {
    stubFetch(() => new Response('{"error":"nope"}', { status: 409 }));
    const response = await client().get("/x");
    expect(response.status).toBe(409);
    expect(response.data).toEqual({ error: "nope" });
  });

  it("leaves an HTML answer as the raw string", async () => {
    stubFetch(() => new Response("<html>hi</html>", { status: 200 }));
    expect((await client().get("/x")).data).toBe("<html>hi</html>");
  });

  it("lets a network failure through as a thrown error", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(client().get("/x")).rejects.toThrow();
  });

  it("rejects with ECONNABORTED when the timeout passes", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    await expect(client().get("/x", { timeout: 10 })).rejects.toMatchObject({ code: "ECONNABORTED" });
  });
});
