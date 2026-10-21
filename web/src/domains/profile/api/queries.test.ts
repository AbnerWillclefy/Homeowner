import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { IdsResult } from "./api";

const getCategories = vi.fn<() => Promise<IdsResult>>();
const getDemands = vi.fn<() => Promise<IdsResult>>();
vi.mock("./api", () => ({ getCategories: () => getCategories(), getDemands: () => getDemands() }));

const { categoriesKey, categoriesQuery, demandsKey, demandsQuery } = await import("./queries");

describe.each([
  ["categoriesQuery", categoriesKey, categoriesQuery, getCategories, ["categories"]],
  ["demandsQuery", demandsKey, demandsQuery, getDemands, ["demands"]],
] as const)("%s", (_name, key, query, call, path) => {
  beforeEach(() => call.mockReset());

  it("has a key shaped like the API path, outside the Home: the lists are the same for every Home", () => {
    expect(key).toEqual(path);
    expect(query.queryKey).toEqual(path);
  });

  it("returns the ids", async () => {
    call.mockResolvedValue({ kind: "ok", ids: ["a", "b"] });
    expect(await createTestQueryClient().fetchQuery(query)).toEqual(["a", "b"]);
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    call.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(query).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
