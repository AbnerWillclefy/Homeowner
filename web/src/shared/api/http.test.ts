import { afterEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "./http";
import { config } from "../config";

function stubFetch() {
  const stub = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", stub);
  return stub;
}

afterEach(() => vi.unstubAllGlobals());

describe("httpClient", () => {
  it("applies the API base URL", async () => {
    const stub = stubFetch();
    await httpClient.get("/categories");
    expect(stub.mock.calls[0]![0]).toBe(`${config.apiBaseUrl}/categories`);
  });

  it("refuses an absolute URL and sends nothing", async () => {
    const stub = stubFetch();
    await expect(httpClient.get("https://elsewhere.test/x")).rejects.toThrow(/absolute URL/);
    await expect(httpClient.get("//elsewhere.test/x")).rejects.toThrow(/absolute URL/);
    expect(stub).not.toHaveBeenCalled();
  });

  it("sends no Authorization header", async () => {
    const stub = stubFetch();
    await httpClient.get("/categories");
    expect(new Headers(stub.mock.calls[0]![1]?.headers).has("Authorization")).toBe(false);
  });
});
