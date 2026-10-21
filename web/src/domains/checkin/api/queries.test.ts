import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { CheckIn, CheckInResult } from "./api";

const getCheckIn = vi.fn<() => Promise<CheckInResult>>();
vi.mock("./api", () => ({ getCheckIn: () => getCheckIn() }));

const { checkInKey, checkInQuery } = await import("./queries");

const CHECK_IN: CheckIn = { date: "2026-10-12", checkedIn: true, level: "low", restrictions: ["bending"] };

describe("checkInQuery", () => {
  beforeEach(() => getCheckIn.mockReset());

  it("is keyed under the Home with no date: the server decides the Home's day", () => {
    expect(checkInKey).toEqual(["home", "check-in"]);
    expect(checkInQuery.queryKey).toEqual(["home", "check-in"]);
  });

  it("returns the Check-in", async () => {
    getCheckIn.mockResolvedValue({ kind: "ok", checkIn: CHECK_IN });
    expect(await createTestQueryClient().fetchQuery(checkInQuery)).toEqual(CHECK_IN);
  });

  it("returns none as null data, not an error", async () => {
    getCheckIn.mockResolvedValue({ kind: "none" });
    const client = createTestQueryClient();
    expect(await client.fetchQuery(checkInQuery)).toBeNull();
    expect(client.getQueryData(checkInKey)).toBeNull();
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getCheckIn.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(checkInQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
