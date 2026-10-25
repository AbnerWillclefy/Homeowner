// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { dayPlan, task } from "../testing/fixtures";
import type { ActionResult, DayPlanResult } from "../api/api";

const getDayPlan = vi.fn<() => Promise<DayPlanResult>>();
const acceptTask = vi.fn<() => Promise<ActionResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDayPlan: () => getDayPlan(),
  acceptTask: () => acceptTask(),
}));

const { dayPlanKey } = await import("../api/queries");
const { useDayPlan } = await import("./useDayPlan");

const CACHED = dayPlan({ energy: 3 });
const FRESH = dayPlan({ energy: 8 });

/** Lets the query client's batched notifications (a zero-delay timer) reach React. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("useDayPlan over the query cache", () => {
  let rendered: Rendered | undefined;
  let day!: ReturnType<typeof useDayPlan>;
  const Probe = () => {
    day = useDayPlan();
    return null;
  };
  const mount = () => {
    const client = createTestQueryClient();
    client.setQueryData(dayPlanKey, CACHED);
    rendered = renderWithQueryClient(createElement(Probe), client);
    return client;
  };
  beforeEach(() => {
    getDayPlan.mockReset();
    acceptTask.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("shows the cached plan at once and does not read it on mount, since the launch wave already did (ADR 0016)", async () => {
    mount();
    await settle();
    expect(day.state).toEqual({ kind: "ready", plan: CACHED });
    expect(getDayPlan).not.toHaveBeenCalled();
  });

  it("shows the cached plan at once, with no loading state, while a window-focus refetch runs behind it", async () => {
    let answer!: (result: DayPlanResult) => void;
    getDayPlan.mockImplementation(() => new Promise<DayPlanResult>((resolve) => (answer = resolve)));
    const client = mount();
    void client.refetchQueries({ queryKey: dayPlanKey });
    await settle();
    expect(day.state).toEqual({ kind: "ready", plan: CACHED });
    expect(day.refreshing).toBe(true);
    answer({ kind: "ok", plan: FRESH });
    await settle();
    expect(day.state).toEqual({ kind: "ready", plan: FRESH });
    expect(day.refreshing).toBe(false);
  });

  it("keeps the cached plan, with no alert state, when the refetch fails", async () => {
    getDayPlan.mockResolvedValue({ kind: "offline" });
    const client = mount();
    await client.refetchQueries({ queryKey: dayPlanKey });
    await settle();
    expect(day.state).toEqual({ kind: "ready", plan: CACHED });
    expect(day.refreshing).toBe(false);
  });

  it("shows an action's answer without reading the plan again, and counts the change", async () => {
    getDayPlan.mockResolvedValue({ kind: "ok", plan: CACHED });
    acceptTask.mockResolvedValue({ kind: "ok", plan: FRESH });
    const client = mount();
    await settle();
    expect(getDayPlan).not.toHaveBeenCalled();
    const changedBefore = day.changed;
    await act(async () => day.run("accept", task("t1")));
    await settle();
    expect(getDayPlan).not.toHaveBeenCalled();
    expect(client.getQueryData(dayPlanKey)).toEqual(FRESH);
    expect(day.changed).toBe(changedBefore + 1);
  });

  it("reads the plan exactly once after a 409, and shows it", async () => {
    getDayPlan.mockResolvedValue({ kind: "ok", plan: CACHED });
    acceptTask.mockResolvedValue({ kind: "conflict", code: "not_proposed" });
    const client = mount();
    await settle();
    getDayPlan.mockClear();
    getDayPlan.mockResolvedValue({ kind: "ok", plan: FRESH });
    await act(async () => day.run("accept", task("t1")));
    await settle();
    expect(getDayPlan).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(dayPlanKey)).toEqual(FRESH);
    expect(day.notice?.tone).toBe("status");
  });

  it("keeps the answer when a read that started during the action finishes after it", async () => {
    getDayPlan.mockResolvedValue({ kind: "ok", plan: CACHED });
    let answer!: (result: ActionResult) => void;
    acceptTask.mockImplementation(() => new Promise<ActionResult>((resolve) => (answer = resolve)));
    const client = mount();
    await settle();
    await act(async () => day.run("accept", task("t1")));
    // Window focus while the call is out: a read starts and will answer with the old plan.
    let late!: (result: DayPlanResult) => void;
    getDayPlan.mockImplementation(() => new Promise<DayPlanResult>((resolve) => (late = resolve)));
    void client.refetchQueries({ queryKey: dayPlanKey });
    await settle();
    answer({ kind: "ok", plan: FRESH });
    await settle();
    late({ kind: "ok", plan: CACHED });
    await settle();
    expect(client.getQueryData(dayPlanKey)).toEqual(FRESH);
  });

  it("puts a plan into the cache with `show`, and does not throw after unmount", async () => {
    getDayPlan.mockResolvedValue({ kind: "ok", plan: CACHED });
    const client = mount();
    await settle();
    const { show } = day;
    rendered?.unmount();
    rendered = undefined;
    await expect(show(FRESH)).resolves.toBeUndefined();
    expect(client.getQueryData(dayPlanKey)).toEqual(FRESH);
  });
});
