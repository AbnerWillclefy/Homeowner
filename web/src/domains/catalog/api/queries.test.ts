import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { CatalogEntry, GetCatalogResult } from "./api";

const getCatalog = vi.fn<() => Promise<GetCatalogResult>>();
vi.mock("./api", () => ({ getCatalog: () => getCatalog() }));

const { catalogKey, catalogQuery } = await import("./queries");

describe("catalogQuery", () => {
  beforeEach(() => getCatalog.mockReset());

  it("has a key outside the Home: the Catalog is the same for everyone", () => {
    expect(catalogKey).toEqual(["catalog"]);
    expect(catalogQuery.queryKey).toEqual(["catalog"]);
  });

  it("returns the entries", async () => {
    const entries = [{ id: "clean_bathroom", name: "Clean bathroom" }] as unknown as CatalogEntry[];
    getCatalog.mockResolvedValue({ kind: "ok", entries });
    expect(await createTestQueryClient().fetchQuery(catalogQuery)).toEqual(entries);
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getCatalog.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(catalogQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
