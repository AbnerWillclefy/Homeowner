import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import { dayPlan } from "../testing/fixtures";
import type { DayPlanResult } from "./api";

const getDayPlan = vi.fn<() => Promise<DayPlanResult>>();
vi.mock("./api", () => ({ getDayPlan: () => getDayPlan() }));

const { dayPlanKey, dayPlanQuery } = await import("./queries");

describe("dayPlanQuery", () => {
  beforeEach(() => getDayPlan.mockReset());

  it("is keyed under the Home with no date: the server decides the Home's day", () => {
    expect(dayPlanKey).toEqual(["home", "day-plan"]);
    expect(dayPlanQuery.queryKey).toEqual(["home", "day-plan"]);
  });

  it("returns the Day Plan", async () => {
    const plan = dayPlan({ energy: 3 });
    getDayPlan.mockResolvedValue({ kind: "ok", plan });
    expect(await createTestQueryClient().fetchQuery(dayPlanQuery)).toEqual(plan);
  });

  it("returns none as null data, not an error", async () => {
    getDayPlan.mockResolvedValue({ kind: "none" });
    const client = createTestQueryClient();
    expect(await client.fetchQuery(dayPlanQuery)).toBeNull();
    expect(client.getQueryData(dayPlanKey)).toBeNull();
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getDayPlan.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(dayPlanQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
