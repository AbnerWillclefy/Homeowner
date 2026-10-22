import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import { resident, residentDetail } from "../testing/fixtures";
import type { ResidentResult, ResidentsResult } from "./api";

const getResidents = vi.fn<() => Promise<ResidentsResult>>();
const getResident = vi.fn<(id: string) => Promise<ResidentResult>>();
vi.mock("./api", () => ({ getResidents: () => getResidents(), getResident: (id: string) => getResident(id) }));

const { residentKey, residentsKey, residentQuery, residentsQuery } = await import("./queries");

describe("residentsQuery", () => {
  beforeEach(() => getResidents.mockReset());

  it("is keyed under the Home, so a join or leave clears it", () => {
    expect(residentsKey).toEqual(["home", "residents"]);
    expect(residentsQuery.queryKey).toEqual(["home", "residents"]);
  });

  it("returns the Residents", async () => {
    const list = [resident("r1", "Ana")];
    getResidents.mockResolvedValue({ kind: "ok", date: "2030-01-15", residents: list });
    expect(await createTestQueryClient().fetchQuery(residentsQuery)).toEqual(list);
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getResidents.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(residentsQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });

  it("fails as an error when there is no Home, as the list did before", async () => {
    getResidents.mockResolvedValue({ kind: "none" });
    const failure = await createTestQueryClient().fetchQuery(residentsQuery).catch((e: unknown) => e);
    expect((failure as ApiFailure).kind).toBe("error");
  });
});

describe("residentQuery", () => {
  beforeEach(() => getResident.mockReset());

  it("has a key per Resident, under the list's key", () => {
    expect(residentKey("r1")).toEqual(["home", "residents", "r1"]);
    expect(residentQuery("r2").queryKey).toEqual(["home", "residents", "r2"]);
  });

  it("returns the Resident's page data", async () => {
    const detail = residentDetail("r1", "Ana");
    getResident.mockResolvedValue({ kind: "ok", resident: detail });
    const client = createTestQueryClient();
    expect(await client.fetchQuery(residentQuery("r1"))).toEqual(detail);
    expect(getResident).toHaveBeenCalledWith("r1");
  });

  it.each(["not-found", "none"] as const)("gives null as data for %s, not an error", async (kind) => {
    getResident.mockResolvedValue({ kind });
    const client = createTestQueryClient();
    expect(await client.fetchQuery(residentQuery("r1"))).toBeNull();
    expect(client.getQueryData(residentKey("r1"))).toBeNull();
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getResident.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(residentQuery("r1")).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
