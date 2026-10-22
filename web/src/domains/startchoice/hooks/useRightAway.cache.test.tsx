// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import type { ActionResult } from "../../dayplan/api/api";
import { dayPlan } from "../../dayplan/testing/fixtures";

const planMyDay = vi.fn<() => Promise<ActionResult>>();
vi.mock("../../dayplan/api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  planMyDay: () => planMyDay(),
}));

const { dayPlanKey } = await import("../../dayplan/api/queries");
const { streakKey } = await import("../../streak/api/queries");
const { useRightAway } = await import("./useRightAway");

const PLAN = dayPlan({ energy: 8 });
const CACHED = dayPlan({ energy: 3 });

describe("useRightAway over the query cache", () => {
  let rendered: Rendered | undefined;
  let rightAway!: ReturnType<typeof useRightAway>;
  const Probe = () => {
    rightAway = useRightAway();
    return null;
  };
  const mount = () => {
    const client = createTestQueryClient();
    client.setQueryData(dayPlanKey, CACHED);
    client.setQueryData(streakKey, 1);
    rendered = renderWithQueryClient(createElement(Probe), client);
    return client;
  };
  beforeEach(() => planMyDay.mockReset());
  afterEach(() => rendered?.unmount());

  it("writes the plan the call answered into the cache and marks the Streak stale", async () => {
    planMyDay.mockResolvedValue({ kind: "ok", plan: PLAN });
    const client = mount();
    await act(async () => rightAway.start());
    expect(client.getQueryData(dayPlanKey)).toEqual(PLAN);
    expect(client.getQueryState(streakKey)?.isInvalidated).toBe(true);
    expect(rightAway.state).toEqual({ kind: "done", plan: PLAN });
  });

  it("leaves the cache untouched when the call fails", async () => {
    planMyDay.mockResolvedValue({ kind: "offline" });
    const client = mount();
    await act(async () => rightAway.start());
    expect(client.getQueryData(dayPlanKey)).toEqual(CACHED);
    expect(client.getQueryState(streakKey)?.isInvalidated).toBe(false);
    expect(rightAway.state).toEqual({ kind: "failed", reason: "offline" });
  });
});
