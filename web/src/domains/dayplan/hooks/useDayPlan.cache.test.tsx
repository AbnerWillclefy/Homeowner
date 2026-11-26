// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { dayPlan, task } from "../testing/fixtures";
import { undoHarness } from "../../../shared/undo/testing";
import type { ActionResult, DayPlanResult } from "../api/api";

const getDayPlan = vi.fn<() => Promise<DayPlanResult>>();
const acceptTask = vi.fn<() => Promise<ActionResult>>();
const acceptAllCall = vi.fn<() => Promise<ActionResult>>();
const refuseTask = vi.fn<(id: string) => Promise<ActionResult>>();
const completeTask = vi.fn<(id: string) => Promise<ActionResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDayPlan: () => getDayPlan(),
  acceptTask: () => acceptTask(),
  acceptAll: () => acceptAllCall(),
  refuseTask: (id: string) => refuseTask(id),
  completeTask: (id: string) => completeTask(id),
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
  let harness = undoHarness();
  const mount = (cached = CACHED) => {
    const client = createTestQueryClient();
    client.setQueryData(dayPlanKey, cached);
    rendered = renderWithQueryClient(harness.wrap(createElement(Probe)), client);
    return client;
  };
  beforeEach(() => {
    harness = undoHarness();
    getDayPlan.mockReset();
    acceptTask.mockReset();
    acceptAllCall.mockReset();
    refuseTask.mockReset();
    completeTask.mockReset();
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

  describe("a held refuse or done (ADR 0029)", () => {
    const A = { ...task("a"), committed: true };
    const WITH_A = dayPlan({ energy: 3, mine: [A, task("b")] });
    const planIds = (list: { id: string }[]) => list.map((t) => t.id);
    const shownPlan = () => (day.state.kind === "ready" ? day.state.plan : null)!;

    it("shows a refuse at once, sends nothing, and keeps the cache as the server's plan", async () => {
      const client = mount(WITH_A);
      await settle();
      await act(async () => day.run("refuse", A));
      await settle();
      expect(planIds(shownPlan().mine)).toEqual(["b"]);
      expect(planIds(shownPlan().pool)).toEqual(["a"]);
      expect(refuseTask).not.toHaveBeenCalled();
      expect(client.getQueryData(dayPlanKey)).toEqual(WITH_A);
      expect(day.acting).toBeNull();
    });

    it("keeps the held refuse over a refetch of the plan, which still has the Task as the server holds it", async () => {
      getDayPlan.mockResolvedValue({ kind: "ok", plan: WITH_A });
      const client = mount(WITH_A);
      await settle();
      await act(async () => day.run("refuse", A));
      await client.refetchQueries({ queryKey: dayPlanKey });
      await settle();
      expect(getDayPlan).toHaveBeenCalledTimes(1);
      expect(planIds(shownPlan().mine)).toEqual(["b"]);
      expect(refuseTask).not.toHaveBeenCalled();
    });

    it("restores the Task and sends nothing on Desfazer, even when its toast closes after", async () => {
      mount(WITH_A);
      await settle();
      await act(async () => day.run("refuse", A));
      await act(async () => harness.undo(0));
      await act(async () => harness.close(0));
      await settle();
      expect(planIds(shownPlan().mine)).toEqual(["a", "b"]);
      expect(refuseTask).not.toHaveBeenCalled();
    });

    it("sends the refuse once when the toast closes, and shows the server's answer", async () => {
      refuseTask.mockResolvedValue({ kind: "ok", plan: dayPlan({ energy: 9, mine: [task("b")], pool: [task("a")] }) });
      const client = mount(WITH_A);
      await settle();
      await act(async () => day.run("refuse", A));
      await act(async () => harness.close(0));
      await settle();
      expect(refuseTask).toHaveBeenCalledTimes(1);
      expect(refuseTask).toHaveBeenCalledWith("a");
      expect(client.getQueryData(dayPlanKey)).toMatchObject({ energy: 9 });
      expect(planIds(shownPlan().mine)).toEqual(["b"]);
    });

    it("shows a done as one more done today, and counts it only once the answer is written", async () => {
      completeTask.mockResolvedValue({ kind: "ok", plan: dayPlan({ mine: [task("b")] }) });
      mount(WITH_A);
      await settle();
      await act(async () => day.run("done", A));
      await settle();
      expect(planIds(shownPlan().mine)).toEqual(["b"]);
      expect(shownPlan().doneToday.map((d) => d.id)).toEqual(["a"]);
      expect(completeTask).not.toHaveBeenCalled();
    });

    it("restores the Task and says why when the send is refused with a 409, reading the plan again", async () => {
      refuseTask.mockResolvedValue({ kind: "conflict", code: "not_proposed" });
      getDayPlan.mockResolvedValue({ kind: "ok", plan: FRESH });
      const client = mount(WITH_A);
      await settle();
      await act(async () => day.run("refuse", A));
      await act(async () => harness.close(0));
      await settle();
      expect(getDayPlan).toHaveBeenCalledTimes(1);
      expect(client.getQueryData(dayPlanKey)).toEqual(FRESH);
      expect(shownPlan()).toEqual(FRESH);
      expect(harness.toasts.at(-1)?.request).toMatchObject({ tone: "error", messageKey: "dayplan.conflict.not_proposed" });
    });

    it("restores the Task and says so when the send fails offline", async () => {
      completeTask.mockResolvedValue({ kind: "offline" });
      mount(WITH_A);
      await settle();
      await act(async () => day.run("done", A));
      await act(async () => harness.close(0));
      await settle();
      expect(planIds(shownPlan().mine)).toEqual(["a", "b"]);
      expect(shownPlan().doneToday).toEqual([]);
      expect(harness.toasts.at(-1)?.request).toMatchObject({ tone: "error", messageKey: "dayplan.action.failed.offline" });
    });

    it("sends the first write when a second is held, and leaves every other card usable meanwhile", async () => {
      refuseTask.mockResolvedValue({ kind: "ok", plan: dayPlan({ mine: [task("b")], pool: [task("a")] }) });
      mount(WITH_A);
      await settle();
      await act(async () => day.run("refuse", A));
      expect(day.acting).toBeNull();
      await act(async () => day.run("done", task("b")));
      await settle();
      expect(refuseTask).toHaveBeenCalledTimes(1);
      expect(completeTask).not.toHaveBeenCalled();
    });

    it("sends a held refuse before Accept all, which would otherwise commit the refused Task", async () => {
      const order: string[] = [];
      refuseTask.mockImplementation(async () => (order.push("refuse"), { kind: "ok", plan: FRESH }));
      acceptAllCall.mockImplementation(async () => (order.push("acceptAll"), { kind: "ok", plan: FRESH }));
      mount(WITH_A);
      await settle();
      await act(async () => day.run("refuse", A));
      await act(async () => day.acceptAll());
      await settle();
      expect(order).toEqual(["refuse", "acceptAll"]);
    });

    it("does not hold an accept: it is sent at once", async () => {
      acceptTask.mockResolvedValue({ kind: "ok", plan: FRESH });
      mount(WITH_A);
      await settle();
      await act(async () => day.run("accept", task("b")));
      await settle();
      expect(acceptTask).toHaveBeenCalledTimes(1);
      expect(harness.toasts).toHaveLength(0);
    });
  });
});
