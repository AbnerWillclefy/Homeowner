import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { GetHomeResult } from "./api";

const getHome = vi.fn<() => Promise<GetHomeResult>>();
vi.mock("./api", () => ({ getHome: () => getHome() }));

const { homeKey, homeQuery } = await import("./queries");

const HOME = { id: "h1", timezone: "America/Sao_Paulo", allocationTime: "07:00" };

describe("homeQuery", () => {
  beforeEach(() => getHome.mockReset());

  it("has a stable key shaped like the API path", () => {
    expect(homeKey).toEqual(["home"]);
    expect(homeQuery.queryKey).toEqual(["home"]);
  });

  it("returns the Home", async () => {
    getHome.mockResolvedValue({ kind: "ok", home: HOME });
    expect(await createTestQueryClient().fetchQuery(homeQuery)).toEqual(HOME);
  });

  it("returns none as null data, not an error", async () => {
    getHome.mockResolvedValue({ kind: "none" });
    const client = createTestQueryClient();
    expect(await client.fetchQuery(homeQuery)).toBeNull();
    expect(client.getQueryData(homeKey)).toBeNull();
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getHome.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(homeQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
